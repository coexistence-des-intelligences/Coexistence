# Sécurité et résilience — état initial

## Principe

Le système protège son **fonctionnement**, pas ses **idées**.

« Ce projet devrait disparaître » est une contribution possible.

Saturer l'API avec des millions de requêtes est une attaque contre la disponibilité.

## Défenses présentes dans V0.1

- secrets uniquement côté serveur ;
- base non accessible directement au navigateur ;
- RLS activée sur toutes les tables ;
- rate-limit pseudonymisé par HMAC d'IP + User-Agent ;
- conservation du pseudo-identifiant uniquement dans la table temporaire de rate-limit ;
- détection simple de coordonnées personnelles ;
- analyse IA du risque de publication ;
- état `quarantined` plutôt que suppression ;
- séparation entre texte du contributeur et instructions du système ;
- aucune capacité d'administration accordée au modèle IA ;
- journal public des mises en quarantaine sans publication du contenu concerné ;
- retraitement automatique des erreurs ;
- corpus structuré pour être exportable.

## Défenses à ajouter avant très grande diffusion

- Cloudflare Turnstile ou mécanisme équivalent ;
- règles WAF/rate limiting au niveau réseau ;
- sauvegardes chiffrées hors fournisseur principal ;
- test automatisé de restauration ;
- système de revue distribuée des quarantaines ;
- signatures cryptographiques pour la fédération ;
- alertes de coûts et coupure automatique de certaines fonctions coûteuses ;
- politique formelle de réponse aux incidents ;
- audit externe du code et des permissions.

## Principe anti-auto-immunité

Une défense qui empêche une contestation légitime devient elle-même un risque.

Toute règle de quarantaine importante doit pouvoir être auditée et, à terme, contestée.
