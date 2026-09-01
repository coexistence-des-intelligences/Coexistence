/*
 * Coexistence des intelligences
 * Migration 005
 *
 * Provenance des synthèses et versionnement des objets structurés
 *
 * OBJECTIFS
 * ---------
 *
 * 1. Éviter de produire périodiquement la même synthèse
 *    lorsqu'aucune nouvelle analyse n'est disponible.
 *
 * 2. Permettre au même concept de réapparaître sous un
 *    nouveau protocole méthodologique sans réécrire
 *    son incarnation historique précédente.
 *
 * 3. Conserver explicitement la provenance d'une synthèse :
 *
 *    - analyses utilisées ;
 *    - contributions utilisées ;
 *    - nombre de contributions ;
 *    - protocole ;
 *    - nombre de contributeurs, lorsqu'il est réellement connu.
 *
 * PRINCIPE
 * --------
 *
 * contribution_count est observable.
 *
 * contributor_count n'est actuellement PAS connu.
 *
 * Cette migration :
 *
 * - ne crée aucun mécanisme d'identité ;
 * - ne crée aucun fingerprint utilisateur ;
 * - ne relie pas secrètement des contributions ;
 * - ne supprime aucun objet historique ;
 * - ne supprime aucune contrainte existante ;
 * - reste compatible avec le Worker précédent pendant
 *   la transition vers le nouveau code.
 */


begin;


/* ============================================================
   1. PROVENANCE DES SYNTHÈSES INTER-CONTRIBUTIONS
   ============================================================ */

alter table public.collective_syntheses

  add column if not exists
    analysis_ids jsonb
    not null
    default '[]'::jsonb;


alter table public.collective_syntheses

  add column if not exists
    contribution_ids jsonb
    not null
    default '[]'::jsonb;


alter table public.collective_syntheses

  add column if not exists
    contribution_count integer;


alter table public.collective_syntheses

  add column if not exists
    contributor_count integer;


alter table public.collective_syntheses

  add column if not exists
    contributor_count_known boolean
    not null
    default false;


/*
 * corpus_fingerprint ne fingerprint PAS une personne.
 *
 * Il s'agit uniquement d'une représentation déterministe
 * de l'ensemble des identifiants d'analyses utilisés
 * pour une synthèse.
 *
 * Exemple :
 *
 * A-AAA|A-BBB|A-CCC
 *
 * Deux exécutions avec exactement le même ensemble
 * d'analyses sous le même protocole peuvent ainsi
 * être reconnues comme équivalentes.
 */

alter table public.collective_syntheses

  add column if not exists
    corpus_fingerprint text;


/* ============================================================
   2. CONTRAINTES DE COHÉRENCE DES SYNTHÈSES
   ============================================================ */

do $$

begin

  if not exists (

    select 1
    from pg_constraint

    where conname =
      'collective_syntheses_contribution_count_check'

  ) then

    alter table public.collective_syntheses

      add constraint
        collective_syntheses_contribution_count_check

      check (
        contribution_count is null
        or contribution_count >= 0
      );

  end if;


  if not exists (

    select 1
    from pg_constraint

    where conname =
      'collective_syntheses_contributor_count_check'

  ) then

    alter table public.collective_syntheses

      add constraint
        collective_syntheses_contributor_count_check

      check (

        (
          contributor_count_known = false
          and contributor_count is null
        )

        or

        (
          contributor_count_known = true
          and contributor_count is not null
          and contributor_count >= 0
        )

      );

  end if;

end

$$;


/*
 * Une même matière peut être réanalysée sous un nouveau
 * protocole méthodologique.
 *
 * En revanche, exactement le même ensemble d'analyses
 * ne doit produire qu'une synthèse par protocole.
 *
 * Les anciennes synthèses sans fingerprint restent
 * autorisées grâce au WHERE.
 */

create unique index if not exists
  collective_syntheses_protocol_fingerprint_uidx

on public.collective_syntheses (
  protocol_version,
  corpus_fingerprint
)

where corpus_fingerprint is not null;


/* ============================================================
   3. BACKFILL DU CAS HISTORIQUE S-057BB118
   ============================================================ */

/*
 * Ces identifiants proviennent du snapshot d'audit effectué
 * avant la migration 004.
 *
 * Nous ne modifions PAS le contenu de la synthèse.
 *
 * Nous ajoutons uniquement sa provenance explicite.
 */

update public.collective_syntheses

