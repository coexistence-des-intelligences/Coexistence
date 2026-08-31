import { analyzeContributionAI, analyzeCollectiveAI, createEmbedding } from './openai.js';
import { ANALYSIS_PROMPT, COLLECTIVE_PROMPT } from './prompts.js';
import { insert, update, upsert, rpc, sb, vectorLiteral } from './supabase.js';
import { obviousPrivacyRisk } from './security.js';

function pid(prefix) {
  return `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

async function logEvent(env, type, summary, details = {}, visibility = 'public') {
  try {
    await insert(env, 'events', {
      public_id: pid('E'),
      instance_id: env.INSTANCE_ID || 'local',
      event_type: type,
      public_summary: summary,
      details,
      visibility
    }, false);
  } catch (_) {}
}

async function relatedContributions(env, embedding, excludeId) {
  if (!embedding) return [];

  try {
    const rows = await rpc(env, 'match_contributions', {
      query_embedding: vectorLiteral(embedding),
      match_count: 8,
      exclude_id: excludeId
    });

    return (rows || []).map(r => ({
      public_id: r.public_id,
      title: r.title,
      summary: r.summary,
      similarity: r.similarity
    }));
  } catch (_) {
    return [];
  }
}

async function upsertAnalysisEntities(env, contribution, analysis) {
  // Une analyse individuelle enrichit la cartographie du corpus,
  // mais elle ne crée pas à elle seule d'objet collectif institutionnel.
  //
  // Les désaccords candidats, risques, questions et propositions restent
  // conservés dans le JSON de l'analyse. Ils pourront être promus plus tard
  // par runCollectiveSynthesis() si le corpus fournit un contexte suffisant.

  // 1. Pistes thématiques issues de cette contribution.
  for (const t of analysis.themes || []) {
    const rows = await upsert(env, 'themes', 'canonical_key', {
      canonical_key: t.key,
      label: t.label,
      updated_at: new Date().toISOString()
    });

    const theme = rows?.[0];

    if (theme?.id) {
      await upsert(
        env,
        'contribution_themes',
        'contribution_id,theme_id',
        {
          contribution_id: contribution.id,
          theme_id: theme.id,
          confidence: t.confidence
        }
      );
    }
  }

  // 2. Relations explicites avec d'autres contributions déjà publiées.
  for (const rel of analysis.related_contributions || []) {
    const targets = await sb(
      env,
      `contributions?public_id=eq.${encodeURIComponent(rel.public_id)}&status=eq.published&select=id&limit=1`
    );

    if (targets?.[0]?.id) {
      await upsert(
        env,
        'contribution_relations',
        'source_contribution_id,target_contribution_id,relation_type',
        {
          source_contribution_id: contribution.id,
          target_contribution_id: targets[0].id,
          relation_type: rel.relation,
          explanation: rel.explanation
        }
      );
    }
  }
}

export async function processContribution(env, contribution) {
  try {
    const embedding = await createEmbedding(env, contribution.summary);

    if (embedding) {
      await update(env, 'contributions', `id=eq.${contribution.id}`, {
        embedding: vectorLiteral(embedding)
      });
    }

    const related = await relatedContributions(env, embedding, contribution.id);

    const analysis = await analyzeContributionAI(env, ANALYSIS_PROMPT, {
      contribution: {
        public_id: contribution.public_id,
        title: contribution.title,
        summary: contribution.summary,
        nature: contribution.nature,
        open_question: contribution.open_question
      },
      potentially_related_public_contributions: related
    });

    const analysisRow = (await insert(env, 'analyses', {
      public_id: pid('A'),
      contribution_id: contribution.id,
      model: env.OPENAI_ANALYSIS_MODEL || 'gpt-5-mini',
      protocol_version: env.ANALYSIS_PROTOCOL_VERSION || '0.1',
      content: analysis,
      status: 'active'
    }))?.[0];

    const review =
      obviousPrivacyRisk(`${contribution.title}\n${contribution.summary}`) ||
      analysis.publication_risk?.level === 'review';

    const newStatus = review ? 'quarantined' : 'published';

    await update(env, 'contributions', `id=eq.${contribution.id}`, {
      status: newStatus,
      publication_note: review
        ? (analysis.publication_risk?.reasons || ['privacy']).join(', ')
        : null,
      processed_at: new Date().toISOString()
    });

    if (!review) {
      await upsertAnalysisEntities(env, contribution, analysis);

      await logEvent(
        env,
        'contribution_published',
        `${contribution.public_id} a rejoint le corpus public.`,
        {
          contribution_id: contribution.public_id,
          analysis_id: analysisRow?.public_id || null,
          themes: (analysis.themes || []).map(x => x.key)
        }
      );
    } else {
      await logEvent(
        env,
        'contribution_quarantined',
        `${contribution.public_id} a été placée en quarantaine pour vérification d'intégrité ou de confidentialité.`,
        {
          contribution_id: contribution.public_id,
          reasons: analysis.publication_risk?.reasons || ['privacy']
        }
      );
    }

    return { status: newStatus, analysis };
  } catch (err) {
    await update(env, 'contributions', `id=eq.${contribution.id}`, {
      status: 'processing_error',
      publication_note: 'Erreur de traitement automatique'
    }).catch(() => {});

    await logEvent(
      env,
      'processing_error',
      `Une contribution n'a pas pu être traitée automatiquement.`,
      {
        contribution_id: contribution.public_id,
        error: String(err.message || err).slice(0, 300)
      },
      'internal'
    );

    throw err;
  }
}

