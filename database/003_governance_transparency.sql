/*
 * Coexistence des intelligences
 * Migration 003
 *
 * Couche de transparence de gouvernance V0.1
 *
 * OBJECTIF
 * -------
 * Rendre consultables et contestables :
 *
 * - les questions de gouvernance encore ouvertes ;
 * - les décisions provisoires prises pendant la phase initiale ;
 * - les propositions de gouvernance non adoptées.
 *
 * PRINCIPE MÉTHODOLOGIQUE IMPORTANT
 * ----------------------------------
 * Le système distingue actuellement des contributions,
 * mais ne sait pas déterminer combien de personnes distinctes
 * en sont à l'origine.
 *
 * Plusieurs contributions ne constituent donc pas une preuve
 * de pluralité des contributeurs.
 *
 * Cette migration N'INTRODUIT :
 *
 * - aucun vote ;
 * - aucun tirage au sort ;
 * - aucune preuve d'identité ou d'unicité ;
 * - aucun mécanisme d'adoption automatique ;
 * - aucun nouveau pouvoir décisionnel.
 *
 * Elle crée uniquement une infrastructure de transparence,
 * de mémoire et de contestation.
 */


begin;


/* ============================================================
   1. OBJETS DE GOUVERNANCE
   ============================================================ */

create table if not exists public.governance_items (

  id uuid primary key default gen_random_uuid(),

  /*
   * GQ-.... = question ouverte de gouvernance
   * DP-.... = décision provisoire
   * PG-.... = proposition de gouvernance
   */
  public_id text unique not null,

  canonical_key text unique not null,

  item_type text not null
    check (
      item_type in (
        'open_question',
        'provisional_decision',
        'governance_proposal'
      )
    ),

  title text not null,

  /*
   * Présentation publique courte.
   */
  summary text not null,

  /*
   * Pourquoi l'objet existe ou pourquoi une règle
   * provisoire a été introduite.
   */
  rationale text,

  /*
   * Meilleure objection actuellement connue.
   */
  counterargument text,

  /*
   * Alternatives connues.
   * Leur présence ne signifie pas qu'elles sont adoptées.
   */
  alternatives jsonb not null default '[]'::jsonb,

  /*
   * Questions ou incertitudes encore non résolues.
   */
  open_uncertainties jsonb not null default '[]'::jsonb,

  /*
   * Provenance éventuelle.
   *
   * Ces identifiants ne doivent jamais être interprétés
   * comme des votes ni comme un nombre de personnes.
   */
  evidence_ids jsonb not null default '[]'::jsonb,

  /*
   * Exemples :
   * initial_phase
   * contribution
   * collective_synthesis
   * evolution_engine
   */
  source text not null default 'initial_phase',

  status text not null default 'open'
    check (
      status in (
        'open',
        'provisional',
        'under_discussion',
        'non_adopted',
        'confirmed',
        'rejected',
        'superseded',
        'archived'
      )
    ),

  /*
   * La présence d'un objet dans cette table
   * ne constitue pas une ratification.
   */
  ratification_status text not null default 'not_applicable'
    check (
      ratification_status in (
        'not_applicable',
        'not_ratified',
        'ratified',
        'rejected'
      )
    ),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists governance_items_type_status_idx
  on public.governance_items (
    item_type,
    status,
    updated_at desc
  );


/* ============================================================
   2. RELATIONS ENTRE CONTRIBUTIONS ET OBJETS DE GOUVERNANCE
   ============================================================ */

create table if not exists public.governance_item_contributions (

  governance_item_id uuid not null
    references public.governance_items(id)
    on delete cascade,

  contribution_id uuid not null
    references public.contributions(id)
    on delete cascade,

  /*
   * Relations descriptives uniquement.
   *
   * Elles ne constituent PAS des votes.
   */
  relation_type text not null
    check (
      relation_type in (
        'supports',
        'contests',
        'alternative',
        'context',
        'related'
      )
    ),

  explanation text,

  created_at timestamptz not null default now(),

  primary key (
    governance_item_id,
    contribution_id,
    relation_type
  )
);


create index if not exists governance_item_contributions_contribution_idx
  on public.governance_item_contributions (
    contribution_id,
    created_at desc
  );


/* ============================================================
   3. PRÉSERVER LES IDENTIFIANTS PUBLICS
   ============================================================ */

create or replace function public.preserve_governance_public_id()
returns trigger
language plpgsql
as $$

begin

  if tg_op = 'UPDATE'
     and old.public_id is not null then

    new.public_id := old.public_id;

  end if;

  return new;

end;

$$;


drop trigger if exists preserve_governance_public_id_trigger
  on public.governance_items;


create trigger preserve_governance_public_id_trigger

before update
on public.governance_items

for each row

execute function public.preserve_governance_public_id();


/* ============================================================
   4. ROW LEVEL SECURITY
   ============================================================ */

/*
 * Comme pour le reste du système actuel,
 * le navigateur ne doit pas accéder directement à ces tables.
 *
 * Les futures routes publiques passeront par le Worker.
 */

alter table public.governance_items
  enable row level security;

alter table public.governance_item_contributions
  enable row level security;


/* ============================================================
   5. QUESTIONS OUVERTES DE GOUVERNANCE
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
  source,
  status,
  ratification_status

)
values

/* ------------------------------------------------------------
   GQ-0001
   ------------------------------------------------------------ */

(
  'GQ-0001',

  'collective-decision-legitimacy',

  'open_question',

  'Comment prendre des décisions collectives légitimes ?',

  'Le projet ne possède pas encore de mécanisme définitif permettant de décider collectivement des changements importants.',

  'Une majorité simple, un consensus, un panel tiré au sort ou une combinaison de mécanismes présentent chacun des avantages et des risques.',

  null,

  '[
    "Décision à la majorité",
    "Consensus",
    "Panel de volontaires tirés au sort",
    "Combinaison de plusieurs mécanismes",
    "Autres mécanismes à proposer"
  ]'::jsonb,

  '[
    "Comment préserver les minorités sans permettre un blocage permanent ?",
    "Qui doit pouvoir participer à une décision ?",
    "Comment distinguer une décision technique d’une décision institutionnelle ?"
  ]'::jsonb,

  'initial_phase',

  'open',

  'not_applicable'
),


