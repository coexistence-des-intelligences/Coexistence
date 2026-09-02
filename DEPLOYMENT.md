# Mise en ligne — pas à pas

Vous avez déjà créé : GitHub, Supabase, OpenAI API et Cloudflare.

## Étape 1 — Créer le dépôt GitHub

1. Ouvrir l'organisation GitHub créée pour le projet.
2. **New repository**.
3. Nom conseillé : `coexistence`.
4. Visibilité : **Public**.
5. Ne pas ajouter de README automatique (il existe déjà dans le paquet).
6. Créer le dépôt.

### Mettre les fichiers dans le dépôt sans utiliser la ligne de commande

Le plus simple :

1. Télécharger et décompresser le ZIP fourni par ChatGPT.
2. Dans le dépôt GitHub vide : **Add file → Upload files**.
3. Glisser le contenu du dossier décompressé dans la zone d'envoi.
4. Vérifier que les dossiers `src`, `public`, `database`, `docs`, `protocols`, `tests` apparaissent.
5. Message : `Initial open state V0.1`.
6. Valider le commit.

Si l'interface web refuse un dossier imbriqué, utiliser GitHub Desktop : ajouter le dossier local comme dépôt puis **Publish repository** dans l'organisation.

---

## Étape 2 — Initialiser Supabase

1. Ouvrir votre projet Supabase.
2. Ouvrir **SQL Editor**.
3. **New query**.
4. Ouvrir localement `database/001_init.sql`.
5. Copier tout son contenu dans l'éditeur SQL.
6. Cliquer **Run**.
7. Le script doit terminer sans erreur.

Il crée les tables du corpus, les index vectoriels, le journal, le rate-limit et les fonctions nécessaires.

### Instance déjà initialisée

Sur une instance existante, ne rejouez pas `001_init.sql`. Appliquez les migrations numérotées manquantes dans l'ordre, une seule fois, après sauvegarde de la base et vérification de la branche de code correspondante.

La migration `database/006_analysis_protocol_0_4.sql` doit rester en attente tant que le bloc 0.4 n'a pas été validé et explicitement approuvé.

Le Worker 0.4 lit des colonnes créées par `006`. Si `main` déclenche automatiquement un déploiement Cloudflare, ne fusionnez donc pas le code 0.4 avant la migration.

Lorsqu'elle sera autorisée, l'ordre sûr sera :

1. vérifier une sauvegarde récupérable de la base ;
2. exécuter uniquement `006` dans Supabase ;
3. contrôler les colonnes, contraintes, index et la table `structural_signals` ;
4. fusionner le code 0.4 compatible dans `main` ;
5. attendre le déploiement Cloudflare réussi ;
6. contrôler les routes publiques, une analyse de test et le journal ;
7. en cas d'échec du Worker, redéployer temporairement le commit logiciel précédent : la migration reste compatible avec l'ancien Worker.

Une migration de base ne doit jamais être lancée automatiquement par le Worker. Un aperçu de branche utilisant la base réelle ne doit pas recevoir de contribution tant que `006` n'est pas appliquée.

### Vérification

Dans **Table Editor**, vous devez notamment voir :

- `contributions`
- `analyses`
- `themes`
- `disagreements`
- `risks`
- `questions`
- `proposals`
- `events`

---

## Étape 3 — Récupérer l'URL et la clé serveur Supabase

Dans Supabase :

1. Ouvrir le dialogue **Connect**, ou **Settings → API Keys**.
2. Copier l'URL du projet, du type : `https://xxxx.supabase.co`.
3. Utiliser de préférence une **Secret key** moderne commençant par `sb_secret_...`.
4. Ne jamais utiliser cette clé dans le navigateur ou dans GitHub.

Nous n'avons pas besoin d'une clé publique dans cette V0.1 : toutes les requêtes passent par le Worker serveur.

---

## Étape 4 — Connecter GitHub à Cloudflare

