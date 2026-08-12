/**
 * Jetons de design GeoCras.
 *
 * Source unique de toute valeur visuelle. La règle du CLAUDE.md est stricte :
 * **aucune couleur en dur dans un composant**. Si une valeur manque ici, on
 * l'ajoute ici — on ne l'écrit pas dans un `StyleSheet.create`.
 *
 * La palette est reprise telle quelle du cahier des charges : elle est
 * déclarée non négociable, y compris le parti pris du blanc chaud (aucun gris
 * bleuté nulle part, pas même dans les ombres).
 */

import { plexType } from './typography';

const lightColors = {
  primary: '#E53935',
  primaryDark: '#C62A26',
  primaryTint: '#FCECEA',
  background: '#F6F4EF',
  surface: '#FFFFFF',
  ink: '#1C1A17',
  inkSecondary: '#6E6A62',
  muted: '#A39D91',
  rule: '#E8E4DB',
  success: '#2F8F5B',
  warning: '#E0A32E',
  /**
   * Position de l'utilisateur.
   *
   * ⚠️ Écart assumé par rapport au tableau du CLAUDE.md, qui donne `#2D6FD6`.
   * Le jaune a été demandé explicitement.
   *
   * Conséquence à connaître : il est **proche de `warning`** (`#E0A32E`). Les
   * deux ne se croisent nulle part aujourd'hui — `warning` ne sert qu'au
   * libellé « Fermé » et au bandeau de position simulée — mais toute nouvelle
   * alerte posée à côté du point utilisateur deviendra ambiguë.
   */
  userPosition: '#F5B301',
  /**
   * Même rôle, assombri pour tenir sur une surface claire.
   *
   * Le jaune vif atteint à peine 1,8:1 sur du blanc : une icône tracée
   * directement en `userPosition` serait illisible en plein soleil, ce qui est
   * précisément la condition d'usage de l'app. On le réserve donc aux
   * **aplats**, et on passe à cette variante dès qu'il s'agit d'un trait.
   */
  userPositionDeep: '#8A5E00',
  /** Libellé des intitulés de section — ni encre, ni discret. */
  sectionLabel: '#8A8578',
  tabInactive: '#B5AFA3',
  /** Voile du haut de carte, pour que la recherche reste lisible. */
  scrim: 'rgba(246, 244, 239, 0.92)',
  /**
   * Voile plein écran des modales.
   *
   * Encre translucide, jamais un noir neutre : le fond de l’app est chaud, et
   * un voile gris bleuté refroidirait toute l’image dès qu’une modale s’ouvre.
   * Assez dense pour que la feuille porte, assez clair pour qu’on reconnaisse
   * l’écran qu’on n’a pas quitté.
   */
  overlay: 'rgba(28, 26, 23, 0.55)',
  /**
   * Mise en avant contextuelle — le jaune des messages qui expliquent une
   * situation particulière, comme le garage demandé depuis sa fiche et
   * placé en tête des résultats.
   *
   * Le même ton dans les deux thèmes : c’est un aplat vif dont tout l’intérêt
   * est de trancher sur le fond, et l’assombrir en mode sombre reviendrait à
   * le fondre dans la page.
   */
  highlight: '#F5B301',
  /**
   * Encre posée **sur** `highlight`.
   *
   * Nécessairement sombre dans les deux thèmes, et c'est pour ça qu'elle ne
   * peut pas être `ink` : en sombre, `ink` vaut blanc, et du blanc sur ce
   * jaune tombe à 1,9:1 — illisible, a fortiori en plein soleil.
   */
  onHighlight: '#1C1A17',
  /**
   * Fond des encarts jaunes — avertissement de changement de numéro, dossier de
   * garage en cours de vérification.
   *
   * `highlight` est un aplat vif : sous un paragraphe entier il crie, et le
   * texte encre y perd en confort. Ce ton pâle porte le même sens sans occuper
   * tout le regard, le vif restant réservé au trait de bord et aux pastilles.
   */
  /**
   * Bronze du premier grade de fidélité.
   *
   * Seule couleur de la palette qui ne serve qu'à un endroit : l'échelle des
   * grades avait besoin d'un cran entre le discret et le jaune, et le gris
   * qu'on y mettait faisait lire « rien gagné » là où il y a un premier
   * dépannage réussi. Terre cuite plutôt que brun froid, comme le reste du
   * blanc chaud.
   */
  /**
   * Plaque d'immatriculation.
   *
   * Deux jetons **identiques dans les deux thèmes**, et c'est voulu : une plaque
   * n'est pas un élément d'interface, c'est un objet physique — comme un
   * panneau routier. L'assombrir en mode nuit reviendrait à repeindre la
   * voiture. Sans ces jetons, l'encre du thème sombre (blanche) écrirait du
   * blanc sur du blanc.
   */
  plateFace: '#F5F3EE',
  plateInk: '#1C1A17',
  tierBronze: '#B06B3A',
  highlightTint: '#FBF0D8',
  shadow: '#1C1A17',
};

