import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analysisSchema, collectiveSchema } from '../src/schemas.js';
import {
  CHAT_PROMPT,
  ANALYSIS_PROMPT,
  COLLECTIVE_PROMPT
} from '../src/prompts.js';
import { assertSupportedAnalysisProvider } from '../src/openai.js';
import { sanitizeCollectiveSynthesis } from '../src/collective.js';

const workerSource =
  readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');

const migration006 =
  readFileSync(
    new URL('../database/006_analysis_protocol_0_4.sql', import.meta.url),
    'utf8'
  );

const publicInterface =
  readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

const projectState =
  readFileSync(
    new URL('../docs/understanding/PROJECT_STATE.md', import.meta.url),
    'utf8'
  );

const decisionLog =
  readFileSync(
    new URL('../docs/understanding/DECISION_LOG.md', import.meta.url),
    'utf8'
  );

assert.equal(
  Object.prototype.hasOwnProperty.call(collectiveSchema.properties, 'version_candidate'),
  false,
  'Le protocole 0.4 ne doit plus exposer version_candidate.'
);

for (const requiredField of [
  'single_contribution_observations',
  'non_disagreement_tensions',
  'structural_signals'
]) {
  assert.ok(
    collectiveSchema.properties[requiredField],
    `Champ collectif manquant : ${requiredField}`
  );
}

const collectivePosition =
  collectiveSchema.properties.disagreements.items.properties.positions.items.properties;

assert.ok(collectivePosition.grounding, 'Chaque position doit porter un grounding.');
assert.ok(collectivePosition.evidence_ids, 'Chaque position doit porter ses propres evidence_ids.');
assert.deepEqual(
  collectivePosition.grounding.enum,
  ['explicit'],
  'Un désaccord collectif ne peut contenir que des positions explicites.'
);

assert.equal(
  collectiveSchema.properties.emergent_topics.items.properties.evidence_ids.minItems,
  2,
  'Un thème émergent doit exiger au moins deux preuves.'
);

assert.equal(
  collectiveSchema.properties.single_contribution_observations.items.properties.evidence_ids.maxItems,
  1,
  'Une observation mono-contribution doit porter exactement une preuve.'
);

const tensionPosition =
  collectiveSchema.properties.non_disagreement_tensions.items.properties.positions.items.properties;

assert.deepEqual(
  tensionPosition.grounding.enum,
  ['explicit', 'inferred', 'ai_counterargument'],
  'Une tension analytique doit conserver la provenance de chaque position.'
);

assert.ok(
  collectiveSchema.properties.structural_signals.items.properties.grounding,
  'Chaque signal structurel doit porter sa provenance épistémique.'
);

assert.match(
  workerSource,
  /countRows\(env, 'themes', 'description_source_synthesis_id=not\.is\.null'\)/,
  'Le tableau public ne doit compter comme thèmes que les thèmes multi-contributions.'
);

