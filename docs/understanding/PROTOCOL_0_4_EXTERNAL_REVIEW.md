# Dossier de relecture extérieure — protocole d’analyse 0.4

**Date de préparation : 2 septembre 2026**

**Statut : bloc préparé, testé, non migré, non fusionné et non ratifié**

**Périmètre examiné : pull request GitHub n° 3**

## Pourquoi ce document existe

Le projet cherche à devenir compréhensible et transmissible sans dépendre de son initiateur. Le protocole d’analyse 0.4 constitue un premier test concret de cette intention.

Ce document permet à une personne extérieure de comprendre ce qui est proposé, d’exprimer ce qui lui paraît obscur ou contestable, puis de décider librement si elle recommande ou non son activation technique provisoire.

Il ne demande aucune compétence informatique. Les détails techniques sont disponibles à la fin pour qui souhaite les examiner.

## Avant toute lecture : votre liberté

Le rôle de premier relecteur extérieur est une proposition, jamais une obligation.

Vous pouvez librement :

- accepter ou refuser ce rôle ;
- ne lire qu’une partie du dossier ;
- demander des explications supplémentaires ;
- prendre le temps que vous souhaitez ;
- formuler un désaccord sans devoir proposer de solution ;
- suspendre ou arrêter votre participation à tout moment ;
- choisir séparément si votre avis peut être conservé et s’il peut être rendu public.

Un refus, une hésitation ou une demande de délai ne constitue pas un rejet du projet et n’a pas à être justifié.

## L’essentiel en quelques minutes

Le projet recueille des expériences, idées, inquiétudes, questions et désaccords. Une intelligence artificielle aide à les reformuler et à les relier, mais elle ne doit pas parler au nom des personnes ni décider de l’orientation collective.

Le protocole 0.4 cherche surtout à mieux distinguer :

1. ce qu’une personne a réellement exprimé ;
2. ce que l’IA a seulement déduit ;
3. ce que l’IA a elle-même construit comme contre-argument.

Cette distinction doit éviter qu’une interprétation de l’IA soit présentée comme une opinion humaine ou comme un désaccord déjà présent dans le groupe.

Le protocole empêche également plusieurs analyses d’une même contribution de donner artificiellement l’impression que plusieurs personnes pensent la même chose.

Enfin, le système ne prépare plus automatiquement une nouvelle version du projet. Il peut seulement faire apparaître des signaux non décisionnels à examiner ultérieurement.

## Ce que votre avis peut réellement autoriser

Votre avis porte sur une **activation technique provisoire** du protocole 0.4.

Il ne constitue pas :

- une approbation définitive de toute la philosophie du projet ;
- une ratification au nom d’une communauté ;
- une preuve que les analyses de l’IA sont justes ;
- une obligation de continuer à participer ;
- une autorité permanente sur les futures versions.

L’objectif est de vérifier si une personne qui n’a pas conçu ce bloc peut le comprendre, le contester et contribuer à la décision avant son activation.

## Ce qui change avec le protocole 0.4

### 1. Origine des idées rendue visible

Chaque élément important doit indiquer s’il est :

- **explicite** : réellement formulé dans une contribution ;
- **inféré** : déduit par l’IA sans avoir été formulé ainsi ;
- **contre-argument de l’IA** : construit pour éprouver une idée et en montrer les limites.

Une inférence ou un contre-argument peut rester visible pour nourrir la réflexion, mais ne doit pas devenir une position attribuée au corpus.

### 2. Désaccords mieux protégés contre les inventions

Un désaccord collectif ne peut réunir que des positions explicitement présentes dans les contributions. Chaque position conserve ses propres sources.

Si une opposition repose en partie sur une déduction ou un contre-argument de l’IA, elle reste une tension analytique, pas un désaccord humain établi.

### 3. Différence entre un cas isolé et une tendance collective

Une observation issue d’une seule contribution reste présentée comme telle. Un thème ne peut être qualifié de multi-contributions que s’il s’appuie sur au moins deux contributions distinctes.

Deux analyses de la même contribution ne comptent donc pas comme deux sources humaines.

### 4. Suppression des propositions automatiques de nouvelle version

L’analyse collective ne produit plus directement de « candidat de version » complet.

Elle peut produire des **signaux structurels** : par exemple une contradiction récurrente, une règle à clarifier ou une limite souvent rencontrée. Ces signaux n’ont aucun pouvoir de décision.