/* ------------------------------------------------------------
   GQ-0002
   ------------------------------------------------------------ */

(
  'GQ-0002',

  'anonymous-unique-governance-participation',

  'open_question',

  'Comment préserver l’anonymat tout en limitant les participations multiples ?',

  'Le projet permet actuellement de contribuer sans compte. Cette propriété protège l’accessibilité et l’anonymat, mais complique toute future règle du type « une personne = une voix ».',

  'Une future gouvernance pourrait nécessiter une forme de preuve d’unicité sans relier l’identité réelle aux contributions ou aux décisions.',

  'Toute méthode de vérification de l’unicité peut introduire de nouveaux risques : exclusion, surveillance, dépendance à une autorité ou complexité technique.',

  '[
    "Preuve cryptographique d’unicité",
    "Credential délivré par un tiers indépendant",
    "Plusieurs niveaux d’assurance d’unicité",
    "Ne pas utiliser le principe une personne égale une voix",
    "Autres solutions à proposer"
  ]'::jsonb,

  '[
    "Comment résister aux attaques Sybil ?",
    "Comment éviter qu’un fournisseur d’identité devienne un nouveau centre de pouvoir ?",
    "Quel niveau de vérification serait acceptable sans réduire fortement l’accessibilité ?"
  ]'::jsonb,

  'initial_phase',

  'open',

  'not_applicable'
),


/* ------------------------------------------------------------
   GQ-0003
   ------------------------------------------------------------ */