async function recentAnalyses(env) {
  return sb(
    env,
    'analyses?select=public_id,created_at,content,contributions!inner(public_id,title,summary,status)&status=eq.active&contributions.status=eq.published&order=created_at.desc&limit=80'
  );
}

function latestAnalysisPerContribution(rows = []) {
  const byContribution = new Map();

  // rows est déjà trié du plus récent au plus ancien.
  for (const row of rows) {
    const contributionId = row?.contributions?.public_id;

    if (!contributionId || byContribution.has(contributionId)) {
      continue;
    }

    byContribution.set(contributionId, row);
  }

  return [...byContribution.values()];
}

function evidenceTools(rows = []) {
  const analysisToContribution = new Map(
    rows.map(row => [
      row.public_id,
      row?.contributions?.public_id || null
    ])
  );

  const validAnalysisIds = new Set(analysisToContribution.keys());

  const cleanEvidenceIds = (ids = []) => [
    ...new Set(
      (ids || []).filter(id => validAnalysisIds.has(id))
    )
  ];

  const distinctContributionCount = (ids = []) => {
    const contributions = new Set();

    for (const id of cleanEvidenceIds(ids)) {
      const contributionId = analysisToContribution.get(id);

      if (contributionId) {
        contributions.add(contributionId);
      }
    }

    return contributions.size;
  };

  return {
    cleanEvidenceIds,
    distinctContributionCount
  };
}

