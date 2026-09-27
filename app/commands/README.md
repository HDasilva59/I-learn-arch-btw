# Ajouter une commande

Les fiches sont rangées par domaine dans [`domains/`](./domains/). [`catalog.ts`](./catalog.ts) les recombine en une vue plate ; la page, le moteur de recherche et l'analyseur consomment automatiquement `COMMAND_GUIDES`.

Choisissez le domaine correspondant : `filesystem`, `text`, `network`, `processes`, `system`, `kernel`, `packages`, `archives` ou `shell`.

Pour ajouter une fiche rédigée, ajoutez une entrée dans le domaine correspondant :

```ts
newcommand: {
  purpose: "Explain what the command does.",
  syntax: "newcommand [options] [path]",
  parts: [
    { token: "-n", meaning: "Explain this option." },
  ],
  note: "Mention the important usage or safety detail.",
},
```

Les commandes découvertes dans ArchWiki mais pas encore rédigées manuellement vivent dans [`domains/archwiki.ts`](./domains/archwiki.ts). Elles sont explicitement marquées comme couverture générée et doivent être enrichies avant de recevoir une documentation détaillée.

L'inventaire complémentaire issu de [tldr-pages/tldr](https://github.com/tldr-pages/tldr) est généré dans [`domains/tldr.ts`](./domains/tldr.ts). Ne modifiez pas ce fichier à la main : lancez `pnpm commands:sync-tldr` pour le régénérer depuis les pages `common` et `linux` du dépôt tldr. Le synchroniseur conserve un résumé, une forme d'utilisation et les options rencontrées dans les exemples ; les fiches tldr restent une référence pratique et ne remplacent pas les manpages.

Le contenu tldr est sous [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). L'attribution et les modifications sont documentées dans [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) et dans le pied de page du site.

Le type vérifie les `guideId` utilisés par les cours et la validation runtime refuse les champs vides. Lancez `pnpm commands:check` après une modification. Une variante de commande déjà reconnue par le moteur (`pacman`, `tar`, `find`, `systemctl`) peut aussi nécessiter une règle dans `command-explainer.ts`.