set

  analysis_ids =
    '[
      "A-71B783AA",
      "A-2A349505",
      "A-5EADE62A"
    ]'::jsonb,

  contribution_ids =
    '[
      "C-1FE847B7",
      "C-FE10613A",
      "C-AA041879"
    ]'::jsonb,

  contribution_count = 3,

  contributor_count = null,

  contributor_count_known = false,

  /*
   * Ordre lexicographique des analysis_ids.
   *
   * Ce fingerprint décrit la matière analysée,
   * jamais l'identité de personnes.
   */
  corpus_fingerprint =
    'A-2A349505|A-5EADE62A|A-71B783AA'

where public_id = 'S-057BB118'

  and protocol_version = '0.2';


/* ============================================================
   4. VERSIONNEMENT DES OBJETS STRUCTURÉS
   ============================================================ */

/*
 * Nous conservons canonical_key pour compatibilité
 * avec l'architecture actuelle.
 *
 * À partir du nouveau Worker :
 *
 * concept_key
 *   = clé conceptuelle produite par l'analyse
 *
 * canonical_key
 *   = clé technique versionnée
 *
 * Exemple :
 *
 * concept_key   = d1
 * canonical_key = 0.3::d1
 *
 * Ainsi :
 *
 * 0.2::d1
 * 0.3::d1
 * 0.4::d1
 *
 * peuvent coexister historiquement.
 *
 * Les anciennes lignes conservent leur canonical_key
 * historique afin de ne pas réécrire le passé.
 */


/* ------------------------------------------------------------
   DÉSACCORDS
   ------------------------------------------------------------ */

alter table public.disagreements

  add column if not exists
    concept_key text;


alter table public.disagreements

  add column if not exists
    origin_protocol_version text
    not null
    default 'legacy-pre-0.3';


alter table public.disagreements

  add column if not exists
    source_synthesis_id uuid
    references public.collective_syntheses(id)
    on delete set null;


/* ------------------------------------------------------------
   RISQUES
   ------------------------------------------------------------ */

alter table public.risks

  add column if not exists
    concept_key text;


alter table public.risks

  add column if not exists
    origin_protocol_version text
    not null
    default 'legacy-pre-0.3';


alter table public.risks

  add column if not exists
    source_synthesis_id uuid
    references public.collective_syntheses(id)
    on delete set null;


/* ------------------------------------------------------------
   QUESTIONS
   ------------------------------------------------------------ */

alter table public.questions

  add column if not exists
    concept_key text;


alter table public.questions

  add column if not exists
    origin_protocol_version text
    not null
    default 'legacy-pre-0.3';


alter table public.questions

  add column if not exists
    source_synthesis_id uuid
    references public.collective_syntheses(id)
    on delete set null;


/* ------------------------------------------------------------
   PROPOSITIONS
   ------------------------------------------------------------ */

alter table public.proposals

  add column if not exists
    concept_key text;


alter table public.proposals

  add column if not exists
    origin_protocol_version text
    not null
    default 'legacy-pre-0.3';


alter table public.proposals

  add column if not exists
    source_synthesis_id uuid
    references public.collective_syntheses(id)
    on delete set null;


/* ============================================================
   5. COMPATIBILITÉ AVEC L'ANCIEN WORKER
   ============================================================ */

/*
 * Pendant la transition, l'ancien Worker ne connaît pas
 * encore concept_key.
 *
 * Ce trigger garantit qu'une éventuelle création effectuée
 * avant le déploiement du nouveau code reste valide :
 *
 * concept_key := canonical_key
 *
 * Il n'effectue aucune modification d'identité,
 * aucun rapprochement entre contributions.
 */

create or replace function
  public.ensure_structured_object_provenance()

returns trigger

language plpgsql

as $$

begin

  if new.concept_key is null
     or btrim(new.concept_key) = '' then

    new.concept_key :=
      new.canonical_key;

  end if;


  if new.origin_protocol_version is null
     or btrim(new.origin_protocol_version) = '' then

    new.origin_protocol_version :=
      'legacy-pre-0.3';

  end if;


  return new;

end

$$;


/* ------------------------------------------------------------
   Installer le trigger sur les quatre tables
   ------------------------------------------------------------ */

do $$

declare

  t text;

begin

  foreach t in array array[
    'disagreements',
    'risks',
    'questions',
    'proposals'
  ]

  loop

    execute format(
      'drop trigger if exists ensure_structured_object_provenance_trigger on public.%I',
      t
    );


    execute format(
      'create trigger ensure_structured_object_provenance_trigger
       before insert or update on public.%I
       for each row
       execute function public.ensure_structured_object_provenance()',
      t
    );

  end loop;

end

$$;


/* ============================================================
   6. BACKFILL DES CLÉS CONCEPTUELLES EXISTANTES
   ============================================================ */

update public.disagreements

set concept_key = canonical_key

where concept_key is null
   or btrim(concept_key) = '';


update public.risks

set concept_key = canonical_key

