# Ajouter un cours

Le contenu pédagogique vit dans [`catalog.ts`](./catalog.ts). La page ne contient que l'affichage, la progression et les interactions.

Ajoutez une entrée dans `RAW_LESSONS` avec :

- un `id` unique ;
- au moins une `terminalTask` avec un `guideId` existant ;
- les objectifs dans `takeaways` ;
- une question dans `exercise` ;
- une source documentaire.

Un `challenge` est optionnel. Ses `guideId`, ses tâches et ses étapes sont vérifiés au chargement du catalogue. Les nouveaux cours apparaissent automatiquement dans la navigation et la recherche de progression.