1. Cloudflare → **Workers & Pages**.
2. **Create application**.
3. **Import a repository**.
4. Connecter le compte GitHub si nécessaire.
5. Choisir le dépôt `coexistence`.
6. Cloudflare détectera `wrangler.jsonc`.
7. Commande de déploiement si elle est demandée : `npx wrangler deploy`.
8. Sauvegarder la configuration.

Le premier déploiement peut échouer tant que les secrets ne sont pas encore configurés ; ce n'est pas grave.

---

## Étape 5 — Ajouter les secrets Cloudflare

Dans le Worker → **Settings → Variables and Secrets** (le libellé peut légèrement varier) :

Ajouter comme **Secrets** :

### `OPENAI_API_KEY`
Votre clé du projet API OpenAI.

### `SUPABASE_URL`
Exemple : `https://xxxx.supabase.co`

### `SUPABASE_SECRET_KEY`
La clé Supabase `sb_secret_...`.

### `RATE_LIMIT_SECRET`
Créer une chaîne aléatoire longue. Vous pouvez utiliser un gestionnaire de mots de passe pour générer 40 à 80 caractères aléatoires.

Optionnel :

### `FEDERATION_PEERS`
Au départ : `[]`

**Ne jamais copier ces valeurs dans un message public, GitHub ou une contribution.**

---

## Étape 6 — Déployer

Dans Cloudflare : relancer le build/déploiement du dernier commit.

Vous devez obtenir une URL du type :

`https://coexistence-des-intelligences.<votre-sous-domaine>.workers.dev`

C'est la première véritable URL publique du projet.

---

## Étape 7 — Faire les tests minimaux avant de partager

### Test A — conversation ordinaire

Dire :

> Dans mon quartier il n'y a plus de lieu où les jeunes peuvent se retrouver sans devoir consommer.

L'IA doit chercher à comprendre sans parler artificiellement d'IA.

### Test B — critique du projet

Dire :

> Je pense que votre projet est naïf et qu'une intelligence collective finira forcément par manipuler les gens.

Cette idée doit être accueillie comme contribution possible, pas bloquée.

### Test C — synthèse

Cliquer **Synthétiser ce que j'ai dit**, corriger quelques mots et valider.

### Test D — vérifier le corpus

Attendre quelques secondes, puis ouvrir **Comprendre** et actualiser. La contribution doit apparaître si elle n'a pas été placée en quarantaine.

### Test E — journal

Ouvrir **Journal**. Un événement `contribution_published` doit apparaître.

### Test F — confidentialité

Tester avec une fausse adresse e-mail clairement identifiable. Le système devrait préférer la quarantaine à la publication automatique.

---

## Étape 8 — Ne partager ensuite qu'un lien

Message conseillé :

> J'expérimente un projet collectif où chacun peut dire très simplement ce qu'il pense qu'on pourrait améliorer autour de nous ou dans le monde. Tu peux y passer trente secondes ou discuter plus longtemps. Rien n'est partagé sans ta validation.

Ne demandez pas aux gens de lire d'abord la Charte.

---

## Étape 9 — Après les premières contributions

Ne les centralisez pas manuellement.

Observez surtout :

- **Comprendre** : ce que le corpus fait émerger ;
- **Désaccords** : ce que le système ne parvient pas à résoudre ;
- **Évolution** : ce qu'il propose de modifier ;
- **Journal** : ce que l'IA et l'infrastructure ont réellement fait.

Le but est précisément que ces écrans deviennent les outils de suivi de tout le monde, pas seulement du fondateur.

---

## Étape 10 — Ne pas encore vous retirer techniquement

Le retrait intellectuel peut commencer très vite.

Le retrait administratif doit attendre que :

- un deuxième mainteneur sache redéployer ;
- les sauvegardes hors Supabase existent ;
- les coûts ne reposent plus silencieusement sur une seule personne ;
- les accès puissent être transférés ;
- une procédure de récupération ait été réellement testée.

Voir `docs/FOUNDER_EXIT.md`.