export async function runCollectiveSynthesis(env) {
  const rawRows = await recentAnalyses(env);
  const rows = latestAnalysisPerContribution(rawRows || []);

  // On exige au moins trois contributions distinctes avant de lancer
  // une synthèse collective.
  if (rows.length < 3) {
    return {
      skipped: true,
      reason: 'not_enough_material'
    };
  }

  const payload = rows.map(r => ({
    analysis_id: r.public_id,
    contribution: r.contributions,
    analysis: r.content
  }));

  const synthesis = await analyzeCollectiveAI(
    env,
    COLLECTIVE_PROMPT,
    payload
  );

  const {
    cleanEvidenceIds,
    distinctContributionCount
  } = evidenceTools(rows);

  const synthesisRow = (await insert(env, 'collective_syntheses', {
    public_id: pid('S'),
    model: env.OPENAI_ANALYSIS_MODEL || 'gpt-5-mini',
    protocol_version: env.ANALYSIS_PROTOCOL_VERSION || '0.1',
    content: synthesis
  }))?.[0];

  // Les thèmes collectifs réellement émergents exigent
  // au moins deux contributions distinctes.
  for (const t of synthesis.emergent_topics || []) {
    const evidenceIds = cleanEvidenceIds(t.evidence_ids);

    if (distinctContributionCount(evidenceIds) < 2) {
      continue;
    }

    await upsert(env, 'themes', 'canonical_key', {
      canonical_key: t.key,
      label: t.label,
      description: t.synthesis,
      updated_at: new Date().toISOString()
    });
  }

  // Un désaccord collectif exige au moins deux positions
  // et deux contributions distinctes réellement présentes.
  for (const d of synthesis.disagreements || []) {
    const evidenceIds = cleanEvidenceIds(d.evidence_ids);
    const positions = (d.positions || []).filter(Boolean);

    if (positions.length < 2) {
      continue;
    }

    if (distinctContributionCount(evidenceIds) < 2) {
      continue;
    }

    await upsert(env, 'disagreements', 'canonical_key', {
      public_id: pid('D'),
      canonical_key: d.key,
      title: d.title,
      summary: d.summary,
      positions,
      evidence_ids: evidenceIds,
      status: 'open',
      updated_at: new Date().toISOString()
    });
  }

  // Un risque peut être important même s'il est minoritaire.
  // Il doit toutefois être relié à au moins une analyse réelle.
  for (const r of synthesis.risks || []) {
    const evidenceIds = cleanEvidenceIds(r.evidence_ids);

    if (evidenceIds.length < 1) {
      continue;
    }

    await upsert(env, 'risks', 'canonical_key', {
      public_id: pid('R'),
      canonical_key: r.key,
      title: r.title,
      summary: r.summary,
      evidence_ids: evidenceIds,
      status: 'open',
      updated_at: new Date().toISOString()
    });
  }

  // Une question collective doit être ancrée dans le corpus,
  // sans exiger qu'elle soit majoritaire.
  for (const q of synthesis.questions || []) {
    const evidenceIds = cleanEvidenceIds(q.evidence_ids);

    if (evidenceIds.length < 1) {
      continue;
    }

    await upsert(env, 'questions', 'canonical_key', {
      public_id: pid('Q'),
      canonical_key: q.key,
      question: q.question,
      evidence_ids: evidenceIds,
      status: 'open',
      updated_at: new Date().toISOString()
    });
  }

  // Les propositions restent des pistes à examiner, jamais des décisions.
  // Elles doivent être reliées à au moins une analyse réelle.
  for (const p of synthesis.proposals || []) {
    const evidenceIds = cleanEvidenceIds(p.evidence_ids);

    if (evidenceIds.length < 1) {
      continue;
    }

    await upsert(env, 'proposals', 'canonical_key', {
      public_id: pid('P'),
      canonical_key: p.key,
      proposal_type: p.type,
      title: p.title,
      summary: p.summary,
      counterargument: p.counterargument,
      evidence_ids: evidenceIds,
      status: 'open',
      source: 'collective_synthesis',
      updated_at: new Date().toISOString()
    });
  }

  if (synthesis.version_candidate?.justified) {
    const v = synthesis.version_candidate;
    const evidenceIds = cleanEvidenceIds(v.evidence_ids);

    // Une version candidate doit au minimum être reliée
    // à une analyse réelle du corpus.
    if (evidenceIds.length > 0) {
      await upsert(env, 'proposals', 'canonical_key', {
        public_id: pid('P'),
        canonical_key: `version-${v.label || 'candidate'}`,
        proposal_type: 'version_candidate',
        title: `Candidat ${v.label || 'nouvelle version'}`,
        summary: v.reason,
        counterargument: (v.unresolved_objections || []).join(' | '),
        evidence_ids: evidenceIds,
        payload: {
          ...v,
          evidence_ids: evidenceIds
        },
        status: 'open',
        source: 'collective_synthesis',
        updated_at: new Date().toISOString()
      });
    }
  }

  await logEvent(
    env,
    'collective_synthesis',
    `Une nouvelle synthèse collective ${synthesisRow?.public_id || ''} a été produite.`,
    {
      synthesis_id: synthesisRow?.public_id || null,
      headline: synthesis.headline,
      material_contributions: rows.length,
      version_candidate: !!synthesis.version_candidate?.justified
    }
  );

  return {
    skipped: false,
    synthesis
  };
}

export async function retryPending(env, limit = 12) {
  const rows = await sb(
    env,
    `contributions?status=in.(pending_analysis,processing_error)&select=*&order=created_at.asc&limit=${limit}`
  );

  for (const c of rows || []) {
    try {
      await processContribution(env, c);
    } catch (_) {}
  }

  return rows?.length || 0;
}

export async function syncFederationPeers(env) {
  let peers = [];

  try {
    peers = JSON.parse(env.FEDERATION_PEERS || '[]');
  } catch (_) {
    return 0;
  }

  let imported = 0;

  for (const base of peers.slice(0, 20)) {
    try {
      const metaRes = await fetch(
        `${base.replace(/\/$/, '')}/.well-known/coexistence.json`
      );

      if (!metaRes.ok) {
        continue;
      }

      const meta = await metaRes.json();

      await upsert(env, 'federated_instances', 'instance_id', {
        instance_id: meta.instance_id,
        base_url: base,
        protocol_version: meta.protocol_version || 'unknown',
        trust_status: 'unverified',
        last_seen_at: new Date().toISOString()
      });

      const eventsRes = await fetch(
        `${base.replace(/\/$/, '')}/api/federation/events?limit=100`
      );

      if (!eventsRes.ok) {
        continue;
      }

      const packet = await eventsRes.json();

      for (const event of packet.events || []) {
        await upsert(
          env,
          'federated_events',
          'origin_instance_id,origin_event_id',
          {
            origin_instance_id: meta.instance_id,
            origin_event_id: event.public_id,
            payload: event,
            verification_status: 'unverified'
          }
        );

        imported++;
      }
    } catch (_) {}
  }

  return imported;
}
