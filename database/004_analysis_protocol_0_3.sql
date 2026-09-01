/*
 * Coexistence des intelligences
 * Migration 004
 *
 * Passage méthodologique vers le protocole d'analyse 0.3
 *
 * OBJECTIF
 * -------
 * La première synthèse multi-contributions a montré une limite
 * méthodologique importante :
 *
 * plusieurs contributions ne constituent pas une preuve
 * de plusieurs contributeurs distincts.
 *
 * La synthèse S-057BB118, produite sous le protocole 0.2,
 * reste intégralement conservée comme trace historique.
 *
 * Les objets qu'elle a promus sont archivés, non supprimés,
 * afin que le protocole 0.3 puisse réexaminer le même corpus
 * sans hériter automatiquement de conclusions produites sous
 * l'ancienne interprétation.
 *
 * Cette migration :
 *
 * - ne supprime aucune contribution ;
 * - ne supprime aucune analyse ;
 * - ne supprime pas S-057BB118 ;
 * - ne modifie pas son contenu historique ;
 * - ne modifie pas son événement historique ;
 * - archive uniquement les objets actifs produits lors de cette synthèse ;
 * - conserve les thèmes, mais retire les descriptions synthétiques 0.2
 *   qui pourraient impliquer une pluralité humaine non vérifiée ;
 * - relie cette observation aux objets de transparence de gouvernance ;
 * - journalise publiquement la correction.
 */


begin;


do $$
declare

  v_now timestamptz := now();

  v_snapshot_exists boolean := false;

  v_disagreements integer := 0;
  v_risks integer := 0;
  v_questions integer := 0;
  v_proposals integer := 0;
  v_theme_descriptions integer := 0;

