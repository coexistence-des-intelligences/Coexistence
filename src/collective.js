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

import {
  obviousPrivacyRisk
} from './security.js';


function pid(prefix) {
  return `${prefix}-${crypto.randomUUID()
    .replaceAll('-', '')
    .slice(0, 8)
    .toUpperCase()}`;
}


async function logEvent(
  env,
  type,
  summary,
  details = {},
  visibility = 'public'
) {
  try {
    await insert(
      env,
      'events',
      {
        public_id: pid('E'),

        instance_id:
          env.INSTANCE_ID || 'local',

        event_type: type,

        public_summary: summary,

        details,

        visibility
      },
      false
    );
  } catch (_) {
    /*
     * Le journal ne doit jamais empêcher
     * le fonctionnement principal.
     */
  }
}


/* ============================================================
   OUTILS DE VERSIONNEMENT ET DE PROVENANCE
   ============================================================ */

function analysisProtocol(env) {
  return (
    env.ANALYSIS_PROTOCOL_VERSION ||
    '0.1'
  );
}


function versionedConceptKey(
  protocol,
  conceptKey
) {
  return `${protocol}::${conceptKey}`;
}


/*
 * Le fingerprint décrit uniquement
 * l'ensemble des ANALYSES utilisées.
 *
 * Il ne fingerprint aucune personne,
 * aucun navigateur et aucun appareil.
 */
function corpusFingerprint(rows = []) {
  return rows
    .map(row => row.public_id)
    .filter(Boolean)
    .sort()
    .join('|');
}


function synthesisAnalysisIds(
  rows = []
) {
  return rows
    .map(row => row.public_id)
    .filter(Boolean)
    .sort();
}


function synthesisContributionIds(
  rows = []
) {
  return rows
    .map(
      row =>
        row?.contributions?.public_id
    )
    .filter(Boolean)
    .sort();
}


async function existingSynthesis(
  env,
  protocol,
  fingerprint
) {
  if (!fingerprint) {
    return null;
  }

  try {
    const rows = await sb(
      env,
      `collective_syntheses?` +
      `protocol_version=eq.${encodeURIComponent(protocol)}` +
      `&corpus_fingerprint=eq.${encodeURIComponent(fingerprint)}` +
      `&select=id,public_id,protocol_version,created_at` +
      `&limit=1`
    );

    return rows?.[0] || null;

  } catch (_) {
    /*
     * Si cette vérification échoue,
     * la contrainte UNIQUE en base reste
     * un second niveau de protection.
     */
    return null;
  }
}


/* ============================================================
   RELATIONS SÉMANTIQUES ENTRE CONTRIBUTIONS
   ============================================================ */

async function relatedContributions(
  env,
  embedding,
  excludeId
) {
  if (!embedding) {
    return [];
  }

  try {
    const rows = await rpc(
      env,
      'match_contributions',
      {
        query_embedding:
          vectorLiteral(embedding),

        match_count: 8,

        exclude_id:
          excludeId
      }
    );

    return (rows || []).map(r => ({
      public_id:
        r.public_id,

      title:
        r.title,

      summary:
        r.summary,

      similarity:
        r.similarity
    }));

  } catch (_) {
    return [];
  }
}


/* ============================================================
   ANALYSE INDIVIDUELLE
   ============================================================ */

async function upsertAnalysisEntities(
  env,
  contribution,
  analysis
) {
  /*
   * Une analyse individuelle enrichit
   * uniquement la cartographie du corpus.
   *
   * Elle ne crée pas directement :
   *
   * - désaccord structuré ;
   * - risque structuré ;
   * - question du corpus ;
   * - proposition à examiner.
   *
   * Les candidats restent conservés
   * dans le JSON de l'analyse individuelle.
   */

  for (const t of analysis.themes || []) {
    const rows = await upsert(
      env,
      'themes',
      'canonical_key',
      {
        canonical_key:
          t.key,

        label:
          t.label,

        updated_at:
          new Date().toISOString()
      }
    );

    const theme = rows?.[0];

    if (theme?.id) {
      await upsert(
        env,
        'contribution_themes',
        'contribution_id,theme_id',
        {
          contribution_id:
            contribution.id,

          theme_id:
            theme.id,

          confidence:
            t.confidence
        }
      );
    }
  }


  /*
   * Relation entre contributions.
   *
   * IMPORTANT :
   * deux contributions reliées
   * ne signifient jamais automatiquement
   * deux personnes différentes.
   */

  for (
    const rel
    of analysis.related_contributions || []
  ) {
    const targets = await sb(
      env,
      `contributions?public_id=eq.${encodeURIComponent(
        rel.public_id
      )}&status=eq.published&select=id&limit=1`
    );

    if (targets?.[0]?.id) {
      await upsert(
        env,
        'contribution_relations',
        'source_contribution_id,target_contribution_id,relation_type',
        {
          source_contribution_id:
            contribution.id,

          target_contribution_id:
            targets[0].id,

          relation_type:
            rel.relation,

          explanation:
            rel.explanation
        }
      );
    }
  }
}


