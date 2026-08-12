# PROMPT 2 — Setup & thème

> À envoyer après validation de l'architecture. Joindre : aucune maquette.

---

On démarre l'implémentation de GeoCras selon l'architecture validée.

Cette étape ne produit **aucun écran**. Objectif : un socle propre.

1. Initialise le projet Expo TypeScript et installe les dépendances retenues.
2. Charge les polices **Inter** (400/500/600/700/800) et **IBM Plex Mono** (400/500/600/700)
   via `expo-font`, avec un écran de chargement tant qu'elles ne sont pas prêtes.
3. Crée `src/theme/theme.ts` exposant `colors.light`, `colors.dark`, `space`, `radius`,
   `type` (styles de texte nommés) et `shape` (les valeurs de chamfer).
   Reprends **exactement** la palette du `CLAUDE.md`.
4. Crée un `ThemeProvider` + hook `useTheme()`, avec bascule clair / sombre / auto
   persistée (`expo-secure-store` ou AsyncStorage).
5. Crée les primitives réutilisables, toutes typées :
   - `<Text>` avec les variantes du thème, dont une variante `mono` pour les chiffres
   - `<ChamferView>` : conteneur au coin inférieur droit coupé (react-native-svg
     ou masque) — c'est la brique de l'identité visuelle, elle doit être propre
   - `<Button variant="primary" | "outline" | "success">`
   - `<SectionLabel>` : le filet rouge 14×2 + libellé majuscule
   - `<Stars value={4.6} />`
6. Écris un écran de démonstration temporaire qui affiche toutes les primitives dans les
   deux thèmes, pour que je valide le rendu.

Ne crée aucun écran produit à cette étape.
