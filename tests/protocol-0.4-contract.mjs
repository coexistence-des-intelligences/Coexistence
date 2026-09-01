import assert from 'node:assert/strict';
import { analysisSchema, collectiveSchema } from '../src/schemas.js';
import { ANALYSIS_PROMPT, COLLECTIVE_PROMPT } from '../src/prompts.js';

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

const individualPosition =
  analysisSchema.properties.disagreement_candidate.properties.positions.items.properties;

assert.ok(individualPosition.grounding, 'Le candidat individuel doit distinguer explicit/inferred/ai_counterargument.');
assert.ok(individualPosition.source_contribution_ids, 'Le candidat individuel doit porter sa provenance contributionnelle.');

assert.match(
  ANALYSIS_PROMPT,
  /Implicitement soutenu.*inferred/i,
  'Le prompt individuel doit interdire de qualifier une position implicite comme explicite.'
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
  COLLECTIVE_PROMPT,
  /au moins DEUX contributions distinctes/i,
  'Le prompt doit imposer une règle explicite avant tout vocabulaire de récurrence.'
);

console.log('Protocol 0.4 contract: OK');
