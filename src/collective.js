import {
  analyzeContributionAI,
  analyzeCollectiveAI,
  createEmbedding
} from './openai.js';

import {
  ANALYSIS_PROMPT,
  COLLECTIVE_PROMPT
} from './prompts.js';

import {
  insert,
  update,
  upsert,
  rpc,
  sb,
  vectorLiteral
} from './supabase.js';

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
  } catch (_) {
    // Le journal ne doit pas bloquer le traitement principal.
  }
}

function analysisProtocol(env) {
  return env.ANALYSIS_PROTOCOL_VERSION || '0.1';
}

function analysisProvider(env) {
  return env.ANALYSIS_PROVIDER || 'openai';
}

function analysisModel(env) {
  return env.ANALYSIS_MODEL || env.OPENAI_ANALYSIS_MODEL || 'gpt-5-mini';
}

function versionedConceptKey(protocol, provider, model, conceptKey) {
  return `${protocol}::${provider}::${model}::${conceptKey}`;
}

function unique(values = []) {
  return [...new Set((values || []).filter(Boolean))];
}

function corpusFingerprint(rows = []) {
  return unique(rows.map(row => row.public_id)).sort().join('|');
}

function synthesisAnalysisIds(rows = []) {
  return unique(rows.map(row => row.public_id)).sort();
}

function synthesisContributionIds(rows = []) {
  return unique(rows.map(row => row?.contributions?.public_id)).sort();
}

function synthesisAnalysisProvenance(rows = []) {
  return rows
    .map(row => ({
      analysis_id: row.public_id,
      protocol_version: row.protocol_version || 'unknown',
      provider: row.provider || 'unknown',
      model: row.model || 'unknown'
    }))
    .sort((a, b) => a.analysis_id.localeCompare(b.analysis_id));
}