export async function processContribution(
  env,
  contribution
) {
  try {
    const embedding =
      await createEmbedding(
        env,
        contribution.summary
      );


    if (embedding) {
      await update(
        env,
        'contributions',
        `id=eq.${contribution.id}`,
        {
          embedding:
            vectorLiteral(embedding)
        }
      );
    }


    const related =
      await relatedContributions(
        env,
        embedding,
        contribution.id
      );


    const analysis =
      await analyzeContributionAI(
        env,
        ANALYSIS_PROMPT,
        {
          contribution: {
            public_id:
              contribution.public_id,

            title:
              contribution.title,

            summary:
              contribution.summary,

            nature:
              contribution.nature,

            open_question:
              contribution.open_question
          },

          potentially_related_public_contributions:
            related
        }
      );


    const analysisRow =
      (
        await insert(
          env,
          'analyses',
          {
            public_id:
              pid('A'),

            contribution_id:
              contribution.id,

            model:
              env.OPENAI_ANALYSIS_MODEL ||
              'gpt-5-mini',

            protocol_version:
              analysisProtocol(env),

            content:
              analysis,

            status:
              'active'
          }
        )
      )?.[0];


    const review =
      obviousPrivacyRisk(
        `${contribution.title}\n${contribution.summary}`
      )
      ||
      analysis.publication_risk?.level ===
        'review';


    const newStatus =
      review
        ? 'quarantined'
        : 'published';


    await update(
      env,
      'contributions',
      `id=eq.${contribution.id}`,
      {
        status:
          newStatus,

        publication_note:
          review
            ? (
                analysis.publication_risk
                  ?.reasons ||
                ['privacy']
              ).join(', ')
            : null,

        processed_at:
          new Date().toISOString()
      }
    );


    if (!review) {
      await upsertAnalysisEntities(
        env,
        contribution,
        analysis
      );


      await logEvent(
        env,
        'contribution_published',

        `${contribution.public_id} a rejoint le corpus public.`,

        {
          contribution_id:
            contribution.public_id,

          analysis_id:
            analysisRow?.public_id ||
            null,

          analysis_protocol:
            analysisProtocol(env),

          themes:
            (analysis.themes || [])
              .map(x => x.key),

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
          contribution_id:
            contribution.public_id,

          reasons:
            analysis.publication_risk
              ?.reasons ||
            ['privacy']
        }
      );
    }


    return {
      status:
        newStatus,

      analysis
    };

  } catch (err) {
    await update(
      env,
      'contributions',
      `id=eq.${contribution.id}`,
      {
        status:
          'processing_error',

        publication_note:
          'Erreur de traitement automatique'
      }
    ).catch(() => {});


    await logEvent(
      env,
      'processing_error',

      `Une contribution n'a pas pu être traitée automatiquement.`,

      {
        contribution_id:
          contribution.public_id,

        error:
          String(
            err.message || err
          ).slice(0, 300)
      },

      'internal'
    );


    throw err;
  }
}


/* ============================================================
   SYNTHÈSE INTER-CONTRIBUTIONS
   ============================================================ */

async function recentAnalyses(env) {
  return sb(
    env,
    'analyses?' +
    'select=public_id,created_at,content,' +
    'contributions!inner(public_id,title,summary,status)' +
    '&status=eq.active' +
    '&contributions.status=eq.published' +
    '&order=created_at.desc' +
    '&limit=80'
  );
}


/*
 * Si une même contribution possède plusieurs analyses,
 * seule son analyse active la plus récente est utilisée
 * pour la synthèse inter-contributions.
 */
function latestAnalysisPerContribution(
  rows = []
) {
  const byContribution =
    new Map();


  /*
   * recentAnalyses() renvoie les analyses
   * de la plus récente à la plus ancienne.
   */

  for (const row of rows) {
    const contributionId =
      row?.contributions?.public_id;


    if (
      !contributionId ||
      byContribution.has(
        contributionId
      )
    ) {
      continue;
    }


    byContribution.set(
      contributionId,
      row
    );
  }


  return [
    ...byContribution.values()
  ];
}


