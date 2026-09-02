# Coexistence des intelligences — système vivant V0.1

Première instance technique d’un projet à vocation collective, destinée à rendre la contribution **accessible, vivante, traçable, contradictoire, réplicable et progressivement indépendante de son initiateur**.

## Ce que fait cette V0.1

- conversation sans lecture préalable ;
- page publique de compréhension progressive, de l’essentiel aux sources ;
- navigation simplifiée entre parole, exploration du corpus et compréhension du projet ;
- synthèse contrôlée par le contributeur ;
- aucune publication sans validation explicite ;
- conservation facultative de la conversation complète ;
- analyse structurée de chaque contribution ;
- rapprochement sémantique avec le corpus existant ;
- provenance épistémique explicite pour les objets qui alimentent le corpus ;
- séparation entre observations issues d'une contribution et thèmes réellement multi-contributions ;
- désaccords conservés avec la provenance de chaque position ;
- tensions inférées conservées sans être promues en désaccords du corpus ;
- thèmes, relations, risques, questions et propositions traçables ;
- tableau de bord public ;
- journal public du travail institutionnel de l'IA ;
- quarantaine en cas de risque de confidentialité ou d'intégrité ;
- synthèse collective automatique toutes les 6 heures lorsqu'il y a assez de matière ;
- signaux structurels non décisionnels pour un futur Evolution Engine ;
- reprise automatique des traitements ayant échoué ;
- premier protocole de fédération inter-instance en lecture seule ;
- aucune clé secrète dans le navigateur.

## Principe central

> La simplicité est devant. La rigueur est derrière.

Une personne peut contribuer en quelques secondes. La complexité de classement, confrontation et mémoire est portée par le système, tout en restant contestable.

## Comprendre le projet

Le projet distingue l’essentiel, son fonctionnement, ses fondations et ses sources. Les synthèses facilitent la lecture sans remplacer les documents ou conversations d’origine.

- [Commencer ici](docs/understanding/START_HERE.md)
- [État actuel](docs/understanding/PROJECT_STATE.md)
- [Finalité, philosophie et méthode](docs/understanding/PHILOSOPHY_AND_METHOD.md)
- [Contradictions et questions ouvertes](docs/understanding/CONTRADICTIONS_AND_OPEN_QUESTIONS.md)
- [Journal initial des décisions](docs/understanding/DECISION_LOG.md)
- [Guide de transmission](docs/understanding/HANDOVER.md)
- [Dossier de relecture extérieure du protocole 0.4](docs/understanding/PROTOCOL_0_4_EXTERNAL_REVIEW.md)
- [Glossaire](docs/understanding/GLOSSARY.md)
- [Index des conversations et sources](docs/understanding/CONVERSATION_ARCHIVE_INDEX.md)

Ces documents constituent actuellement des propositions de travail. Une règle techniquement active ne doit pas être confondue avec une décision collectivement ratifiée.

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
   │      ├── signaux structurels
   │      └── journal public
   │
   └── traitement périodique
          ├── reprise des erreurs
          ├── synthèse collective
          └── observation d'instances homologues
```

## Priorité actuelle

Le développement de nouvelles fonctions est temporairement suspendu au profit de la lisibilité, de l’accessibilité et de la transmission.

Avant toute nouvelle migration ou évolution structurelle :

1. consolider les documents de compréhension ;
2. permettre une relecture extérieure ;
3. distinguer clairement ce qui est actif, proposé ou encore ouvert ;
4. préparer la continuité du projet sans dépendance à son initiateur.

Le protocole d’analyse 0.4 est techniquement actif. Son activation a été conçue comme une opération coordonnée : sauvegarde vérifiée, migration `006`, fusion du code compatible, déploiement puis contrôles fonctionnels. Cette activation ne constitue pas une ratification collective : la méthode reste contestable et révisable.

`DEPLOYMENT.md` reste le document de référence pour les opérations techniques autorisées.

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