/**
 * Les valeurs sont typées `string` et non littérales : les deux thèmes doivent
 * être interchangeables. En figeant les littéraux, `colors.primaryTint` du
 * thème sombre ne serait pas assignable à celui du thème clair.
 *
 * Le type reste dérivé des CLÉS du thème clair : oublier une couleur en sombre
 * est une erreur de compilation.
 */
export type Colors = { readonly [K in keyof typeof lightColors]: string };

const darkColors: Colors = {
  primary: '#E53935',
  primaryDark: '#C62A26',
  primaryTint: '#2A1513',
  background: '#121110',
  surface: '#1C1A18',
  ink: '#FFFFFF',
  inkSecondary: '#BDB7AB',
  muted: '#8C867A',
  rule: '#2A2724',
  success: '#2F8F5B',
  warning: '#E0A32E',
  userPosition: '#F5B301',
  // Sur fond sombre, la contrainte s'inverse : c'est le jaune sombre qui
  // disparaîtrait. On éclaircit au lieu d'assombrir.
  userPositionDeep: '#FFCB4D',
  sectionLabel: '#8A8578',
  tabInactive: '#565149',
  scrim: 'rgba(18, 17, 16, 0.92)',
  // Plus dense qu’en clair : sur un fond déjà sombre, un voile à 55 % ne
  // détache plus la feuille de ce qui reste derrière.
  overlay: 'rgba(9, 8, 8, 0.72)',
  highlight: '#F5B301',
  onHighlight: '#1C1A17',
  // Ambre très sombre : en clair l'encart s'éclaircit par rapport au fond, en
  // sombre il s'assombrit — dans les deux cas il se détache de la surface.
  plateFace: '#F5F3EE',
  plateInk: '#1C1A17',
  tierBronze: '#C98450',
  highlightTint: '#2A2113',
  shadow: '#000000',
};

export type ColorScheme = 'light' | 'dark';

export const palette: Record<ColorScheme, Colors> = {
  light: lightColors,
  dark: darkColors,
};

/**
 * Couleurs du fond de carte. Communes aux deux thèmes : le style de carte
 * MapLibre est un document JSON unique, et basculer tout le rendu cartographique
 * en sombre demanderait un second style complet — hors périmètre v1.
 */
export const mapColors = {
  land: '#EFEBE2',
  road: '#FEFBF0',
  roadCasing: '#E2DDD1',
  water: '#BBD5EA',
  vegetation: '#D9E6C8',
  building: '#E6E1D6',
} as const;

/** Dégradé radial du splash. */
export const splashGradient = ['#F1544F', '#E53935', '#BF2723'] as const;

/** Échelle d'espacement, multiples de 4. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/**
 * Rayons — volontairement pauvres.
 *
 * Le cahier des charges interdit le « 8/12/16 px partout » qui rend une app
 * générique : 0 par défaut, 2 sur les champs et les puces, 20–22 sur les
 * feuilles du bas, 50 % sur les pastilles.
 */
export const radius = {
  none: 0,
  field: 2,
  chip: 2,
  sheet: 20,
  sheetLarge: 22,
  pill: 999,
} as const;

