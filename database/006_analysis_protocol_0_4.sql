/*
 * Coexistence des intelligences
 * Migration 006
 *
 * Protocole d'analyse 0.4 — provenance épistémique
 *
 * OBJECTIFS
 * ---------
 * - distinguer ce qui est explicitement présent dans le corpus
 *   de ce qui est inféré ou construit par l'IA ;
 * - empêcher une position implicite ou un contre-argument IA
 *   de devenir un désaccord du corpus ;
 * - retirer la génération directe de candidats de version
 *   du moteur de synthèse ;
 * - préparer des signaux structurels non décisionnels pour
 *   le futur Evolution Engine ;
 * - rendre la provenance des modèles/fournisseurs explicite ;
 * - préparer la comparaison future de plusieurs fournisseurs IA
 *   sans écraser leurs synthèses respectives ;
 * - préserver intégralement les résultats 0.2 et 0.3 comme histoire.
 */

begin;

/* ============================================================
   1. FOURNISSEUR IA ET PROVENANCE DES ANALYSES
   ============================================================ */

alter table public.analyses
  add column if not exists provider text not null default 'openai';

alter table public.collective_syntheses
  add column if not exists provider text not null default 'openai';

alter table public.collective_syntheses
  add column if not exists analysis_provenance jsonb not null default '[]'::jsonb;

/*
 * Les synthèses historiques disposent déjà de analysis_ids depuis 005.
 * On enrichit leur provenance sans modifier leur contenu historique.
 */
update public.collective_syntheses s
set analysis_provenance = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'analysis_id', a.public_id,
        'protocol_version', a.protocol_version,
        'provider', a.provider,
        'model', a.model
      )
      order by a.public_id
    )
    from public.analyses a
    where coalesce(s.analysis_ids, '[]'::jsonb) ? a.public_id
  ),
  '[]'::jsonb
)
where coalesce(s.analysis_ids, '[]'::jsonb) <> '[]'::jsonb;

/*
 * 005 empêchait une répétition pour un couple protocole + corpus.
 * 0.4 prépare aussi les comparaisons multi-IA : même corpus et même
 * protocole peuvent être synthétisés séparément par des moteurs différents.
 */
drop index if exists public.collective_syntheses_protocol_fingerprint_uidx;

create unique index if not exists
  collective_syntheses_engine_fingerprint_uidx
on public.collective_syntheses (
  protocol_version,
  provider,
  model,
  corpus_fingerprint
)
where corpus_fingerprint is not null;


/* ============================================================
   2. PROVENANCE DES DESCRIPTIONS DE THÈMES
   ============================================================ */

alter table public.themes
  add column if not exists description_source_synthesis_id uuid
  references public.collective_syntheses(id)
  on delete set null;

alter table public.themes
  add column if not exists description_protocol_version text;

alter table public.themes
  add column if not exists description_provider text;

alter table public.themes
  add column if not exists description_model text;


/* ============================================================
   3. PROVENANCE ÉPISTÉMIQUE DES OBJETS STRUCTURÉS
   ============================================================ */

alter table public.disagreements
  add column if not exists position_provenance jsonb not null default '[]'::jsonb;

alter table public.disagreements
  add column if not exists origin_provider text not null default 'openai';

alter table public.disagreements
  add column if not exists origin_model text not null default 'unknown';

alter table public.risks
  add column if not exists grounding text;

alter table public.risks
  add column if not exists origin_provider text not null default 'openai';

alter table public.risks
  add column if not exists origin_model text not null default 'unknown';

alter table public.questions
  add column if not exists grounding text;

alter table public.questions
  add column if not exists origin_provider text not null default 'openai';

alter table public.questions
  add column if not exists origin_model text not null default 'unknown';

alter table public.proposals
  add column if not exists grounding text;

alter table public.proposals
  add column if not exists origin_provider text not null default 'openai';

alter table public.proposals
  add column if not exists origin_model text not null default 'unknown';

/* Contraintes souples : NULL reste autorisé pour l'histoire pré-0.4. */
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'risks_grounding_check'
  ) then
    alter table public.risks
      add constraint risks_grounding_check
      check (
        grounding is null
        or grounding in ('explicit_in_corpus','inferred_by_ai','mixed')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'questions_grounding_check'
  ) then
    alter table public.questions
      add constraint questions_grounding_check
      check (
        grounding is null
        or grounding in ('explicit_in_corpus','inferred_by_ai','mixed')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'proposals_grounding_check'
  ) then
    alter table public.proposals
      add constraint proposals_grounding_check
      check (
        grounding is null
        or grounding in ('explicit_in_corpus','inferred_by_ai','mixed')
      );
  end if;
