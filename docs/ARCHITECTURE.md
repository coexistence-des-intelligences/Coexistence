# Architecture V0.1

## But

Créer un système où une contribution validée devient matière collective sans intervention manuelle du fondateur.

## Deux boucles séparées

### Boucle intellectuelle

`parler → comprendre → valider → publier → analyser → relier → contredire → synthétiser → signaler → être contesté`

### Boucle d'intégrité

`recevoir → limiter → analyser le risque de publication → publier/quarantaine → journaliser → reprendre/restaurer`

Aucune contribution ne peut directement exécuter du code, modifier un prompt système, obtenir un secret ou adopter une règle.

## Traitement d'une contribution

1. Le dialogue reste dans le navigateur et l'API de conversation.
2. Le contributeur demande une synthèse.
3. Il peut la modifier.
4. Il confirme explicitement le partage.
5. La synthèse est enregistrée en `pending_analysis`.
6. Une empreinte sémantique est calculée.
7. Les contributions publiques voisines sont recherchées.
8. Une analyse structurée et versionnée est créée.
9. Si un risque de publication est détecté : `quarantined`.
10. Sinon : `published` puis alimentation des thèmes, relations, risques, questions et propositions.
11. Un événement public est ajouté au journal.

## Synthèse collective

Toutes les 6 heures, uniquement s'il existe assez de matière :

- lecture d'un échantillon récent d'analyses publiques ;
- séparation des thèmes réellement multi-contributions et des observations isolées ;
- conservation des désaccords uniquement lorsque chaque position est explicitement ancrée ;
- conservation séparée des oppositions inférées comme tensions analytiques ;
- mise à jour des risques, questions et propositions explicitement présents dans le corpus ;
- production possible de signaux structurels non décisionnels.

Le moteur de synthèse ne produit plus de candidat de version. Les signaux structurels pourront servir d'entrées à un futur Evolution Engine distinct, sans adoption ni modification automatique du projet.

## Provenance épistémique

Le protocole d'analyse 0.4 distingue ce qui est explicitement présent dans une contribution, ce qui est inféré par l'IA et ce qui est construit comme contre-argument. Un objet inféré peut rester visible dans la synthèse, mais il n'est pas promu comme position, risque, question ou proposition exprimée par le corpus.

Les analyses et synthèses enregistrent également leur version de protocole, leur fournisseur et leur modèle. Le fournisseur actif reste OpenAI ; toute autre valeur est refusée tant qu'un adaptateur explicite n'a pas été implémenté, afin d'éviter une provenance technique trompeuse.

## Données

La base n'est jamais directement exposée au navigateur dans V0.1. Toutes les lectures publiques passent par des routes filtrées du Worker.

## Portabilité

- interface : HTML/CSS/JS sans framework obligatoire ;
- serveur : Worker JavaScript standard et appels HTTP ;
- données : PostgreSQL + pgvector ;
- IA : appels HTTP isolés dans `src/openai.js`, avec provenance fournisseur/modèle et refus explicite des fournisseurs non encore adaptés ;
- protocoles/documents : fichiers publics dans Git.