/**
 * Chamfer — l'angle coupé à 45° en bas à droite.
 *
 * Exprimé en fractions de la boîte, pour être converti en points au moment du
 * rendu quelle que soit la taille. S'applique aux logos, boutons d'action
 * rouges, avatars et badges de fidélité — **jamais** aux cartes de contenu ni
 * aux champs de saisie.
 */
export const chamfer = {
  /** polygon(0 0, 100% 0, 100% 74%, 74% 100%, 0 100%) */
  standard: { x: 0.74, y: 0.74 },
  /** Coupe plus douce sur un bouton large : 100% 72%, 94% 100% */
  wide: { x: 0.94, y: 0.72 },
} as const;

/**
 * Écusson pentagonal des marqueurs de carte.
 * polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%) — jamais la goutte par défaut.
 */
export const markerShape = { shoulder: 0.62 } as const;

export const markerSize = {
  certified: 38,
  standard: 33,
} as const;

/**
 * Ombre portée elliptique au sol, sous chaque écusson.
 *
 * C'est elle qui pose le marqueur *sur* la carte au lieu de le laisser flotter
 * au-dessus. L'ellipse est centrée sur la pointe du pentagone : elle déborde
 * donc de `height / 2` sous le point d'ancrage, ce dont le marqueur doit tenir
 * compte pour que la pointe reste exactement sur la coordonnée du garage.
 */
export const markerShadow = { width: 24, height: 7 } as const;

/** Boutons flottants de la carte : bascule 2D/3D et recentrage. */
export const mapControlSize = 48;

/**
 * Ombre du chrome posé sur la carte — recherche, filtres, boutons flottants.
 *
 * Elle existe pour une raison précise : ces éléments sont blancs sur un fond
 * de carte crème (`#EFEBE2`), soit à peine trois pour cent d'écart de
 * luminance. Sans ombre, ils ne se détachent que par leur filet d'un pixel,
 * qui disparaît en plein soleil — la condition d'usage du produit.
 *
 * Volontairement basse et large : elle décolle sans dramatiser. La couleur est
 * fournie par l'appelant depuis `colors.shadow`, jamais en dur, pour rester
 * chaude en clair et neutre en sombre — un gris bleuté trahirait tout de suite
 * le parti pris du blanc chaud.
 */
export const chromeShadow = {
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  /** Android dessine son ombre à partir de l'élévation seule. */
  elevation: 3,
} as const;

/**
 * Inclinaison de la caméra en vue 3D.
 *
 * 52° et non 60 : au-delà, l'horizon entre dans le cadre et les écussons des
 * garages lointains se tassent en une ligne illisible.
 */
export const MAP_PITCH_3D = 52;

/** Cible tactile minimale imposée par le cahier des charges. */
export const MIN_TOUCH_TARGET = 44;

/**
 * Familles de caractères.
 *
 * `sans` est passée d'Inter à IBM Plex Sans **sans toucher à une seule
 * dimension** : chaque variante garde sa taille, son interligne et son
 * interlettrage, seul le fichier de police change. C'est la façon la moins
 * risquée de faire apparaître la nouvelle police partout — aucune hauteur de
 * conteneur ne bouge, aucun texte ne change de gabarit. Reste l'écart de
 * chasse, IBM Plex Sans étant environ 4 % plus large qu'Inter.
 *
 * Deux graisses n'existent pas dans les trois fichiers embarqués, et sont
 * rabattues sur la plus proche :
 *
 * - **500 → 600.** Les deux variantes concernées, `caption` et `baseline`,
 *   sont des libellés de 11 px. À cette taille on arrondit vers le haut : le
 *   produit doit rester lisible en plein soleil, et un 400 y disparaît.
 * - **800 → 700.** `display` et `title` font 28 et 20 px. À cette taille on
 *   arrondit vers le bas — un titre n'a pas besoin d'être plus gras que le
 *   reste, il est déjà plus grand. Charger un huitième fichier de police pour
 *   deux variantes ne se justifiait pas.
 *
 * Conséquence assumée : `title` et `heading` partagent désormais la graisse
 * 700, leur hiérarchie tient à la taille. C'était déjà le cas entre `heading`
 * et `sectionLabel`.
 */