async function existingSynthesis(env, protocol, provider, model, fingerprint) {
  if (!fingerprint) return null;

  try {
    const rows = await sb(
      env,
      'collective_syntheses?' +
      `protocol_version=eq.${encodeURIComponent(protocol)}` +
      `&provider=eq.${encodeURIComponent(provider)}` +
      `&model=eq.${encodeURIComponent(model)}` +
      `&corpus_fingerprint=eq.${encodeURIComponent(fingerprint)}` +
      '&select=id,public_id,protocol_version,provider,model,created_at' +
      '&limit=1'
    );

    return rows?.[0] || null;
  } catch (_) {
    // La contrainte UNIQUE en base reste une seconde protection.
    return null;
  }
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
  for (const t of analysis.themes || []) {
    const rows = await upsert(env, 'themes', 'canonical_key', {
      canonical_key: t.key,
      label: t.label,
      updated_at: new Date().toISOString()
    });

    const theme = rows?.[0];
    if (theme?.id) {
      await upsert(env, 'contribution_themes', 'contribution_id,theme_id', {
        contribution_id: contribution.id,
        theme_id: theme.id,
        confidence: t.confidence
      });
    }
  }

  for (const rel of analysis.related_contributions || []) {
    const targets = await sb(
      env,
      `contributions?public_id=eq.${encodeURIComponent(rel.public_id)}` +
      '&status=eq.published&select=id&limit=1'
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

    const provider = analysisProvider(env);
    const model = analysisModel(env);
    const protocol = analysisProtocol(env);

    const analysisRow = (
      await insert(env, 'analyses', {
        public_id: pid('A'),
        contribution_id: contribution.id,
        provider,
        model,
        protocol_version: protocol,
        content: analysis,
        status: 'active'
      })
    )?.[0];

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
          analysis_protocol: protocol,
          analysis_provider: provider,
          analysis_model: model,
          themes: (analysis.themes || []).map(x => x.key),
          methodological_note:
            'Une contribution publiée constitue un élément du corpus. Elle ne permet aucune inférence sur le nombre total de personnes représentées.'
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
    'analyses?' +
    'select=public_id,created_at,provider,model,protocol_version,content,' +
    'contributions!inner(public_id,title,summary,status)' +
    '&status=eq.active' +
    '&contributions.status=eq.published' +
    '&order=created_at.desc' +
    '&limit=80'
  );
}

function latestAnalysisPerContribution(rows = []) {
  const byContribution = new Map();

  for (const row of rows) {
    const contributionId = row?.contributions?.public_id;
    if (!contributionId || byContribution.has(contributionId)) continue;
    byContribution.set(contributionId, row);
  }

  return [...byContribution.values()];
}

function evidenceTools(rows = []) {
  const analysisToContribution = new Map(
    rows.map(row => [row.public_id, row?.contributions?.public_id || null])
  );

  const validAnalysisIds = new Set(analysisToContribution.keys());

  const cleanEvidenceIds = (ids = []) =>
    unique(ids).filter(id => validAnalysisIds.has(id));

  const distinctContributionCount = (ids = []) => {
    const contributions = new Set();
    for (const id of cleanEvidenceIds(ids)) {
      const contributionId = analysisToContribution.get(id);
      if (contributionId) contributions.add(contributionId);
    }
    return contributions.size;
  };

  return { cleanEvidenceIds, distinctContributionCount };
}

function dedupeByKey(items = []) {
  const result = new Map();
  for (const item of items) {
    if (!item?.key) continue;
    if (!result.has(item.key)) result.set(item.key, item);
  }
  return [...result.values()];
}

function sanitizeCollectiveSynthesis(raw, rows) {
  const { cleanEvidenceIds, distinctContributionCount } = evidenceTools(rows);

  const diagnostics = {
    topics_moved_to_single: 0,
    disagreements_demoted_to_tensions: 0,
    invalid_evidence_ids_removed: 0
  };

  const cleanIds = (ids = []) => {
    const before = unique(ids).length;
    const cleaned = cleanEvidenceIds(ids);
    diagnostics.invalid_evidence_ids_removed += Math.max(0, before - cleaned.length);
    return cleaned;
  };

  const singleObservations = (raw.single_contribution_observations || [])
    .map(x => ({ ...x, evidence_ids: cleanIds(x.evidence_ids) }))
    .filter(x => x.evidence_ids.length > 0);

  const emergentTopics = [];
  for (const topic of raw.emergent_topics || []) {
    const evidenceIds = cleanIds(topic.evidence_ids);

    if (distinctContributionCount(evidenceIds) >= 2) {
      emergentTopics.push({ ...topic, evidence_ids: evidenceIds });
    } else if (evidenceIds.length > 0) {
      diagnostics.topics_moved_to_single++;
      singleObservations.push({
        key: topic.key,
        label: topic.label,
        summary: topic.synthesis,
        evidence_ids: evidenceIds
      });
    }
  }

  const nonDisagreementTensions = (raw.non_disagreement_tensions || [])
    .map(x => ({ ...x, evidence_ids: cleanIds(x.evidence_ids) }))
    .filter(x => x.evidence_ids.length > 0);

  const disagreements = [];

  for (const d of raw.disagreements || []) {
    const positions = (d.positions || [])
      .map(p => ({ ...p, evidence_ids: cleanIds(p.evidence_ids) }))
      .filter(p => String(p.statement || '').trim());

    const positionEvidence = unique(positions.flatMap(p => p.evidence_ids));
    const globalEvidence = cleanIds(d.evidence_ids);
    const evidenceIds = unique([...positionEvidence, ...globalEvidence]);

    const reasons = [];
    if (positions.length < 2) reasons.push('moins de deux positions');
    if (positions.some(p => p.grounding !== 'explicit')) {
      reasons.push('au moins une position est inférée ou produite par l’IA');
    }
    if (positions.some(p => p.evidence_ids.length < 1)) {
      reasons.push('au moins une position ne possède pas de preuve valide');
    }
    if (distinctContributionCount(positionEvidence) < 2) {
      reasons.push('les positions ne sont pas ancrées dans au moins deux contributions distinctes');
    }

    if (reasons.length === 0) {
      disagreements.push({ ...d, positions, evidence_ids: positionEvidence });
    } else if (evidenceIds.length > 0) {
      diagnostics.disagreements_demoted_to_tensions++;
      nonDisagreementTensions.push({
        key: `tension-${d.key}`,
        title: d.title,
        summary: d.summary,
        evidence_ids: evidenceIds,
        reason_not_disagreement: reasons.join(' ; ')
      });
    }
  }

  const cleanGrounded = (items = []) =>
    items
      .map(item => ({ ...item, evidence_ids: cleanIds(item.evidence_ids) }))
      .filter(item => item.evidence_ids.length > 0);

  const structuralSignals = cleanGrounded(raw.structural_signals || []);

  return {
    synthesis: {
      headline: raw.headline || 'Synthèse inter-contributions',
      emergent_topics: dedupeByKey(emergentTopics),
      single_contribution_observations: dedupeByKey(singleObservations),
      disagreements: dedupeByKey(disagreements),
      non_disagreement_tensions: dedupeByKey(nonDisagreementTensions),
      risks: dedupeByKey(cleanGrounded(raw.risks || [])),
      questions: dedupeByKey(cleanGrounded(raw.questions || [])),
      proposals: dedupeByKey(cleanGrounded(raw.proposals || [])),
      structural_signals: dedupeByKey(structuralSignals)
    },
    diagnostics,
    cleanEvidenceIds,
    distinctContributionCount
  };
}

export async function runCollectiveSynthesis(env) {
  const rawRows = await recentAnalyses(env);
  const rows = latestAnalysisPerContribution(rawRows || []);

  if (rows.length < 3) {
    return {
      skipped: true,
      reason: 'not_enough_contributions',
      contribution_count: rows.length,
      contributor_count_known: false
    };
  }

  const protocol = analysisProtocol(env);
  const provider = analysisProvider(env);
  const model = analysisModel(env);
  const fingerprint = corpusFingerprint(rows);
  const analysisIds = synthesisAnalysisIds(rows);
  const contributionIds = synthesisContributionIds(rows);
  const analysisProvenance = synthesisAnalysisProvenance(rows);

  const alreadyExists = await existingSynthesis(
    env,
    protocol,
    provider,
    model,
    fingerprint
  );

  if (alreadyExists) {
    return {
      skipped: true,
      reason: 'already_synthesized',
      synthesis_id: alreadyExists.public_id,
      protocol_version: protocol,
      provider,
      model,
      corpus_fingerprint: fingerprint,
      contribution_count: rows.length,
      contributor_count_known: false
    };
  }

  const payload = rows.map(r => ({
    analysis_id: r.public_id,
    analysis_protocol_version: r.protocol_version,
    analysis_provider: r.provider,
    analysis_model: r.model,
    contribution: r.contributions,
    analysis: r.content
  }));

  const rawSynthesis = await analyzeCollectiveAI(env, COLLECTIVE_PROMPT, payload);
  const {
    synthesis,
    diagnostics,
    distinctContributionCount
  } = sanitizeCollectiveSynthesis(rawSynthesis, rows);

  const synthesisRow = (
    await insert(env, 'collective_syntheses', {
      public_id: pid('S'),
      provider,
      model,
      protocol_version: protocol,
      content: synthesis,
      analysis_ids: analysisIds,
      contribution_ids: contributionIds,
      contribution_count: rows.length,
      contributor_count: null,
      contributor_count_known: false,
      corpus_fingerprint: fingerprint,
      analysis_provenance: analysisProvenance
    })
  )?.[0];

  const sourceSynthesisId = synthesisRow?.id || null;
  const now = () => new Date().toISOString();
  const storageKey = conceptKey =>
    versionedConceptKey(protocol, provider, model, conceptKey);

  for (const t of synthesis.emergent_topics || []) {
    if (distinctContributionCount(t.evidence_ids) < 2) continue;

    await upsert(env, 'themes', 'canonical_key', {
      canonical_key: t.key,
      label: t.label,
      description: t.synthesis,
      description_source_synthesis_id: sourceSynthesisId,
      description_protocol_version: protocol,
      description_provider: provider,
      description_model: model,
      updated_at: now()
    });
  }

  let promotedDisagreements = 0;
  for (const d of synthesis.disagreements || []) {
    const positions = d.positions || [];
    if (
      positions.length < 2 ||
      positions.some(p => p.grounding !== 'explicit' || !(p.evidence_ids || []).length) ||
      distinctContributionCount(positions.flatMap(p => p.evidence_ids || [])) < 2
    ) {
      continue;
    }

    await upsert(env, 'disagreements', 'canonical_key', {
      public_id: pid('D'),
      concept_key: d.key,
      canonical_key: storageKey(d.key),
      origin_protocol_version: protocol,
      origin_provider: provider,
      origin_model: model,
      source_synthesis_id: sourceSynthesisId,
      title: d.title,
      summary: d.summary,
      positions: positions.map(p => p.statement),
      position_provenance: positions,
      evidence_ids: unique(positions.flatMap(p => p.evidence_ids || [])),
      status: 'open',
      updated_at: now()
    });
    promotedDisagreements++;
  }

  let promotedRisks = 0;
  for (const r of synthesis.risks || []) {
    if (r.grounding !== 'explicit_in_corpus') continue;

    await upsert(env, 'risks', 'canonical_key', {
      public_id: pid('R'),
      concept_key: r.key,
      canonical_key: storageKey(r.key),
      origin_protocol_version: protocol,
      origin_provider: provider,
      origin_model: model,
      source_synthesis_id: sourceSynthesisId,
      grounding: r.grounding,
      title: r.title,
      summary: r.summary,
      evidence_ids: r.evidence_ids,
      status: 'open',
      updated_at: now()
    });
    promotedRisks++;
  }

  let promotedQuestions = 0;
  for (const q of synthesis.questions || []) {
    if (q.grounding !== 'explicit_in_corpus') continue;

    await upsert(env, 'questions', 'canonical_key', {
      public_id: pid('Q'),
      concept_key: q.key,
      canonical_key: storageKey(q.key),
      origin_protocol_version: protocol,
      origin_provider: provider,
      origin_model: model,
      source_synthesis_id: sourceSynthesisId,
      grounding: q.grounding,
      question: q.question,
      evidence_ids: q.evidence_ids,
      status: 'open',
      updated_at: now()
    });
    promotedQuestions++;
  }

  let promotedProposals = 0;
  for (const p of synthesis.proposals || []) {
    if (p.grounding !== 'explicit_in_corpus') continue;

    await upsert(env, 'proposals', 'canonical_key', {
      public_id: pid('P'),
      concept_key: p.key,
      canonical_key: storageKey(p.key),
      origin_protocol_version: protocol,
      origin_provider: provider,
      origin_model: model,
      source_synthesis_id: sourceSynthesisId,
      grounding: p.grounding,
      proposal_type: p.type,
      title: p.title,
      summary: p.summary,
      counterargument: p.counterargument,
      evidence_ids: p.evidence_ids,
      status: 'open',
      source: 'collective_synthesis',
      updated_at: now()
    });
    promotedProposals++;
  }

  let structuralSignalCount = 0;
  for (const s of synthesis.structural_signals || []) {
    await upsert(env, 'structural_signals', 'canonical_key', {
      public_id: pid('SIG'),
      concept_key: s.key,
      canonical_key: storageKey(s.key),
      signal_type: s.signal_type,
      title: s.title,
      summary: s.summary,
      why_structural: s.why_structural,
      strongest_counterargument: s.strongest_counterargument,
      unresolved_uncertainties: s.unresolved_uncertainties || [],
      evidence_ids: s.evidence_ids,
      origin_protocol_version: protocol,
      origin_provider: provider,
      origin_model: model,
      source_synthesis_id: sourceSynthesisId,
      status: 'open',
      updated_at: now()
    });
    structuralSignalCount++;
  }

  await logEvent(
    env,
    'collective_synthesis',
    `Une synthèse inter-contributions ${synthesisRow?.public_id || ''} a été produite à partir de ${rows.length} contributions.`,
    {
      synthesis_id: synthesisRow?.public_id || null,
      protocol_version: protocol,
      provider,
      model,
      headline: synthesis.headline,
      analysis_ids: analysisIds,
      analysis_provenance: analysisProvenance,
      contribution_ids: contributionIds,
      contribution_count: rows.length,
      contributor_count: null,
      contributor_count_known: false,
      corpus_fingerprint: fingerprint,
      methodological_note:
        'Le nombre de contributions analysées ne permet pas de connaître le nombre de personnes distinctes qui les ont produites.',
      epistemic_filter: diagnostics,
      promoted_objects: {
        disagreements: promotedDisagreements,
        risks: promotedRisks,
        questions: promotedQuestions,
        proposals: promotedProposals,
        structural_signals: structuralSignalCount
      }
    }
  );

  return {
    skipped: false,
    synthesis_id: synthesisRow?.public_id || null,
    protocol_version: protocol,
    provider,
    model,
    corpus_fingerprint: fingerprint,
    analysis_ids: analysisIds,
    analysis_provenance: analysisProvenance,
    contribution_ids: contributionIds,
    contribution_count: rows.length,
    contributor_count: null,
    contributor_count_known: false,
    epistemic_filter: diagnostics,
    synthesis
  };
}

export async function retryPending(env, limit = 12) {
  const rows = await sb(
    env,
    `contributions?status=in.(pending_analysis,processing_error)` +
    `&select=*&order=created_at.asc&limit=${limit}`
  );

  for (const c of rows || []) {
    try {
      await processContribution(env, c);
    } catch (_) {
      // L'erreur a déjà été journalisée.
    }
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
      const root = base.replace(/\/$/, '');
      const metaRes = await fetch(`${root}/.well-known/coexistence.json`);
      if (!metaRes.ok) continue;

      const meta = await metaRes.json();

      await upsert(env, 'federated_instances', 'instance_id', {
        instance_id: meta.instance_id,
        base_url: base,
        protocol_version: meta.protocol_version || 'unknown',
        trust_status: 'unverified',
        last_seen_at: new Date().toISOString()
      });

      const eventsRes = await fetch(`${root}/api/federation/events?limit=100`);
      if (!eventsRes.ok) continue;

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
    } catch (_) {
      // Une instance distante indisponible ne doit pas bloquer l'instance locale.
    }
  }

  return imported;
}