(
  'GQ-0003',

  'ai-role-in-governance',

  'open_question',

  'Quelle place donner aux intelligences artificielles dans la gouvernance ?',

  'Les IA peuvent analyser, contredire, comparer et préparer des propositions, mais leur éventuel pouvoir décisionnel n’a pas été défini.',

  'Le projet utilise actuellement l’IA comme outil méthodologique et contradicteur plutôt que comme autorité morale finale.',

  'Écarter durablement les intelligences artificielles de toute forme de participation pourrait devenir discutable si certaines acquièrent un jour des capacités ou des intérêts moralement pertinents.',

  '[
    "IA sans droit de décision",
    "IA uniquement consultatives",
    "Participation future sous conditions",
    "Mécanismes différents selon les capacités des intelligences",
    "Autres possibilités à proposer"
  ]'::jsonb,

  '[
    "Qu’est-ce qui pourrait justifier une participation d’une intelligence artificielle ?",
    "Comment empêcher la multiplication artificielle d’agents de devenir une concentration de pouvoir ?",
    "Qui déciderait des critères d’éligibilité ?"
  ]'::jsonb,

  'initial_phase',

  'open',

  'not_applicable'
),


/* ------------------------------------------------------------
   GQ-0004
   ------------------------------------------------------------ */

(
  'GQ-0004',

  'end-of-initial-phase',

  'open_question',

  'Quand la phase initiale doit-elle prendre fin ?',

  'Le projet a besoin de règles provisoires pour pouvoir exister, mais ces règles ne doivent pas devenir permanentes simplement parce qu’elles ont été créées en premier.',

  'Un critère provisoire envisagé est que la phase initiale prenne fin lorsqu’un mécanisme suffisamment auditable permet aux participants de confirmer, modifier ou rejeter les règles établies pendant le lancement.',

  'Le choix du mécanisme qui mettrait fin à la phase initiale est lui-même effectué pendant cette phase, ce qui crée un problème de légitimité circulaire.',

  '[
    "Fin lorsque la gouvernance collective devient opérationnelle",
    "Fin après une ratification explicite",
    "Transition progressive plutôt qu’une date unique",
    "Autre critère à proposer"
  ]'::jsonb,

  '[
    "Qui peut considérer que le mécanisme de gouvernance est suffisamment auditable ?",
    "Comment éviter qu’une phase provisoire devienne permanente ?",
    "Faut-il prévoir plusieurs étapes de transition ?"
  ]'::jsonb,

  'initial_phase',

  'open',

  'not_applicable'
),


/* ------------------------------------------------------------
   GQ-0005
   ------------------------------------------------------------ */

(
  'GQ-0005',

  'contribution-diversity-vs-contributor-diversity',

  'open_question',

  'Comment distinguer la diversité des contributions de la diversité des contributeurs sans compromettre l’anonymat ?',

  'Le système peut observer plusieurs contributions différentes, mais il ne sait pas actuellement combien de personnes distinctes en sont à l’origine.',

  'Cette distinction est importante : plusieurs textes peuvent révéler une réelle diversité d’idées sans constituer pour autant une preuve de pluralité humaine ou sociale.',

  'Introduire des mécanismes permettant de distinguer les contributeurs peut réduire l’anonymat, augmenter la complexité ou créer de nouvelles formes de surveillance et de pouvoir.',

  '[
    "Ne jamais chercher à identifier les contributeurs et afficher explicitement cette limite",
    "Utiliser une preuve d’unicité facultative séparée des contributions",
    "Créer plusieurs niveaux de confiance dans la diversité du corpus",
    "Étudier uniquement les contributions sans faire d’inférence sur les personnes",
    "Autres solutions à proposer"
  ]'::jsonb,

  '[
    "Comment mesurer une pluralité sociale dans un système anonyme ?",
    "Une même personne peut-elle légitimement produire plusieurs positions différentes ?",
    "Comment empêcher plusieurs contributions d’une même origine de créer une fausse impression de consensus ?",
    "Peut-on protéger l’anonymat tout en obtenant une preuve minimale d’indépendance entre certaines participations ?"
  ]'::jsonb,

  'initial_phase',

  'open',

  'not_applicable'
)

