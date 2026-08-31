# Architecture V0.1

## But

Créer un système où une contribution validée devient matière collective sans intervention manuelle du fondateur.

## Deux boucles séparées

### Boucle intellectuelle

`parler → comprendre → valider → publier → analyser → relier → contredire → synthétiser → proposer → être contesté`

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
- recherche de convergences et divergences ;
- mise à jour des désaccords, risques et questions ;
- propositions possibles ;
- candidat de version possible.

Un candidat de version reste une `proposal` ouverte. Aucun code ne l'adopte automatiquement.

## Données

La base n'est jamais directement exposée au navigateur dans V0.1. Toutes les lectures publiques passent par des routes filtrées du Worker.

## Portabilité

- interface : HTML/CSS/JS sans framework obligatoire ;
- serveur : Worker JavaScript standard et appels HTTP ;
- données : PostgreSQL + pgvector ;
- IA : appels HTTP isolés dans `src/openai.js` afin de pouvoir remplacer le fournisseur ;
- protocoles/documents : fichiers publics dans Git.