Une éventuelle évolution devrait ensuite passer par des étapes distinctes : proposition, délibération, validation et seulement alors nouvelle version.

### 5. Traçabilité technique

Chaque analyse enregistre la version du protocole, le fournisseur d’IA et le modèle utilisés. Le système refuse actuellement tout fournisseur pour lequel aucun adaptateur explicite n’existe.

### 6. Conservation de l’histoire

Les anciennes analyses 0.2 et 0.3 restent conservées comme matériaux historiques. Les anciens « candidats de version » restent lisibles comme événements passés, sans apparaître comme une fonction encore active.

## Ce qui ne change pas

Le protocole 0.4 ne modifie pas les principes suivants :

- aucune contribution n’est publiée sans validation explicite ;
- la personne peut corriger la synthèse proposée ;
- l’IA n’est pas l’autorité finale ;
- le désaccord avec le projet reste légitime ;
- une fréquence de contributions ne prouve pas une majorité de personnes ;
- les analyses restent faillibles et contestables ;
- aucune règle technique ne devient automatiquement une décision collective.

## Ce que les tests permettent d’affirmer

Les contrôles automatisés vérifient notamment que :

- les champs de provenance sont exigés ;
- seuls des propos explicites peuvent devenir les positions d’un désaccord collectif ;
- plusieurs analyses d’une même contribution ne créent pas une fausse récurrence ;
- les candidats automatiques de version ont disparu du protocole actif ;
- les signaux structurels restent non décisionnels ;
- l’interface progressive et son fonctionnement mobile sont préservés ;
- la migration peut fonctionner sur une copie du projet qui ne possède pas exactement le même historique que l’instance d’origine.

Ces tests prouvent la cohérence attendue du code. Ils ne prouvent ni la justesse morale du protocole, ni la qualité réelle de chaque future analyse de l’IA.

## Limites actuellement connues

- Le corpus ne permet pas encore de connaître le nombre réel de personnes distinctes représentées.
- L’IA peut mal comprendre une contribution ou choisir un contre-argument peu pertinent.
- Le terme « meilleur contre-argument » ne garantit pas une supériorité objective.
- La contestation structurée d’une analyse IA n’est pas encore développée.
- La contribution privée, distincte d’une conversation non publiée, n’est pas encore disponible.
- Le mécanisme collectif de ratification n’est pas encore conçu.
- Le seul fournisseur d’analyse actuellement pris en charge est OpenAI ; les autres nécessitent un adaptateur explicite.
- Le protocole n’a pas encore été éprouvé sur un corpus important ni par une communauté extérieure.
- Une validation par un premier relecteur teste la compréhension et la transmission, pas une représentativité collective.
- La migration de base de données est préparée mais n’a pas été exécutée.
- Le code est proposé dans une branche séparée et n’a pas été fusionné dans la version principale.

## Contradictions à ne pas masquer

### Consolider le projet ou cesser de l’orienter

L’initiateur souhaite transmettre le projet rapidement, mais continue à consolider ses bases pour éviter qu’il devienne incompréhensible ou fragile.

Cette consolidation facilite la transmission, mais elle prolonge aussi son influence. La relecture extérieure est précisément destinée à rendre cette tension visible plutôt qu’à prétendre qu’elle est déjà résolue.

### Rendre l’analyse plus rigoureuse sans rendre l’outil inaccessible

La provenance épistémique réduit certaines confusions, mais augmente la complexité interne. L’interface doit cacher cette complexité par défaut sans la dissimuler à ceux qui souhaitent l’examiner.

### Conserver la mémoire sans figer les personnes

La traçabilité permet de comprendre l’évolution du projet. Elle ne doit pas faire croire qu’une ancienne parole représente encore la position actuelle d’une personne. Les corrections, changements de position et retraits du corpus actif doivent rester visibles comme évolutions de statut.

### Utiliser l’IA comme contradicteur sans lui donner une autorité

Les contre-arguments de l’IA peuvent aider à réfléchir. Ils peuvent aussi orienter involontairement la discussion par leur formulation ou leur sélection. Les identifier comme productions de l’IA réduit ce risque sans le supprimer.

### Signaler les évolutions possibles sans les décider automatiquement

Les signaux structurels limitent le pouvoir direct du moteur. Ils pourraient néanmoins devenir une forme d’autorité indirecte s’ils étaient plus tard traités comme des priorités objectives. Leur interprétation devra donc rester contestable.

## Questions proposées au premier relecteur

Il n’est pas nécessaire de répondre à toutes les questions.