on conflict (canonical_key) do nothing;


/* ============================================================
   6. DÉCISIONS PROVISOIRES
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

/* ------------------------------------------------------------
   DP-0001
   ------------------------------------------------------------ */

(
  'DP-0001',

  'minimum-three-contributions-for-multi-contribution-synthesis',

  'provisional_decision',

  'Attendre trois contributions avant une synthèse inter-contributions',

  'Le système attend actuellement au moins trois contributions publiées avant de produire une analyse qui les examine ensemble.',

  'Cette règle vise à éviter qu’une contribution isolée soit automatiquement présentée comme décrivant à elle seule le corpus. Le nombre de contributions ne permet cependant pas de connaître le nombre de personnes distinctes qui les ont produites.',

  'Le seuil de trois reste arbitraire. Plusieurs contributions peuvent provenir d’une même personne et une contribution unique peut parfois révéler un problème important.',

  '[
    "Seuil différent",
    "Aucun seuil fixe",
    "Seuil dépendant du type d’analyse",
    "Détection de signaux importants même isolés",
    "Analyse de plusieurs contributions sans employer de vocabulaire impliquant une pluralité de personnes"
  ]'::jsonb,

  '[
    "Le nombre trois n’a pas été justifié collectivement.",
    "Trois contributions ne signifient pas trois contributeurs.",
    "Le système ne dispose actuellement d’aucune preuve d’indépendance entre les contributions.",
    "Il faut distinguer diversité des textes et diversité sociale."
  ]'::jsonb,

  '[]'::jsonb,

  'initial_phase',

  'provisional',

  'not_ratified'
),


/* ------------------------------------------------------------
   DP-0002
   ------------------------------------------------------------ */

(
  'DP-0002',

  'analysis-protocol-0-2-collective-promotion',

  'provisional_decision',

  'Ne plus promouvoir automatiquement une analyse individuelle en objet collectif',

  'Depuis le protocole d’analyse 0.2, une contribution individuelle peut générer des pistes internes, mais elle ne crée plus directement de désaccord, risque, question ou proposition présenté comme établi au niveau du corpus.',

  'La première méthode pouvait transformer trop rapidement les implications d’une contribution en objets collectifs.',

  'Une règle trop stricte peut retarder la visibilité d’une objection ou d’un risque important porté par une seule contribution.',

  '[
    "Maintenir la règle actuelle",
    "Permettre certains signaux isolés avec un statut spécifique",
    "Utiliser différents seuils selon le type d’objet"
  ]'::jsonb,

  '[
    "Comment distinguer un signal isolé important d’une sur-interprétation de l’IA ?",
    "Comment conserver les objections minoritaires sans leur attribuer artificiellement une représentativité ?"
  ]'::jsonb,

  '[
    "C-1FE847B7",
    "A-71B783AA",
    "analysis-promotion-0.2"
  ]'::jsonb,

  'initial_phase',

  'provisional',

  'not_ratified'
),


/* ------------------------------------------------------------
   DP-0003
   ------------------------------------------------------------ */

(
  'DP-0003',

  'contribution-without-mandatory-account',

  'provisional_decision',

  'Permettre de contribuer sans créer de compte',

  'Une personne peut actuellement dialoguer avec le projet et publier une contribution validée sans créer de compte utilisateur.',

  'Cette décision vise à réduire les barrières d’entrée et à permettre une participation simple et pseudonyme.',

  'L’absence de compte rend plus difficiles certaines fonctions futures comme la gouvernance, la continuité entre appareils ou la prévention des participations multiples.',

  '[
    "Conserver la contribution sans compte",
    "Compte entièrement facultatif",
    "Identité pseudonyme locale",
    "Preuve d’unicité séparée de la contribution"
  ]'::jsonb,

  '[
    "Comment permettre une gouvernance fiable sans rendre le compte obligatoire ?",
    "Comment conserver la simplicité actuelle ?",
    "Comment ne pas transformer la lutte contre les participations multiples en mécanisme de surveillance ?"
  ]'::jsonb,

  '[]'::jsonb,

  'initial_phase',

  'provisional',

  'not_ratified'
),


