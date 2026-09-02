# État actuel du projet

**Date du point d’arrêt : 2 septembre 2026**  
**Statut : photographie factuelle à maintenir à jour**

## Nature de cette phase

Coexistence des intelligences est actuellement un projet initié par une personne avec l’aide d’une intelligence artificielle, dans l’intention de devenir un projet collectif.

Ses principes n’ont pas encore été ratifiés par une communauté extérieure. Une règle présente dans le code ne doit donc pas être confondue avec une décision collectivement adoptée.

## Présent dans le projet

- porte d’entrée conversationnelle ;
- synthèse contrôlée par le contributeur ;
- validation explicite avant partage ;
- possibilité de garder la conversation complète non publique ;
- enregistrement des contributions publiées ;
- analyse individuelle structurée ;
- rapprochement avec le corpus ;
- synthèse inter-contributions ;
- thèmes, désaccords, risques, questions et propositions ;
- journal public ;
- mécanisme de quarantaine ;
- traitement périodique ;
- première base de fédération entre instances ;
- documentation d’architecture, sécurité, exploitation et sortie de l’initiateur.

## Préparé et vérifié, mais non activé

Le protocole d’analyse 0.4 est préparé sur la branche `analysis-protocol-0.4`.

Il introduit notamment :

- provenance épistémique explicite ;
- distinction entre `explicit`, `inferred` et `ai_counterargument` ;
- provenance propre à chaque position d’un désaccord ;
- interdiction de transformer une position implicite en désaccord du corpus ;
- séparation entre observations isolées et thèmes multi-contributions ;
- suppression des candidats automatiques de version ;
- signaux structurels non décisionnels ;
- provenance du fournisseur et du modèle d’IA.

Les contrôles automatisés du contrat 0.4 passent dans la copie locale vérifiée.

## En attente

- migration `database/006_analysis_protocol_0_4.sql` ;
- merge du bloc 0.4 vers `main` ;
- déploiement de la version compatible ;
- vérification en conditions réelles après migration.

La migration `006` ne doit pas être exécutée isolément ou automatiquement.

## Fonctions futures, non présentes

- conservation d’une contribution privée distincte d’une simple conversation non publiée ;
- contestation structurée d’une analyse IA ;
- espace humain de délibération ;
- Evolution Engine en mode proposition uniquement ;
- mécanisme de ratification ;
- autodiagnostic institutionnel ;
- interopérabilité avec Polis, Decidim, Loomio ou CIP ;
- bifurcations liées entre instances ;
- signatures cryptographiques de fédération ;
- propagation des corrections et changements de statut entre instances ;
- profil épistémique sans pondération des personnes ;
- restauration testée sans intervention de l’initiateur.

## Limites connues

- le corpus ne permet pas de connaître le nombre de personnes distinctes ;
- les analyses IA restent faillibles ;
- le terme « meilleur contre-argument » ne garantit pas que l’IA a trouvé objectivement le meilleur argument possible ;
- la contribution privée n’est pas encore conçue ;
- les mécanismes de ratification ne sont pas finalisés ;
- la fédération n’est pas encore authentifiée cryptographiquement ;
- les conditions de retrait ou de correction après fédération ne sont pas définies ;
- l’interface masque actuellement certaines explications sur les petits écrans ;
- la continuité administrative et financière dépend encore de l’initiateur ;
- aucune licence de réutilisation n’a encore été ratifiée ;
- l’archive complète des conversations est en cours de récupération ;
- le projet n’a pas encore été éprouvé par une communauté extérieure.

## Priorité actuelle

Le développement de nouvelles fonctions est suspendu au profit de :

1. la lisibilité ;
2. l’accessibilité ;
3. la documentation des statuts ;
4. la conservation du cheminement ;
5. la transmission à une personne extérieure ;
6. la préparation de la dispensabilité fonctionnelle de l’initiateur.

## Registre des familles de versions

- **Version générale du projet** : photographie publique de l’ensemble.
- **Version de la charte** : état historique ou ratifié du texte.
- **Protocole d’analyse** : règles guidant l’IA.
- **Migration de base** : transformation technique des données.
- **Protocole de fédération** : règles d’échange entre instances.
- **Version logicielle** : code effectivement déployé.

Ces familles ne doivent jamais être confondues.

## Condition avant reprise du développement

Une personne extérieure doit pouvoir :

- comprendre la finalité ;
- distinguer les fonctions présentes des idées futures ;
- retrouver l’origine des décisions ;
- identifier les limites ;
- formuler une objection ;
- comprendre comment le projet pourrait continuer sans son initiateur.