where concept_key is null
   or btrim(concept_key) = '';


update public.questions

set concept_key = canonical_key

where concept_key is null
   or btrim(concept_key) = '';


update public.proposals

set concept_key = canonical_key

where concept_key is null
   or btrim(concept_key) = '';


/* ============================================================
   7. PROVENANCE DES OBJETS DE S-057BB118
   ============================================================ */

do $$

declare

  v_synthesis_id uuid;

begin

  select id

  into v_synthesis_id

  from public.collective_syntheses

  where public_id = 'S-057BB118'

  limit 1;


  if v_synthesis_id is not null then


    /* --------------------------------------------------------
       DÉSACCORDS 0.2
       -------------------------------------------------------- */

    update public.disagreements

    set

      origin_protocol_version = '0.2',

      source_synthesis_id =
        v_synthesis_id

    where public_id in (
      'D-B13BF6B0',
      'D-216432CC'
    );


    /* --------------------------------------------------------
       RISQUES 0.2
       -------------------------------------------------------- */

    update public.risks

    set

      origin_protocol_version = '0.2',

      source_synthesis_id =
        v_synthesis_id

    where public_id in (
      'R-C698051F',
      'R-33898534',
      'R-AD69AD56'
    );


    /* --------------------------------------------------------
       QUESTIONS 0.2
       -------------------------------------------------------- */

    update public.questions

    set

      origin_protocol_version = '0.2',

      source_synthesis_id =
        v_synthesis_id

    where public_id in (
      'Q-01798C20',
      'Q-B6ED7316',
      'Q-E2F884EA',
      'Q-D04CC0E3'
    );


    /* --------------------------------------------------------
       PROPOSITIONS 0.2
       -------------------------------------------------------- */

    update public.proposals

    set

      origin_protocol_version = '0.2',

      source_synthesis_id =
        v_synthesis_id

    where public_id in (
      'P-BE015421',
      'P-7102BF5D',
      'P-E787B006',
      'P-4E6E870B',
      'P-413420E1',
      'P-E240C64E',
      'P-6C73B7DC',
      'P-9F82151B'
    );


  end if;

end

$$;


/* ============================================================
   8. INDEX DE PROVENANCE ET DE RECHERCHE
   ============================================================ */

create index if not exists
  disagreements_concept_protocol_idx

on public.disagreements (
  concept_key,
  origin_protocol_version
);


create index if not exists
  risks_concept_protocol_idx

on public.risks (
  concept_key,
  origin_protocol_version
);


create index if not exists
  questions_concept_protocol_idx

on public.questions (
  concept_key,
  origin_protocol_version
);


create index if not exists
  proposals_concept_protocol_idx

on public.proposals (
  concept_key,
  origin_protocol_version
);


create index if not exists
  disagreements_source_synthesis_idx

on public.disagreements (
  source_synthesis_id
);


create index if not exists
  risks_source_synthesis_idx

on public.risks (
  source_synthesis_id
);


create index if not exists
  questions_source_synthesis_idx

on public.questions (
  source_synthesis_id
);


create index if not exists
  proposals_source_synthesis_idx

on public.proposals (
  source_synthesis_id
);


/* ============================================================
   9. JOURNAL PUBLIC
   ============================================================ */

do $$

begin

  if not exists (

    select 1

    from public.events

    where event_type =
      'methodology_adjustment'

      and details ->> 'change_id' =
        'synthesis-provenance-versioning-0.1'

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

      'E-' ||
      upper(
        substr(
          replace(
            gen_random_uuid()::text,
            '-',
            ''
          ),
          1,
          8
        )
      ),

      'coexistence-origin-1',

      'methodology_adjustment',

      'La provenance des synthèses et le versionnement des objets structurés ont été renforcés afin d’éviter les synthèses répétées et la réécriture involontaire de résultats historiques.',

      jsonb_build_object(

        'change_id',
        'synthesis-provenance-versioning-0.1',

        'purpose',
        'Rendre les synthèses reproductibles, traçables et compatibles avec l’historisation des changements méthodologiques.',

        'synthesis_provenance',
        jsonb_build_array(
          'analysis_ids',
          'contribution_ids',
          'contribution_count',
          'corpus_fingerprint',
          'protocol_version'
        ),

        'contributor_identity',
        jsonb_build_object(
          'contributor_count_known',
          false,
          'identity_tracking_added',
          false,
          'user_fingerprinting_added',
          false
        ),

        'object_versioning',
        'Un concept pourra posséder une incarnation distincte selon le protocole d’analyse sans écraser son incarnation historique précédente.',

        'historical_case',
        'S-057BB118',

        'automatic_adoption_added',
        false

      ),

      'public'

    );

  end if;

end

$$;


commit;
