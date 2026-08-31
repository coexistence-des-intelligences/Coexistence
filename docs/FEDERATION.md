# Fédération des instances — protocole 0.1-draft

## Intuition

Une copie ne doit pas être seulement une sauvegarde. Plusieurs instances peuvent devenir des intelligences collectives autonomes qui s'informent et se contredisent.

## Présent dans V0.1

Chaque instance expose :

- `/.well-known/coexistence.json`
- `/api/federation/events`

Une instance peut recevoir une liste de pairs via `FEDERATION_PEERS`.

Toutes les données importées sont enregistrées comme **non vérifiées** et ne modifient pas directement le corpus local.

## Règles conceptuelles

- recevoir ≠ adopter ;
- une instance ≠ une voix ;
- la provenance est conservée ;
- les divergences sont des données ;
- une instance peut refuser une interprétation sans rompre la fédération ;
- la convergence n'est pas l'objectif obligatoire.

## Étape suivante

Ajouter des signatures Ed25519 par instance :

1. chaque instance possède une paire de clés ;
2. la clé publique figure dans `/.well-known/coexistence.json` ;
3. chaque paquet d'événements est signé ;
4. l'instance réceptrice vérifie la signature ;
5. la confiance dans l'origine ne signifie toujours pas adhésion au contenu.

Cette étape n'est volontairement pas activée dans V0.1 afin de ne pas prétendre à une sécurité cryptographique non testée.
