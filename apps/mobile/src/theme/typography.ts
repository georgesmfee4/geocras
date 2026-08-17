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

/* ------------------------------------------------------------------------ *
 * Bebas Neue — titres, sous-titres, libellés de section, textes de boutons.
 * ------------------------------------------------------------------------ */

/**
 * Bebas prend l'affichage, pas la lecture.
 *
 * C'est une capitale condensée à graisse unique : excellente en gros, en court
 * et en capitales, illisible en paragraphe. Le partage est donc fonctionnel et
 * ne souffre pas d'exception — **si c'est une phrase, ce n'est pas Bebas.** Un
 * nom de garage isolé est un titre ; le même nom dans « 3 garages trouvés »
 * est une phrase et reste en Plex Sans.
 *
 * Les données mesurées ne basculent jamais : `num`, `numSm`, `numXl` gardent
 * Plex Mono. Les chiffres de Bebas sont condensés et sans chasse fixe — une
 * colonne d'ETA y deviendrait irrégulière à chaque rafraîchissement.
 *
 * ---
 *
 * **Deux conversions déjà appliquées, à ne pas refaire.**
 *
 * Les tailles ≥ 14 px sont remontées d'environ 9 % : à taille nominale égale,
 * la hauteur de capitale condensée de Bebas rend plus petit que Plex.
 *
 * Le crénage négatif disparaît. Plex portait un `letterSpacing` négatif pour
 * resserrer ; Bebas est déjà condensée et la resserrer encore la ferme. Toutes
 * les valeurs sont positives, et en **points** — React Native ne connaît pas
 * les em.
 *
 * ---
 *
 * **Pas de `textTransform: 'uppercase'` ici, et ce n'est pas un oubli.**
 *
 * Les glyphes minuscules de Bebas sont des copies exactes des capitales —
 * mêmes contours, même chasse, vérifié paire par paire dans le binaire. La
 * capitalisation est donc acquise sans transformation, et l'ajouter n'aurait
 * qu'un effet : casser le repli ci-dessous, qui lui a un vrai bas-de-casse.
 */
const bebas = 'BebasNeue_400Regular';

/** La famille réellement demandée quand Bebas est disponible. */
export const BEBAS_FAMILY = bebas;

/**
 * Repli, dans cet ordre : Bebas → IBM Plex Sans Condensed 600.
 *
 * React Native ne connaît pas les piles de polices : `fontFamily` prend un nom
 * et un seul, la substitution doit donc se décider en JS. Elle est appliquée
 * par `<Text>`, qui interroge `Font.isLoaded()`.
 *
 * Ce n'est pas une précaution théorique. L'app ne peint rien tant que les
 * polices ne sont pas prêtes, mais `useFonts` signale un échec pour **le lot** :
 * Bebas peut manquer alors que Plex Condensed est bien là. Ce sont les deux
 * seules condensées du projet, la substitution passe presque inaperçue.
 *
 * Contrepartie assumée : le repli a un vrai bas-de-casse. Un libellé de section
 * saisi « Mon activité » perdrait ses capitales pendant la substitution —
 * `<Text>` remet donc `textTransform` uniquement dans ce cas.
 */
export const BEBAS_FALLBACK_FAMILY = 'IBMPlexSansCondensed_600SemiBold';

export const typeBebas = {
  /** D1 — gros chiffre d'affichage, mot SOS. */
  d1b: { fontFamily: bebas, fontSize: 37, lineHeight: 40, letterSpacing: 1.5 },

  /** H1 — titre d'écran. */
  h1b: { fontFamily: bebas, fontSize: 24, lineHeight: 28, letterSpacing: 0.5 },

  /** H2 — nom de garage, titre de carte, libellé de réglage. */
  h2b: { fontFamily: bebas, fontSize: 16, lineHeight: 20, letterSpacing: 0.5 },

  /** LBL — libellé de section précédé du filet rouge. */
  lblb: { fontFamily: bebas, fontSize: 11, lineHeight: 13, letterSpacing: 1.76 },

  /** BTN — texte de bouton principal. */
  btn: { fontFamily: bebas, fontSize: 17, lineHeight: 20, letterSpacing: 2.2 },

  /** BTNSM — puce de filtre, onglet, badge, lien secondaire. */
  btnSm: { fontFamily: bebas, fontSize: 13, lineHeight: 16, letterSpacing: 0.7 },

  /** TAB — libellé de barre d'onglets. */
  tab: { fontFamily: bebas, fontSize: 10, lineHeight: 12, letterSpacing: 0.4 },
} as const;

/** Les niveaux qui doivent basculer sur le repli si Bebas manque. */
export type BebasVariant = keyof typeof typeBebas;

export const BEBAS_VARIANTS: ReadonlySet<string> = new Set(Object.keys(typeBebas));