begin


  /* ==========================================================
     1. VÉRIFIER QUE LE CAS HISTORIQUE EXISTE
     ========================================================== */

  select exists (

    select 1

    from public.collective_syntheses

    where public_id = 'S-057BB118'
      and protocol_version = '0.2'

  )
  into v_snapshot_exists;


  /*
   * Sur une autre instance où ce cas historique
   * n'existe pas, cette migration de correction
   * ne doit modifier aucune donnée.
   */

  if not v_snapshot_exists then
    return;
  end if;



  /* ==========================================================
     2. ARCHIVER LES DÉSACCORDS PRODUITS PAR S-057BB118
     ========================================================== */

  update public.disagreements

  set
    status = 'archived',
    updated_at = v_now

  where status = 'open'

    and public_id in (
      'D-B13BF6B0',
      'D-216432CC'
    );


  get diagnostics
    v_disagreements = row_count;



  /* ==========================================================
     3. ARCHIVER LES RISQUES PRODUITS PAR S-057BB118
     ========================================================== */

  update public.risks

  set
    status = 'archived',
    updated_at = v_now

  where status = 'open'

    and public_id in (
      'R-C698051F',
      'R-33898534',
      'R-AD69AD56'
    );


  get diagnostics
    v_risks = row_count;



  /* ==========================================================
     4. ARCHIVER LES QUESTIONS PRODUITES PAR S-057BB118
     ========================================================== */

  update public.questions

  set
    status = 'archived',
    updated_at = v_now

  where status = 'open'

    and public_id in (
      'Q-01798C20',
      'Q-B6ED7316',
      'Q-E2F884EA',
      'Q-D04CC0E3'
    );


  get diagnostics
    v_questions = row_count;



  /* ==========================================================
     5. ARCHIVER LES PROPOSITIONS PRODUITES PAR S-057BB118
     ========================================================== */

  update public.proposals

  set
    status = 'archived',
    updated_at = v_now

  where status = 'open'

    and public_id in (
      'P-BE015421',
      'P-7102BF5D',
      'P-E787B006',
      'P-4E6E870B',
      'P-413420E1',
      'P-E240C64E',
      'P-6C73B7DC',
      'P-9F82151B'
    );


  get diagnostics
    v_proposals = row_count;



  /* ==========================================================
     6. CONSERVER LES THÈMES MAIS RETIRER LEUR SYNTHÈSE 0.2
     ========================================================== */

  /*
   * Les thèmes eux-mêmes restent utiles comme pistes
   * de cartographie.
   *
   * Leur description produite par S-057BB118 est retirée
   * de l'état actif afin que le protocole 0.3 puisse
   * éventuellement les reformuler.
   *
   * La description historique reste conservée intégralement
   * dans le contenu de S-057BB118.
   */

  update public.themes

  set
    description = null,
    updated_at = v_now

  where canonical_key in (
    'epistemic_trust',
    'micro_vs_macro',
    'governance_and_action'
  )

  and description is not null;


  get diagnostics
    v_theme_descriptions = row_count;



  /* ==========================================================
     7. RELIER LE CAS RÉEL À LA QUESTION GQ-0005
     ========================================================== */

  /*
   * governance_items existe après application
   * de la migration 003.
   *
   * Nous ajoutons uniquement l'identifiant de la synthèse
   * comme élément de provenance.
   */

  update public.governance_items

  set
    evidence_ids =
      case

        when coalesce(
          evidence_ids,
          '[]'::jsonb
        ) @> '["S-057BB118"]'::jsonb

        then evidence_ids

        else
          coalesce(
            evidence_ids,
            '[]'::jsonb
          )
          ||
          '["S-057BB118"]'::jsonb

      end,

    updated_at = v_now

  where canonical_key =
    'contribution-diversity-vs-contributor-diversity';



  /* ==========================================================
     8. RELIER LE CAS RÉEL À DP-0001
     ========================================================== */

  update public.governance_items

  set
    evidence_ids =
      case

        when coalesce(
          evidence_ids,
          '[]'::jsonb
        ) @> '["S-057BB118"]'::jsonb

        then evidence_ids

        else
          coalesce(
            evidence_ids,
            '[]'::jsonb
          )
          ||
          '["S-057BB118"]'::jsonb

      end,

    updated_at = v_now

  where canonical_key =
    'minimum-three-contributions-for-multi-contribution-synthesis';



  /* ==========================================================
     9. JOURNALISER LA CORRECTION MÉTHODOLOGIQUE
     ========================================================== */

  if not exists (

    select 1

    from public.events

    where event_type =
      'methodology_adjustment'

      and details ->> 'change_id' =
        'anonymous-plurality-0.3'

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

      'La méthode d’analyse a été corrigée : plusieurs contributions anonymes ne sont plus interprétées comme une preuve de plusieurs contributeurs distincts.',

      jsonb_build_object(

        'change_id',
        'anonymous-plurality-0.3',

        'analysis_protocol_from',
        '0.2',

        'analysis_protocol_to',
        '0.3',

        'observed_case',
        'S-057BB118',

        'observation',
        'Trois contributions différentes avaient déclenché une synthèse présentée comme collective alors que le système ne disposait d’aucune information permettant de savoir combien de personnes distinctes les avaient produites.',

        'principle',
        'Une pluralité de contributions peut démontrer une pluralité de textes ou de positions, mais pas automatiquement une pluralité de contributeurs.',

        'preservation',
        'La synthèse 0.2, les analyses et tous les objets produits restent conservés historiquement. Les objets actifs issus de cette synthèse ont été archivés afin de permettre un nouvel examen sous le protocole 0.3.',

        'archived_objects',
        jsonb_build_object(

          'disagreements',
          v_disagreements,

          'risks',
          v_risks,

          'questions',
          v_questions,

          'proposals',
          v_proposals

        ),

        'cleared_theme_descriptions',
        v_theme_descriptions,

        'identity_mechanism_added',
        false,

        'anonymous_contribution_preserved',
        true

      ),

      'public'

    );

  end if;


end
$$;


commit;