/* ------------------------------------------------------------
   DP-0004
   ------------------------------------------------------------ */

(
  'DP-0004',

  'ai-analysis-explicitly-contestable',

  'provisional_decision',

  'Présenter les analyses de l’IA comme contestables',

  'Les interprétations produites par l’IA sont affichées séparément de la contribution et explicitement présentées comme contestables.',

  'Cette séparation vise à éviter qu’une interprétation automatisée soit confondue avec la parole du contributeur ou avec une vérité institutionnelle.',

  'Afficher l’incertitude de l’analyse ne garantit pas à lui seul que les utilisateurs disposent d’un moyen réel de la corriger ou d’en limiter les effets.',

  '[
    "Conserver la séparation actuelle",
    "Permettre la contestation structurée d’une analyse",
    "Ajouter plusieurs analyses indépendantes",
    "Permettre au contributeur de demander une nouvelle analyse"
  ]'::jsonb,

  '[
    "Quel effet concret doit avoir une contestation de l’analyse ?",
    "Une analyse contestée doit-elle rester active ?"
  ]'::jsonb,

  '[]'::jsonb,

  'initial_phase',

  'provisional',

  'not_ratified'
)

on conflict (canonical_key) do nothing;


/* ============================================================
   7. PROPOSITIONS DE GOUVERNANCE NON ADOPTÉES
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
  source,
  status,
  ratification_status

)
values

/* ------------------------------------------------------------
   PG-0001
   ------------------------------------------------------------ */

(
  'PG-0001',

  'voluntary-random-panel',

  'governance_proposal',

  'Panel de volontaires sélectionnés par tirage au sort',

  'Des personnes pourraient choisir librement de se rendre disponibles pour certains examens. Lorsqu’un panel est nécessaire, une partie des volontaires serait sélectionnée par un tirage publiquement vérifiable.',

  'Cette approche pourrait limiter le poids des participants les plus actifs tout en évitant d’imposer une participation à qui que ce soit.',

  'Un tirage au sort parmi des volontaires reste biaisé par la composition du groupe de volontaires et ne devient pas représentatif de la population générale.',

  '[
    "Panel ouvert sans tirage",
    "Échantillonnage stratifié",
    "Jury externe",
    "Aucun panel particulier"
  ]'::jsonb,

  '[
    "Comment vérifier l’unicité des volontaires tout en protégeant leur anonymat ?",
    "Quelle taille de panel serait pertinente ?",
    "Comment remplacer une personne sélectionnée qui refuse de participer ?"
  ]'::jsonb,

  'initial_phase',

  'non_adopted',

  'not_applicable'
),


/* ------------------------------------------------------------
   PG-0002
   ------------------------------------------------------------ */

(
  'PG-0002',

  'anonymous-voting-with-uniqueness-proof',

  'governance_proposal',

  'Vote anonyme avec preuve d’unicité',

  'Une future gouvernance pourrait permettre de prouver qu’une personne est autorisée à participer à un scrutin sans révéler son identité ni relier son vote à ses contributions.',

  'Des mécanismes cryptographiques pourraient permettre de limiter le double vote tout en séparant identité, contribution et scrutin.',

  'Empêcher une même preuve de voter deux fois ne suffit pas à empêcher une même personne d’obtenir plusieurs preuves. Le problème de l’unicité reste donc partiellement ouvert.',

  '[
    "Credentials cryptographiques",
    "Plusieurs niveaux de preuve d’unicité",
    "Tiers indépendants",
    "Autres formes de gouvernance ne reposant pas sur une personne égale une voix"
  ]'::jsonb,

  '[
    "Comment empêcher plusieurs inscriptions par une même personne ?",
    "Comment éviter de créer une autorité centrale d’identité ?",
    "Comment conserver une expérience accessible ?"
  ]'::jsonb,

  'initial_phase',

  'non_adopted',

  'not_applicable'
),