Les réponses peuvent être données oralement, sur une feuille séparée ou dans l’espace libre de la section suivante.

1. Avec vos propres mots, qu’avez-vous compris de la finalité du protocole 0.4 ?
2. Quelle partie vous semble la plus claire ?
3. Quelle partie vous semble obscure, ambiguë ou trop technique ?
4. Voyez-vous un risque ou une contradiction qui manque dans ce dossier ?
5. La séparation entre propos explicites, inférences et contre-arguments vous paraît-elle compréhensible et utile ?
6. Comprenez-vous la différence entre activation technique provisoire et ratification collective ?
7. Souhaitez-vous demander une correction avant toute activation ?

## Réponse libre du premier relecteur

### Acceptation du rôle

- [ ] J’accepte librement d’être le premier relecteur extérieur de ce bloc.
- [ ] Je ne souhaite pas accepter ce rôle.
- [ ] Je souhaite décider plus tard.

### Avis sur le bloc

- [ ] Je recommande son activation technique provisoire.
- [ ] Je demande des corrections avant de me prononcer.
- [ ] Je recommande de différer son activation.
- [ ] Je ne recommande pas son activation.

### Explication, objections ou corrections demandées

_Espace de réponse libre :_



### Choix concernant la conservation et la visibilité de cet avis

Ces choix sont indépendants de l’avis donné sur le protocole.

- [ ] Mon avis peut être conservé dans les archives privées du projet.
- [ ] Mon avis peut être résumé dans le cheminement du projet après ma relecture du résumé.
- [ ] Mon avis complet peut être publié après ma validation explicite de sa version finale.
- [ ] Je ne souhaite pas que mon avis soit conservé au-delà de cette décision.
- [ ] Je souhaite décider plus tard.

**Date facultative :**

**Nom ou pseudonyme facultatif :**

## Conséquences de chaque réponse

- **Activation recommandée :** l’initiateur peut autoriser les opérations techniques. La sauvegarde est vérifiée, la migration 006 est exécutée et contrôlée, puis la pull request peut être fusionnée. Le protocole reste provisoire et contestable.
- **Corrections demandées :** la pull request reste ouverte. Les corrections sont préparées, expliquées et soumises à une nouvelle relecture.
- **Décision différée :** aucune migration ni fusion n’est effectuée. Aucun délai n’est imposé.
- **Activation non recommandée :** la migration et la fusion restent suspendues. Le bloc peut être abandonné, révisé ou conservé uniquement comme proposition historique.
- **Rôle refusé :** aucune conséquence négative n’en découle. Un autre mode de relecture devra être proposé sans attribuer ce refus à une opposition au projet.

## État technique exact au moment de cette relecture

- Pull request : `#3 — Integrate analysis protocol 0.4 with progressive interface`
- Branche proposée : `analysis-protocol-0.4-integration`
- Commit technique de référence : `ae96a6a97ffaa596e083d0fa0191893b55f735f2`
- Ajout du présent dossier : modification documentaire séparée, sans changement du protocole analysé
- Base principale examinée : `37782ffbd4ee556cf75ebd28d96e638aa53b7c35`
- Fichiers modifiés : 18
- Contrôles de syntaxe : réussis
- Contrat du protocole 0.4 : réussi
- Contrat de l’interface : réussi
- Tests d’exécution de l’interface : réussis
- Construction de l’aperçu Cloudflare : réussie
- Migration 006 : non exécutée
- Fusion dans `main` : non effectuée
- Déploiement 0.4 en production : non effectué

## Documents complémentaires

- `START_HERE.md` : présentation progressive du projet ;
- `PROJECT_STATE.md` : état général et limites connues ;
- `PHILOSOPHY_AND_METHOD.md` : philosophie et méthode ;
- `CONTRADICTIONS_AND_OPEN_QUESTIONS.md` : contradictions générales ;
- `DECISION_LOG.md` : décisions, propositions et statuts ;
- `HANDOVER.md` : règles de transmission ;
- `ARCHITECTURE.md` : fonctionnement technique ;
- `DEPLOYMENT.md` : procédure de migration et de déploiement.

## Principe de clôture

Ce bloc ne doit être considéré ni comme validé ni comme refusé tant que le premier relecteur n’a pas choisi librement de participer et formulé son avis.

La personne conserve le droit de changer ultérieurement de position. La mémoire du projet doit alors montrer l’évolution de son avis sans présenter l’ancienne position comme toujours actuelle.