end
$$;

/* Backfill moteur/modèle depuis la synthèse source lorsqu'elle est connue. */
update public.disagreements d
set
  origin_provider = s.provider,
  origin_model = s.model
from public.collective_syntheses s
where d.source_synthesis_id = s.id;

update public.risks r
set
  origin_provider = s.provider,
  origin_model = s.model
from public.collective_syntheses s
where r.source_synthesis_id = s.id;

update public.questions q
set
  origin_provider = s.provider,
  origin_model = s.model
from public.collective_syntheses s
where q.source_synthesis_id = s.id;

update public.proposals p
set
  origin_provider = s.provider,
  origin_model = s.model
from public.collective_syntheses s
where p.source_synthesis_id = s.id;


/* ============================================================
   4. SIGNAUX STRUCTURELS — ENTRÉE FUTURE DE L'EVOLUTION ENGINE
   ============================================================ */

create table if not exists public.structural_signals (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  canonical_key text unique not null,
  concept_key text not null,

  signal_type text not null
    check (signal_type in (
      'methodology',
      'governance',
      'technical',
      'charter',
      'safety',
      'other'
    )),

  title text not null,
  summary text not null,
  grounding text not null
    check (grounding in (
      'explicit_in_corpus',
      'inferred_by_ai',
      'mixed'
    )),
  why_structural text not null,
  strongest_counterargument text not null,
  unresolved_uncertainties jsonb not null default '[]'::jsonb,
  evidence_ids jsonb not null default '[]'::jsonb,

  origin_protocol_version text not null,
  origin_provider text not null,
  origin_model text not null,

  source_synthesis_id uuid
    references public.collective_syntheses(id)
    on delete set null,

  status text not null default 'open'
    check (status in (
      'open',
      'under_investigation',
      'converted',
      'dismissed',
      'archived'
    )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists structural_signals_status_updated_idx
  on public.structural_signals(status, updated_at desc);

create index if not exists structural_signals_source_synthesis_idx
  on public.structural_signals(source_synthesis_id);

create index if not exists structural_signals_concept_protocol_idx
  on public.structural_signals(
    concept_key,
    origin_protocol_version,
    origin_provider,
    origin_model
  );

alter table public.structural_signals enable row level security;

drop trigger if exists preserve_public_id_trigger
  on public.structural_signals;

create trigger preserve_public_id_trigger
before update on public.structural_signals
for each row
execute function public.preserve_public_id();


/* ============================================================
   5. RECLASSIFICATION HISTORIQUE DU PROTOCOLE 0.3
   ============================================================ */

do $$
declare
  v_disagreements integer := 0;
  v_risks integer := 0;
  v_questions integer := 0;
  v_proposals integer := 0;
  v_theme_descriptions integer := 0;
begin

  update public.disagreements
  set status = 'archived', updated_at = now()
  where status = 'open'
    and origin_protocol_version = '0.3';
  get diagnostics v_disagreements = row_count;

  update public.risks
  set status = 'archived', updated_at = now()
  where status = 'open'
    and origin_protocol_version = '0.3';
  get diagnostics v_risks = row_count;

  update public.questions
  set status = 'archived', updated_at = now()
  where status = 'open'
    and origin_protocol_version = '0.3';
  get diagnostics v_questions = row_count;

  update public.proposals
  set status = 'archived', updated_at = now()
  where status = 'open'
    and origin_protocol_version = '0.3';
  get diagnostics v_proposals = row_count;

  /*
   * Les descriptions actives de thèmes produites par S-56389CD6
   * sont retirées de la carte vivante, mais leur texte reste intact
   * dans la synthèse historique 0.3.
   */
  update public.themes t
  set
    description = null,
    description_source_synthesis_id = null,
    description_protocol_version = null,
    description_provider = null,
    description_model = null,
    updated_at = now()
  where t.canonical_key in (
    select elem.value ->> 'key'
    from public.collective_syntheses s
    cross join lateral jsonb_array_elements(
      coalesce(s.content -> 'emergent_topics', '[]'::jsonb)
    ) as elem(value)
    where s.public_id = 'S-56389CD6'
  )
  and t.description is not null;
  get diagnostics v_theme_descriptions = row_count;

  if not exists (
    select 1 from public.events
    where event_type = 'methodology_adjustment'
      and details ->> 'change_id' = 'epistemic-provenance-0.4'
  ) then
    insert into public.events (
      public_id,
      instance_id,
      event_type,
      public_summary,
      details,
      visibility
    )
    values (
      'E-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      'coexistence-origin-1',
      'methodology_adjustment',
      'La méthode d’analyse a été préparée pour distinguer les positions explicitement présentes dans le corpus des inférences produites par l’IA.',
      jsonb_build_object(
        'change_id', 'epistemic-provenance-0.4',
        'analysis_protocol_from', '0.3',
        'analysis_protocol_to', '0.4',
        'observed_case', 'S-56389CD6',
        'observations', jsonb_build_array(
          'Une position explicitement décrite comme implicite avait encore été promue comme seconde position d’un désaccord.',
          'Certaines formulations de récurrence reposaient sur une seule contribution.',
          'Le moteur de synthèse pouvait encore produire directement un candidat de version.'
        ),
        'correction', jsonb_build_array(
          'provenance distincte pour chaque position',
          'séparation explicite entre corpus et inférence IA',
          'démotion automatique des faux désaccords en tensions',
          'promotion publique limitée aux risques, questions et propositions explicitement ancrés dans le corpus',
          'remplacement des candidats de version par des signaux structurels non décisionnels'
        ),
        'archived_0_3_objects', jsonb_build_object(
          'disagreements', v_disagreements,
          'risks', v_risks,
          'questions', v_questions,
          'proposals', v_proposals
        ),
        'cleared_theme_descriptions', v_theme_descriptions,
        'historical_synthesis_preserved', true,
        'automatic_adoption_added', false,
        'identity_tracking_added', false,
        'multi_ai_preparation', true
      ),
      'public'
    );
  end if;
end
$$;


/* ============================================================
   6. TRANSPARENCE DE GOUVERNANCE
   ============================================================ */

insert into public.governance_items (
  public_id,
  canonical_key,
  item_type,
  title,
  summary,
  rationale,
  counterargument,
  alternatives,
  open_uncertainties,
  evidence_ids,
  source,
  status,
  ratification_status
)
values
(
  'GQ-0006',
  'corpus-position-vs-ai-inference',
  'open_question',
  'Comment distinguer une position du corpus d’une inférence produite par l’IA ?',
  'Une analyse peut produire une interprétation plausible qui n’a pourtant jamais été explicitement exprimée dans une contribution.',
  'La synthèse 0.3 a montré qu’une position qualifiée d’implicite pouvait encore être traitée comme seconde position d’un désaccord.',
  'Une séparation trop stricte entre explicite et inféré peut rendre invisibles des implications importantes ou empêcher l’IA de jouer pleinement son rôle de contradicteur.',
  '[
    "N’autoriser que les positions explicitement formulées dans les désaccords du corpus",
    "Conserver séparément les inférences IA comme tensions",
    "Utiliser une validation humaine pour certaines inférences",
    "Comparer plusieurs IA avant de promouvoir une inférence",
    "Autres mécanismes à proposer"
  ]'::jsonb,
  '[
    "Comment vérifier automatiquement qu’une position est réellement explicite ?",
    "Quand une reformulation fidèle cesse-t-elle d’être une position explicite ?",
    "Comment conserver les implications utiles sans les attribuer au contributeur ?"
  ]'::jsonb,
  '["S-56389CD6"]'::jsonb,
  'initial_phase',
  'open',
  'not_applicable'
),
(
  'DP-0005',
  'explicit-provenance-before-corpus-disagreement-promotion',
  'provisional_decision',
  'Exiger une provenance explicite avant de promouvoir une position comme désaccord du corpus',
  'Sous le protocole 0.4, une position inférée ou produite comme contre-argument par l’IA ne peut plus constituer à elle seule une position d’un désaccord structuré du corpus.',
  'Cette règle provisoire vise à empêcher que l’IA fabrique involontairement une pluralité de positions qui n’existe pas dans les contributions publiées.',
  'Une exigence d’explicitation stricte peut manquer des positions réellement présentes mais formulées de manière indirecte, culturelle ou contextuelle.',
  '[
    "Exigence stricte d’explicitation",
    "Seuil de confiance pour certaines inférences",
    "Validation contradictoire par une seconde IA",
    "Validation humaine facultative",
    "Autres solutions à proposer"
  ]'::jsonb,
  '[
    "Comment définir techniquement le seuil entre reformulation et inférence ?",
    "Comment éviter qu’une règle de prudence ne rende l’analyse excessivement littérale ?"
  ]'::jsonb,
  '["S-56389CD6"]'::jsonb,
  'initial_phase',
  'provisional',
  'not_ratified'
)
on conflict (canonical_key) do nothing;

commit;
