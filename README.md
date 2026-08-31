# Coexistence des intelligences — système vivant V0.1

Première instance technique destinée à rendre le projet **accessible, vivant, traçable, contradictoire, réplicable et progressivement indépendant de son initiateur**.

## Ce que fait cette V0.1

- conversation sans lecture préalable ;
- synthèse contrôlée par le contributeur ;
- aucune publication sans validation explicite ;
- conservation facultative de la conversation complète ;
- analyse structurée de chaque contribution ;
- rapprochement sémantique avec le corpus existant ;
- thèmes, tensions, relations, risques, questions et propositions ;
- désaccords conservés au lieu d'être aplatis ;
- tableau de bord public ;
- journal public du travail institutionnel de l'IA ;
- quarantaine en cas de risque de confidentialité ou d'intégrité ;
- synthèse collective automatique toutes les 6 heures lorsqu'il y a assez de matière ;
- candidats de version possibles, **jamais adoptés automatiquement** ;
- reprise automatique des traitements ayant échoué ;
- premier protocole de fédération inter-instance en lecture seule ;
- aucune clé secrète dans le navigateur.

## Principe central

> La simplicité est devant. La rigueur est derrière.

Une personne peut contribuer en quelques secondes. La complexité de classement, confrontation et mémoire est portée par le système, tout en restant contestable.

## Architecture

```text
Navigateur
   │
   ▼
Cloudflare Worker + Static Assets
   ├── dialogue ───────────────► API IA
   ├── synthèse ───────────────► API IA
   ├── validation
   │      │
   │      ▼
   │   Supabase/PostgreSQL
   │      │
   │      ├── contribution
   │      ├── analyse versionnée
   │      ├── thèmes / relations
   │      ├── désaccords / risques / questions
   │      ├── propositions
   │      └── journal public
   │
   └── traitement périodique
          ├── reprise des erreurs
          ├── synthèse collective
          └── observation d'instances homologues
```

## À faire maintenant

Suivre **`DEPLOYMENT.md`** dans l'ordre. Aucun code n'est à écrire.

## Secrets nécessaires

Dans Cloudflare uniquement :

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (recommandé) ou ancien `SUPABASE_SERVICE_ROLE_KEY`
- `RATE_LIMIT_SECRET`
- optionnel : `FEDERATION_PEERS`

Ne jamais les mettre dans GitHub.

## État du projet

Cette V0.1 est un **état initial ouvert**, pas une doctrine finalisée. Le code et les protocoles doivent pouvoir être contestés, remplacés et reproduits.

## Licence

Le choix de licence est volontairement laissé ouvert dans cette première archive afin de ne pas imposer seul un choix institutionnel important. Voir `docs/LICENSING_DECISION.md`.
