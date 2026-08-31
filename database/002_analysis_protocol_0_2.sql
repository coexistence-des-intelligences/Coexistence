/*
 * Coexistence des intelligences
 * Migration 002
 *
 * Passage de la méthode d'analyse 0.1 à 0.2
 *
 * OBJECTIF
 * -------
 * La méthode 0.1 permettait à une analyse individuelle de créer
 * directement des désaccords, risques, questions et propositions
 * dans le corpus collectif.
 *
 * La première contribution a montré que cette promotion était
 * trop rapide : une interprétation produite par l'IA pouvait être
 * transformée immédiatement en objet collectif.
 *
 * À partir du protocole d'analyse 0.2 :
 *
 * - une analyse individuelle peut toujours suggérer des thèmes,
 *   tensions, risques, questions, propositions ou désaccords candidats ;
 *
 * - ces éléments restent dans l'analyse individuelle ;
 *
 * - leur promotion en objets collectifs exige désormais un contexte
 *   et une provenance explicites dans le corpus ;
 *
 * - un désaccord collectif exige au moins deux contributions distinctes
 *   portant réellement des positions différentes ;
 *
 * - les anciens objets ne sont pas supprimés : ils sont archivés afin
 *   de préserver l'historique du projet.
 *
 * Cette migration est conçue pour être réexécutable sans créer
 * plusieurs fois le même événement méthodologique.
 */


begin;


do $$
declare
  v_now timestamptz := now();

  v_disagreements integer := 0;
  v_risks integer := 0;
  v_questions integer := 0;
  v_proposals integer := 0;

begin

  /*
   * 1. DÉSACCORDS
   *
   * Un désaccord collectif sans aucune preuve reliée au corpus
   * ne satisfait plus aux exigences du protocole 0.2.
   */

  update public.disagreements
  set
    status = 'archived',
    updated_at = v_now
  where status = 'open'
    and coalesce(evidence_ids, '[]'::jsonb) = '[]'::jsonb;

  get diagnostics v_disagreements = row_count;


  /*
   * 2. RISQUES
   *
   * Un risque peut provenir d'une contribution minoritaire ou isolée,
   * mais un objet collectif publié doit au minimum conserver une
   * provenance explicite.
   */

  update public.risks
  set
    status = 'archived',
    updated_at = v_now
  where status = 'open'
    and coalesce(evidence_ids, '[]'::jsonb) = '[]'::jsonb;

  get diagnostics v_risks = row_count;


  /*
   * 3. QUESTIONS
   *
   * Les questions créées sans rattachement explicite au corpus
   * sont archivées.
   */

  update public.questions
  set
    status = 'archived',
    updated_at = v_now
  where status = 'open'
    and coalesce(evidence_ids, '[]'::jsonb) = '[]'::jsonb;

  get diagnostics v_questions = row_count;


  /*
   * 4. PROPOSITIONS
   *
   * Les propositions produites directement par l'analyse d'une
   * contribution individuelle ne sont plus considérées comme
   * des propositions collectives ouvertes.
   *
   * Elles restent conservées dans la base sous statut archived.
   */

  update public.proposals
  set
    status = 'archived',
    updated_at = v_now
  where status = 'open'
    and source = 'contribution_analysis';

  get diagnostics v_proposals = row_count;


  /*
   * 5. JOURNAL PUBLIC
   *
   * La correction méthodologique doit laisser une trace publique.
   *
   * change_id sert d'identifiant stable afin d'empêcher la création
   * de plusieurs événements identiques si la migration est relancée.
   */

  if not exists (
    select 1
    from public.events
    where event_type = 'methodology_adjustment'
      and details ->> 'change_id' = 'analysis-promotion-0.2'
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
          replace(gen_random_uuid()::text, '-', ''),
          1,
          8
        )
      ),

      'coexistence-origin-1',

      'methodology_adjustment',

      'La méthode d’analyse a été corrigée : une contribution individuelle ne crée plus directement de désaccord, risque, question ou proposition collective.',

      jsonb_build_object(

        'change_id',
        'analysis-promotion-0.2',

        'analysis_protocol_from',
        '0.1',

        'analysis_protocol_to',
        '0.2',

        'reason',
        'La première contribution a montré qu’une analyse individuelle pouvait transformer trop rapidement des pistes exploratoires en objets collectifs.',

        'principle',
        'Une analyse peut suggérer ; la promotion collective exige un contexte et une provenance explicites.',

        'preservation',
        'Les objets produits par l’ancienne méthode ont été archivés et non supprimés.',

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
        )
      ),

      'public'
    );

  end if;

end
$$;


commit;