assert.match(
  migration006,
  /grounding text not null\s+check \(grounding in \(\s*'explicit_in_corpus',\s*'inferred_by_ai',\s*'mixed'/,
  'La migration doit contraindre la provenance des signaux structurels.'
);

const individualPosition =
  analysisSchema.properties.disagreement_candidate.properties.positions.items.properties;

assert.ok(individualPosition.grounding, 'Le candidat individuel doit distinguer explicit/inferred/ai_counterargument.');
assert.ok(individualPosition.source_contribution_ids, 'Le candidat individuel doit porter sa provenance contributionnelle.');

const individualTheme =
  analysisSchema.properties.themes.items.properties;

assert.ok(individualTheme.grounding, 'Chaque thème individuel doit porter un grounding.');
assert.ok(individualTheme.source_contribution_ids, 'Chaque thème individuel doit citer sa contribution source.');

assert.match(
  ANALYSIS_PROMPT,
  /Implicitement soutenu.*inferred/i,
  'Le prompt individuel doit interdire de qualifier une position implicite comme explicite.'
);

assert.doesNotMatch(
  CHAT_PROMPT,
  /jamais à recruter ni convaincre/i,
  'Le dialogue ne doit pas présenter le contre-argument comme une tentative de convaincre.'
);

assert.match(
  CHAT_PROMPT,
  /conclusion prédéterminée/i,
  'Le dialogue doit interdire de conduire la personne vers une conclusion prédéterminée.'
);

assert.doesNotMatch(
  COLLECTIVE_PROMPT,
  /CANDIDAT DE VERSION/i,
  'Le moteur collectif ne doit plus contenir de section de candidat de version.'
);

assert.match(
  COLLECTIVE_PROMPT,
  /structural_signals/i,
  'Le moteur collectif doit produire des signaux structurels non décisionnels.'
);

assert.match(
  migration006,
  /where s\.protocol_version = '0\.3'/,
  'La reclassification des thèmes 0.3 doit fonctionner sur une instance répliquée.'
);

assert.match(
  migration006,
  /historical_case_present_on_instance', v_historical_case_exists/,
  'Le journal doit distinguer un cas historique réellement présent d’une référence absente.'
);

assert.match(
  migration006,
  /and exists \(\s*select 1\s*from public\.collective_syntheses\s*where public_id = 'S-56389CD6'/,
  'Une preuve propre à l’instance d’origine ne doit être ajoutée que si elle existe localement.'
);

assert.match(
  publicInterface,
  /PRÉSENT · RÈGLE PROVISOIRE[\s\S]*?Protocole d’analyse 0\.4/,
  'L’interface doit présenter 0.4 comme techniquement actif sans le dire ratifié.'
);

assert.match(
  projectState,
  /Techniquement actif, mais non ratifié/,
  'Le document d’état doit distinguer activation technique et ratification.'
);

assert.match(
  decisionLog,
  /D-009[\s\S]*?intégré dans l’interface publique/,
  'Le journal des décisions doit refléter l’intégration de la compréhension progressive.'
);

assert.match(
  COLLECTIVE_PROMPT,
  /au moins DEUX contributions distinctes/i,
  'Le prompt doit imposer une règle explicite avant tout vocabulaire de récurrence.'
);

assert.equal(
  assertSupportedAnalysisProvider({ ANALYSIS_PROVIDER: 'OpenAI' }),
  'openai',
  'Le fournisseur OpenAI doit être normalisé et accepté.'
);

assert.throws(
  () => assertSupportedAnalysisProvider({ ANALYSIS_PROVIDER: 'mistral' }),
  /non pris en charge/i,
  'Un fournisseur sans adaptateur ne doit jamais produire une provenance trompeuse.'
);

const rows = [
  { public_id: 'A-1', contributions: { public_id: 'C-1' } },
  { public_id: 'A-1B', contributions: { public_id: 'C-1' } },
  { public_id: 'A-2', contributions: { public_id: 'C-2' } },
  { public_id: 'A-3', contributions: { public_id: 'C-3' } }
];

const rawSynthesis = {
  headline: 'Test du contrat 0.4',
  emergent_topics: [
    {
      key: 'topic-mono',
      label: 'Thème isolé',
      synthesis: 'Présent dans une seule contribution.',
      evidence_ids: ['A-3']
    },
    {
      key: 'topic-two-analyses-one-contribution',
      label: 'Deux analyses, une contribution',
      synthesis: 'Ne doit pas devenir un thème multi-contributions.',
      evidence_ids: ['A-1', 'A-1B']
    }
  ],
  single_contribution_observations: [
    {
      key: 'observation-multi',
      label: 'Observation récurrente',
      summary: 'Présente dans deux contributions.',
      evidence_ids: ['A-1', 'A-2']
    }
  ],
  disagreements: [
    {
      key: 'disagreement-valid',
      title: 'Désaccord explicite',
      summary: 'Deux positions explicites sont présentes.',
      positions: [
        { statement: 'Position A', grounding: 'explicit', evidence_ids: ['A-1'] },
        { statement: 'Position B', grounding: 'explicit', evidence_ids: ['A-2'] }
      ],
      evidence_ids: ['A-1', 'A-2']
    },
    {
      key: 'disagreement-inferred',
      title: 'Opposition reconstruite',
      summary: 'Une position a été inférée par l’IA.',
      positions: [
        { statement: 'Position explicite', grounding: 'explicit', evidence_ids: ['A-1'] },
        { statement: 'Position reconstruite', grounding: 'inferred', evidence_ids: ['A-2'] }
      ],
      evidence_ids: ['A-1', 'A-2', 'A-INCONNU']
    }
  ],
  non_disagreement_tensions: [],
  risks: [],
  questions: [],
  proposals: [],
  structural_signals: [
    {
      key: 'signal-test',
      signal_type: 'methodology',
      title: 'Signal test',
      summary: 'Signal non décisionnel.',
      grounding: 'inferred_by_ai',
      why_structural: 'Il concerne la méthode.',
      strongest_counterargument: 'Le signal peut être trop précoce.',
      unresolved_uncertainties: ['Matière encore limitée.'],
      evidence_ids: ['A-1', 'A-INCONNU']
    }
  ]
};

const { synthesis, diagnostics } =
  sanitizeCollectiveSynthesis(rawSynthesis, rows);

assert.ok(
  synthesis.single_contribution_observations.some(x => x.key === 'topic-mono'),
  'Un thème soutenu par une seule contribution doit être reclassé en observation.'
);

const duplicateAnalysisObservation =
  synthesis.single_contribution_observations.find(
    x => x.key === 'topic-two-analyses-one-contribution'
  );

assert.ok(
  duplicateAnalysisObservation,
  'Deux analyses de la même contribution doivent rester une observation mono-contribution.'
);

assert.equal(
  duplicateAnalysisObservation.evidence_ids.length,
  1,
  'Une observation mono-contribution doit conserver une seule preuve représentative.'
);

assert.ok(
  synthesis.emergent_topics.some(x => x.key === 'observation-multi'),
  'Une observation soutenue par plusieurs contributions doit être reclassée en thème.'
);

assert.ok(
  synthesis.disagreements.some(x => x.key === 'disagreement-valid'),
  'Un désaccord correctement ancré doit rester dans le corpus.'
);

assert.equal(
  synthesis.disagreements.some(x => x.key === 'disagreement-inferred'),
  false,
  'Une opposition comportant une position inférée ne doit pas devenir un désaccord du corpus.'
);

const demoted =
  synthesis.non_disagreement_tensions.find(x => x.key === 'tension-disagreement-inferred');

assert.ok(demoted, 'Le faux désaccord doit rester visible comme tension analytique.');
assert.equal(
  demoted.positions[1].grounding,
  'inferred',
  'La rétrogradation doit préserver la provenance de la position inférée.'
);

assert.deepEqual(
  synthesis.structural_signals[0].evidence_ids,
  ['A-1'],
  'Les identifiants de preuve inconnus doivent être supprimés.'
);

assert.equal(diagnostics.topics_moved_to_single, 2);
assert.equal(diagnostics.single_observations_moved_to_topics, 1);
assert.equal(diagnostics.disagreements_demoted_to_tensions, 1);
assert.ok(diagnostics.invalid_evidence_ids_removed >= 2);

console.log('Protocol 0.4 contract: OK');
