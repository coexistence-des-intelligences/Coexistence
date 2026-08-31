# Exploitation minimale

## À regarder régulièrement au début

- dépenses API IA ;
- erreurs de build Cloudflare ;
- lignes `processing_error` dans `contributions` ;
- volume de `quarantined` ;
- croissance de `rate_limits` ;
- pertinence des premières analyses.

## Ne pas corriger les contributions manuellement

Si l'IA comprend mal un type de contribution, corriger le **protocole** publiquement plutôt que réécrire silencieusement les contributions.

## Panne d'OpenAI

Les contributions restent en `pending_analysis` ou `processing_error`. Le cron de 15 minutes retente plus tard.

## Panne de Supabase

Le site statique peut rester visible mais les fonctions dynamiques échouent. Après restauration, reprendre les traitements en attente.

## Panne de Cloudflare

Le dépôt Git + la base doivent permettre de redéployer le Worker ailleurs. Cette reconstruction doit être testée avant sortie complète du fondateur.