/*
 * Les evidence_ids désignent des ANALYSES.
 *
 * Ils permettent de relier une conclusion
 * à sa matière d'origine.
 *
 * Ils ne constituent aucune preuve
 * d'identité ou d'indépendance entre personnes.
 */
function evidenceTools(rows = []) {
  const analysisToContribution =
    new Map(
      rows.map(row => [
        row.public_id,
        row?.contributions?.public_id ||
        null
      ])
    );


  const validAnalysisIds =
    new Set(
      analysisToContribution.keys()
    );


  const cleanEvidenceIds =
    (ids = []) => [
      ...new Set(
        (ids || []).filter(
          id =>
            validAnalysisIds.has(id)
        )
      )
    ];


  const distinctContributionCount =
    (ids = []) => {
      const contributions =
        new Set();


      for (
        const id
        of cleanEvidenceIds(ids)
      ) {
        const contributionId =
          analysisToContribution.get(id);


        if (contributionId) {
          contributions.add(
            contributionId
          );
        }
      }


      return contributions.size;
    };


  return {
    cleanEvidenceIds,
    distinctContributionCount
  };
}


export async function runCollectiveSynthesis(
  env
) {
  const rawRows =
    await recentAnalyses(env);


  const rows =
    latestAnalysisPerContribution(
      rawRows || []
    );


  /*
   * DÉCISION PROVISOIRE
   *
   * Minimum actuel :
   * trois CONTRIBUTIONS.
   *
   * Cela ne signifie jamais
   * trois personnes distinctes.
   */

  if (rows.length < 3) {
    return {
      skipped: true,

      reason:
        'not_enough_contributions',

      contribution_count:
        rows.length,

      contributor_count_known:
        false
    };
  }


  const protocol =
    analysisProtocol(env);


  const fingerprint =
    corpusFingerprint(rows);


  const analysisIds =
    synthesisAnalysisIds(rows);


  const contributionIds =
    synthesisContributionIds(rows);


  /*
   * IDEMPOTENCE
   *
   * Même matière + même protocole
   * = aucune raison de demander une nouvelle
   * synthèse à l'IA.
   */

  const alreadyExists =
    await existingSynthesis(
      env,
      protocol,
      fingerprint
    );


  if (alreadyExists) {
    return {
      skipped: true,

      reason:
        'already_synthesized',

      synthesis_id:
        alreadyExists.public_id,

      protocol_version:
        protocol,

      corpus_fingerprint:
        fingerprint,

      contribution_count:
        rows.length,

      contributor_count_known:
        false
    };
  }


  const payload =
    rows.map(r => ({
      analysis_id:
        r.public_id,

      contribution:
        r.contributions,

      analysis:
        r.content
    }));


  const synthesis =
    await analyzeCollectiveAI(
      env,
      COLLECTIVE_PROMPT,
      payload
    );


  const {
    cleanEvidenceIds,
    distinctContributionCount
  } =
    evidenceTools(rows);


  /*
   * Nous conservons le nom historique
   * collective_syntheses dans le schéma,
   * mais son sens public est :
   *
   * SYNTHÈSE INTER-CONTRIBUTIONS.
   */

  const synthesisRow =
    (
      await insert(
        env,
        'collective_syntheses',
        {
          public_id:
            pid('S'),

          model:
            env.OPENAI_ANALYSIS_MODEL ||
            'gpt-5-mini',

          protocol_version:
            protocol,

          content:
            synthesis,

          analysis_ids:
            analysisIds,

          contribution_ids:
            contributionIds,

          contribution_count:
            rows.length,

          contributor_count:
            null,

          contributor_count_known:
            false,

          corpus_fingerprint:
            fingerprint
        }
      )
    )?.[0];


  /*
   * Tous les objets structurés produits
   * ci-dessous gardent une référence
   * vers la synthèse qui les a produits.
   */

  const sourceSynthesisId =
    synthesisRow?.id ||
    null;


  /* ==========================================================
     THÈMES INTER-CONTRIBUTIONS
     ========================================================== */

  for (
    const t
    of synthesis.emergent_topics || []
  ) {
    const evidenceIds =
      cleanEvidenceIds(
        t.evidence_ids
      );


    /*
     * Deux CONTRIBUTIONS distinctes minimum.
     *
     * Toujours aucune inférence
     * sur le nombre de personnes.
     */

    if (
      distinctContributionCount(
        evidenceIds
      ) < 2
    ) {
      continue;
    }


    await upsert(
      env,
      'themes',
      'canonical_key',
      {
        canonical_key:
          t.key,

        label:
          t.label,

        description:
          t.synthesis,

        updated_at:
          new Date().toISOString()
      }
    );
  }


  /* ==========================================================
     DÉSACCORDS ENTRE CONTRIBUTIONS / POSITIONS
     ========================================================== */

  for (
    const d
    of synthesis.disagreements || []
  ) {
    const evidenceIds =
      cleanEvidenceIds(
        d.evidence_ids
      );


    const positions =
      (d.positions || [])
        .filter(Boolean);


    if (
      positions.length < 2
    ) {
      continue;
    }


    if (
      distinctContributionCount(
        evidenceIds
      ) < 2
    ) {
      continue;
    }


    const conceptKey =
      d.key;


    await upsert(
      env,
      'disagreements',
      'canonical_key',
      {
        public_id:
          pid('D'),

        concept_key:
          conceptKey,

        canonical_key:
          versionedConceptKey(
            protocol,
            conceptKey
          ),

        origin_protocol_version:
          protocol,

        source_synthesis_id:
          sourceSynthesisId,

        title:
          d.title,

        summary:
          d.summary,

        positions,

        evidence_ids:
          evidenceIds,

        status:
          'open',

        updated_at:
          new Date().toISOString()
      }
    );
  }


  /* ==========================================================
     RISQUES SIGNALÉS
     ========================================================== */

  for (
    const r
    of synthesis.risks || []
  ) {
    const evidenceIds =
      cleanEvidenceIds(
        r.evidence_ids
      );


    if (
      evidenceIds.length < 1
    ) {
      continue;
    }


    const conceptKey =
      r.key;


    await upsert(
      env,
      'risks',
      'canonical_key',
      {
        public_id:
          pid('R'),

        concept_key:
          conceptKey,

        canonical_key:
          versionedConceptKey(
            protocol,
            conceptKey
          ),

        origin_protocol_version:
          protocol,

        source_synthesis_id:
          sourceSynthesisId,

        title:
          r.title,

        summary:
          r.summary,

        evidence_ids:
          evidenceIds,

        status:
          'open',

        updated_at:
          new Date().toISOString()
      }
    );
  }


  /* ==========================================================
     QUESTIONS DU CORPUS
     ========================================================== */

  for (
    const q
    of synthesis.questions || []
  ) {
    const evidenceIds =
      cleanEvidenceIds(
        q.evidence_ids
      );


    if (
      evidenceIds.length < 1
    ) {
      continue;
    }


    const conceptKey =
      q.key;


    await upsert(
      env,
      'questions',
      'canonical_key',
      {
        public_id:
          pid('Q'),

        concept_key:
          conceptKey,

        canonical_key:
          versionedConceptKey(
            protocol,
            conceptKey
          ),

        origin_protocol_version:
          protocol,

        source_synthesis_id:
          sourceSynthesisId,

        question:
          q.question,

        evidence_ids:
          evidenceIds,

        status:
          'open',

        updated_at:
          new Date().toISOString()
      }
    );
  }


  /* ==========================================================
     PROPOSITIONS À EXAMINER
     ========================================================== */

  for (
    const p
    of synthesis.proposals || []
  ) {
    const evidenceIds =
      cleanEvidenceIds(
        p.evidence_ids
      );


    if (
      evidenceIds.length < 1
    ) {
      continue;
    }


    const conceptKey =
      p.key;


    await upsert(
      env,
      'proposals',
      'canonical_key',
      {
        public_id:
          pid('P'),

        concept_key:
          conceptKey,

        canonical_key:
          versionedConceptKey(
            protocol,
            conceptKey
          ),

        origin_protocol_version:
          protocol,

        source_synthesis_id:
          sourceSynthesisId,

        proposal_type:
          p.type,

        title:
          p.title,

        summary:
          p.summary,

        counterargument:
          p.counterargument,

        evidence_ids:
          evidenceIds,

        status:
          'open',

        /*
         * Nom technique historique conservé.
         * Il ne signifie aucune adoption
         * par une collectivité humaine.
         */
        source:
          'collective_synthesis',

        updated_at:
          new Date().toISOString()
      }
    );
  }


  /* ==========================================================
     CANDIDAT DE VERSION
     ========================================================== */

  if (
    synthesis.version_candidate
      ?.justified
  ) {
    const v =
      synthesis.version_candidate;


    const evidenceIds =
      cleanEvidenceIds(
        v.evidence_ids
      );


    if (
      evidenceIds.length > 0
    ) {
      const rawConceptKey =
        `version-${
          v.label ||
          'candidate'
        }`;


      await upsert(
        env,
        'proposals',
        'canonical_key',
        {
          public_id:
            pid('P'),

          concept_key:
            rawConceptKey,

          canonical_key:
            versionedConceptKey(
              protocol,
              rawConceptKey
            ),

          origin_protocol_version:
            protocol,

          source_synthesis_id:
            sourceSynthesisId,

          proposal_type:
            'version_candidate',

          title:
            `Candidat ${
              v.label ||
              'nouvelle version'
            }`,

          summary:
            v.reason,

          counterargument:
            (
              v.unresolved_objections ||
              []
            ).join(' | '),

          evidence_ids:
            evidenceIds,

          payload: {
            ...v,

            evidence_ids:
              evidenceIds
          },

          status:
            'open',

          source:
            'collective_synthesis',

          updated_at:
            new Date().toISOString()
        }
      );
    }
  }


  /* ==========================================================
     JOURNAL
     ========================================================== */

  await logEvent(
    env,
    'collective_synthesis',

    `Une synthèse inter-contributions ${synthesisRow?.public_id || ''} a été produite à partir de ${rows.length} contributions.`,

    {
      synthesis_id:
        synthesisRow?.public_id ||
        null,

      protocol_version:
        protocol,

      headline:
        synthesis.headline,

      analysis_ids:
        analysisIds,

      contribution_ids:
        contributionIds,

      contribution_count:
        rows.length,

      contributor_count:
        null,

      contributor_count_known:
        false,

      corpus_fingerprint:
        fingerprint,

      methodological_note:
        'Le nombre de contributions analysées ne permet pas de connaître le nombre de personnes distinctes qui les ont produites.',

      version_candidate:
        !!synthesis.version_candidate
          ?.justified
    }
  );


  return {
    skipped:
      false,

    synthesis_id:
      synthesisRow?.public_id ||
      null,

    protocol_version:
      protocol,

    corpus_fingerprint:
      fingerprint,

    analysis_ids:
      analysisIds,

    contribution_ids:
      contributionIds,

    contribution_count:
      rows.length,

    contributor_count:
      null,

    contributor_count_known:
      false,

    synthesis
  };
}