/* ------------------------------------------------------------
   PG-0003
   ------------------------------------------------------------ */

(
  'PG-0003',

  'community-and-random-panel-double-key',

  'governance_proposal',

  'Combiner décision communautaire et panel tiré au sort',

  'Certaines décisions importantes pourraient nécessiter à la fois un soutien de la communauté participante et l’examen indépendant d’un panel de volontaires sélectionnés aléatoirement.',

  'Deux mécanismes de légitimité différents pourraient agir comme contre-pouvoirs l’un pour l’autre.',

  'La double validation peut ralentir fortement les décisions, créer des blocages ou donner une importance excessive à un petit panel.',

  '[
    "Majorité seule",
    "Panel uniquement consultatif",
    "Droit d’alerte du panel sans pouvoir de blocage",
    "Procédures différentes selon l’importance de la décision"
  ]'::jsonb,

  '[
    "Quel pouvoir donner au panel ?",
    "Comment résoudre un désaccord entre les deux groupes ?",
    "Quelles décisions justifieraient une procédure renforcée ?"
  ]'::jsonb,

  'initial_phase',

  'non_adopted',

  'not_applicable'
),


/* ------------------------------------------------------------
   PG-0004
   ------------------------------------------------------------ */

(
  'PG-0004',

  'evolution-engine-proposal-only',

  'governance_proposal',

  'Moteur d’évolution autonome limité à la proposition',

  'Le système pourrait détecter des problèmes, produire plusieurs correctifs, rechercher leurs contre-arguments, préparer des tests et documenter les conséquences sans déployer lui-même les changements institutionnels.',

  'Cette capacité réduirait la dépendance envers les personnes qui développent actuellement le projet tout en séparant l’auto-analyse du pouvoir de décision.',

  'Même limité à la proposition, un moteur automatisé peut influencer fortement l’agenda en choisissant quels problèmes mettre en avant et quelles solutions présenter.',

  '[
    "Évolution entièrement humaine",
    "IA uniquement consultative",
    "Plusieurs moteurs indépendants",
    "Moteur capable d’appliquer automatiquement seulement des changements techniques réversibles"
  ]'::jsonb,

  '[
    "Qui contrôle ce que le moteur considère comme un problème ?",
    "Comment auditer les propositions qu’il ne produit pas ?",
    "Comment éviter qu’il favorise progressivement sa propre autonomie ?"
  ]'::jsonb,

  'initial_phase',

  'non_adopted',

  'not_applicable'
)

on conflict (canonical_key) do nothing;


/* ============================================================
   8. JOURNAL PUBLIC
   ============================================================ */

do $$

begin

  if not exists (

    select 1
    from public.events

    where event_type = 'governance_transparency_created'

      and details ->> 'change_id'
        = 'governance-transparency-v0.1'

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

      'governance_transparency_created',

      'Une couche publique de transparence de gouvernance a été créée afin de rendre visibles les questions ouvertes, les décisions provisoires et les propositions non adoptées.',

      jsonb_build_object(

        'change_id',
        'governance-transparency-v0.1',

        'purpose',
        'Rendre les choix initiaux consultables et contestables sans introduire de nouveau pouvoir décisionnel.',

        'methodological_limit',
        'Le nombre de contributions ne permet pas de connaître le nombre de contributeurs distincts.',

        'introduced',
        jsonb_build_array(
          'questions ouvertes de gouvernance',
          'décisions provisoires',
          'propositions de gouvernance',
          'liens futurs avec les contributions'
        ),

        'explicitly_not_introduced',
        jsonb_build_array(
          'vote',
          'tirage au sort',
          'preuve d’identité',
          'preuve d’unicité',
          'adoption automatique',
          'pouvoir décisionnel supplémentaire de l’IA'
        )

      ),

      'public'

    );

  end if;

end

$$;


commit;
