/**
 * Échelle typographique IBM Plex.
 *
 * Neuf niveaux qui remplaceront progressivement les dix-huit variantes Inter
 * de `tokens.ts`. Ils sont fusionnés dans le même objet `type` — c'est lui que
 * `<Text variant>` interroge — mais vivent dans ce fichier pour que la
 * bascule se lise d'un coup d'œil, et se retire d'un seul `git revert` si elle
 * ne convient pas.
 *
 * Rien n'est supprimé pendant la migration : un écran non repris continue de
 * demander `body` ou `title` et s'affiche en Inter. Les deux familles sont
 * chargées le temps de la passe.
 *
 * ---
 *
 * **Une graisse = une famille.** Android ignore `fontWeight` sur les polices
 * personnalisées : `fontFamily: 'IBMPlexSans', fontWeight: '700'` y rend du
 * 400 Regular, et le contraste entre un titre et un sous-titre disparaît sans
 * que rien ne le signale. Chaque niveau porte donc le nom complet de sa
 * graisse, et aucun ne porte de `fontWeight`.
 *
 * **`letterSpacing` en points.** React Native ne connaît pas les em. Les
 * valeurs ci-dessous sont déjà converties et posées telles quelles, sans
 * passer par le convertisseur `em()` des anciennes variantes : ce sont les
 * chiffres relevés sur les maquettes de la refonte, et les réexprimer en
 * fractions les ferait dériver à l'arrondi.
 */

const plexSans = {
  regular: 'IBMPlexSans_400Regular',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

const plexCondensed = {
  semibold: 'IBMPlexSansCondensed_600SemiBold',
} as const;

const plexMono = {
  medium: 'IBMPlexMono_500Medium',
  semibold: 'IBMPlexMono_600SemiBold',
} as const;

export const plexType = {
  /** D1 — vitesse en mode conduite, chiffre du bouton SOS. */
  d1: { fontFamily: plexSans.bold, fontSize: 34, lineHeight: 34, letterSpacing: -1.0 },

  /** H1 — titre d'écran. */
  h1: { fontFamily: plexSans.bold, fontSize: 22, lineHeight: 26, letterSpacing: -0.55 },

  /** H2 — nom de garage, libellé de ligne de réglage. */
  h2: { fontFamily: plexSans.semibold, fontSize: 15, lineHeight: 19, letterSpacing: -0.23 },

  /** TXT — corps, descriptions, texte courant. */
  txt: { fontFamily: plexSans.regular, fontSize: 14, lineHeight: 20, letterSpacing: 0 },

  /** LBL — filets de section rouges, en capitales. */
  lbl: {
    fontFamily: plexSans.bold,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase' as const,
  },

  /** NUM — toute donnée mesurée. */
  num: { fontFamily: plexMono.semibold, fontSize: 16, lineHeight: 20, letterSpacing: -0.16 },

  /** NUM petit — méta de carte : ★4,6 · 1,2 km. */
  numSm: { fontFamily: plexMono.medium, fontSize: 10, lineHeight: 14, letterSpacing: 0.1 },

  /** NUM géant — compteur du mode conduite. */
  numXl: { fontFamily: plexMono.semibold, fontSize: 52, lineHeight: 52, letterSpacing: -1.6 },

  /** CND — adresses longues et libellés contraints uniquement. */
  cnd: { fontFamily: plexCondensed.semibold, fontSize: 14, lineHeight: 18, letterSpacing: 0 },
} as const;

/** Les niveaux de la nouvelle échelle, pour distinguer le repris du reste. */
export type PlexVariant = keyof typeof plexType;