/* ============================================================
   REPRISE AUTOMATIQUE DES TRAITEMENTS EN ERREUR
   ============================================================ */

export async function retryPending(
  env,
  limit = 12
) {
  const rows =
    await sb(
      env,
      `contributions?status=in.(pending_analysis,processing_error)&select=*&order=created_at.asc&limit=${limit}`
    );


  for (
    const c
    of rows || []
  ) {
    try {
      await processContribution(
        env,
        c
      );
    } catch (_) {
      /*
       * L'erreur a déjà été enregistrée.
       */
    }
  }


  return rows?.length || 0;
}


/* ============================================================
   FÉDÉRATION
   ============================================================ */

export async function syncFederationPeers(
  env
) {
  let peers = [];


  try {
    peers =
      JSON.parse(
        env.FEDERATION_PEERS ||
        '[]'
      );
  } catch (_) {
    return 0;
  }


  let imported = 0;


  for (
    const base
    of peers.slice(0, 20)
  ) {
    try {
      const metaRes =
        await fetch(
          `${base.replace(
            /\/$/,
            ''
          )}/.well-known/coexistence.json`
        );


      if (!metaRes.ok) {
        continue;
      }


      const meta =
        await metaRes.json();


      await upsert(
        env,
        'federated_instances',
        'instance_id',
        {
          instance_id:
            meta.instance_id,

          base_url:
            base,

          protocol_version:
            meta.protocol_version ||
            'unknown',

          trust_status:
            'unverified',

          last_seen_at:
            new Date().toISOString()
        }
      );


      const eventsRes =
        await fetch(
          `${base.replace(
            /\/$/,
            ''
          )}/api/federation/events?limit=100`
        );


      if (!eventsRes.ok) {
        continue;
      }


      const packet =
        await eventsRes.json();


      for (
        const event
        of packet.events || []
      ) {
        await upsert(
          env,
          'federated_events',
          'origin_instance_id,origin_event_id',
          {
            origin_instance_id:
              meta.instance_id,

            origin_event_id:
              event.public_id,

            payload:
              event,

            verification_status:
              'unverified'
          }
        );


        imported++;
      }

    } catch (_) {
      /*
       * Une instance distante indisponible
       * ne doit pas empêcher le fonctionnement
       * de l'instance locale.
       */
    }
  }


  return imported;
}