export const fonts = {
  sans: {
    regular: 'IBMPlexSans_400Regular',
    medium: 'IBMPlexSans_600SemiBold',
    semibold: 'IBMPlexSans_600SemiBold',
    bold: 'IBMPlexSans_700Bold',
    extrabold: 'IBMPlexSans_700Bold',
  },
  /** Chasse étroite, réservée aux adresses longues et aux libellés contraints. */
  condensed: {
    semibold: 'IBMPlexSansCondensed_600SemiBold',
  },
  /**
   * IBM Plex Mono pour TOUTE donnée mesurée : distances, ETA, vitesse, notes,
   * points, plaques, précision GPS, horodatages, numéros de version.
   * Jamais l'inverse — de l'Inter sur un chiffre casse l'identité.
   */
  mono: {
    regular: 'IBMPlexMono_400Regular',
    medium: 'IBMPlexMono_500Medium',
    semibold: 'IBMPlexMono_600SemiBold',
    bold: 'IBMPlexMono_700Bold',
  },
} as const;

/** React Native exprime `letterSpacing` en points, pas en em. */
export function em(fontSize: number, factor: number): number {
  return Math.round(fontSize * factor * 100) / 100;
}

export type TextVariant = keyof typeof type;

export const type = {
  ...plexType,

  // — Inter — échelle historique, remplacée écran par écran par `plexType`.
  // Elle reste tant que tous les appels n'ont pas basculé : la retirer avant
  // ferait tomber en police système chaque `<Text variant="body">` non repris.
  display: { fontFamily: fonts.sans.extrabold, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fonts.sans.extrabold, fontSize: 20, lineHeight: 26 },
  heading: { fontFamily: fonts.sans.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.sans.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.sans.semibold, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.sans.regular, fontSize: 13, lineHeight: 18 },
  /** Libellé de puce de filtre : assez ferme pour porter, assez court pour tenir. */
  smallStrong: { fontFamily: fonts.sans.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.sans.medium, fontSize: 11, lineHeight: 15 },

  /** Intitulé de section : 10 px, majuscules, .16em. */
  sectionLabel: {
    fontFamily: fonts.sans.bold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: em(10, 0.16),
    textTransform: 'uppercase' as const,
  },

  /** Onglet : 10 px, poids 700, .04em. */
  tabLabel: {
    fontFamily: fonts.sans.bold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: em(10, 0.04),
    textTransform: 'uppercase' as const,
  },

  /** Baseline du splash : 11 px, majuscules, .22em. */
  baseline: {
    fontFamily: fonts.sans.medium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: em(11, 0.22),
    textTransform: 'uppercase' as const,
  },

  // — IBM Plex Mono : toute donnée mesurée —
  mono: { fontFamily: fonts.mono.regular, fontSize: 13, lineHeight: 18 },
  monoSmall: { fontFamily: fonts.mono.regular, fontSize: 11, lineHeight: 15 },
  monoStrong: { fontFamily: fonts.mono.semibold, fontSize: 13, lineHeight: 18 },

  /** Vitesse du mode conduite : 104 px de mono. */
  speed: { fontFamily: fonts.mono.bold, fontSize: 104, lineHeight: 112 },

  /** Unité sous la vitesse : 11 px, .28em. */
  speedUnit: {
    fontFamily: fonts.mono.medium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: em(11, 0.28),
    textTransform: 'uppercase' as const,
  },

  /** Pied de page : 9,5 px, .16em. */
  footnote: {
    fontFamily: fonts.mono.regular,
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: em(9.5, 0.16),
    textTransform: 'uppercase' as const,
  },
} as const;

export type { PlexVariant } from './typography';

/** Filet rouge de 14 × 2 px qui précède chaque intitulé de section. */
export const sectionRule = { width: 14, height: 2 } as const;

/** Trait de l'onglet actif, collé au bord haut de la barre. */
export const tabIndicator = { width: 26, height: 2.5 } as const;

export const tabBarHeight = 82;

// Le tiroir occupe désormais tout l'écran : il n'y a plus de ratio de largeur
// à régler. `DRAWER_WIDTH_RATIO` a été retiré plutôt que laissé à 0,81 — un
// jeton que plus personne ne lit finit par être repris de travers.
