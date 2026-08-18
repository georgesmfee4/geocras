import type { ColorScheme } from '../theme/tokens';

/**
 * Palette du poste de conduite.
 *
 * **C'est la seule chose que le thème injecte dans cet écran.** Aucune valeur
 * de position, de taille, d'espacement, de graisse ou de rayon n'est présente
 * ici, et aucune n'existe ailleurs sous condition de thème : la géométrie vit
 * dans un `StyleSheet` unique, la couleur vient d'ici, et les deux ne se
 * croisent jamais. Une régression de couleur ne peut donc pas devenir une
 * régression de mise en page.
 *
 * Les deux objets portent **exactement les mêmes clés** — c'est le type qui
 * l'impose, pas la discipline. Si le rendu a besoin d'une condition de thème,
 * c'est qu'une clé manque : on l'ajoute ici plutôt qu'un ternaire dans le JSX.
 *
 * ---
 *
 * **Pourquoi certaines clés ne figurent pas telles quelles dans la table de
 * référence.** React Native ne connaît ni les couleurs `rgba` dans un
 * `shadowColor`, ni les arrêts de dégradé SVG à alpha intégré : les deux
 * demandent une couleur **et** une opacité séparées. Les entrées concernées
 * sont donc dédoublées — `haloRed` + `haloOpacity`, `discGlow` +
 * `discGlowOpacity` — sans qu'aucune valeur ne change. C'est une contrainte de
 * plateforme, pas une réinterprétation.
 *
 * De même, RN ne pose **qu'une ombre par vue** : la seconde ombre neutre du
 * thème clair a ses propres clés (`discContact…`), neutralisées à zéro en
 * sombre plutôt qu'absentes — la structure du rendu reste identique.
 */
export type CockpitPalette = {
  /** Fond de l'écran. */
  bg: string;
  /** Centre du halo radial. */
  haloRed: string;
  /** Opacité du centre du halo — RN/SVG veut la couleur et l'alpha séparés. */
  haloOpacity: number;
  /** Bord du halo. **Toujours la couleur de fond du thème**, à alpha nul : un
   *  bord noir sur fond clair cerne le halo d'un gris qui le fait paraître
   *  cassé. */
  haloEdge: string;
  /** « Prêt à conduire ? » */
  title: string;
  /** Phrase de description. Distincte de `eyebrow` : `#8C867A` passerait sous
   *  4,5:1 sur le fond clair, alors qu'il tient sur le fond sombre. */
  body: string;
  /** « MODE CONDUITE ». Identique dans les deux thèmes. */
  eyebrow: string;
  /** Filets rouges de part et d'autre de l'intitulé. */
  rule: string;
  /** Fond des lignes d'interrupteur. */
  card: string;
  /** Filet des lignes. Transparent en sombre — l'épaisseur, elle, ne bouge
   *  pas : c'est ce qui garantit que rien ne se décale d'un thème à l'autre. */
  cardBorder: string;
  /** Joint d'un pixel entre les deux lignes. */
  cardSeparator: string;
  /** « Alertes sonores », « Détection d'angle mort ». */
  rowLabel: string;
  /** Barre d'onglets — fond, filet supérieur, onglet inactif, onglet actif. */
  tabBar: string;
  tabBorder: string;
  tabIdle: string;
  tabActive: string;
  /** Heure et batterie du système. */
  statusFg: string;
  /** Style de la barre d'état de l'OS. Une clé plutôt qu'un ternaire dans le
   *  rendu : `expo-status-bar` prend un mot-clé, pas une couleur. */
  statusBarStyle: 'light' | 'dark';
  /** Ombre rouge du disque : c'est elle qui fait la lueur, pas un dégradé. */
  discGlow: string;
  discGlowOpacity: number;
  discGlowY: number;
  discGlowBlur: number;
  /** Android ne lit pas le flou : il dessine son ombre à partir de l'élévation
   *  seule. La valeur suit le flou sans lui être égale — l'élévation est une
   *  hauteur, pas un rayon. */
  discGlowElevation: number;
  /** Seconde ombre, neutre et courte : c'est elle qui pose le disque sur le
   *  papier en thème clair. Neutralisée en sombre, où la lueur suffit. */
  discContact: string;
  discContactOpacity: number;
  discContactY: number;
  discContactBlur: number;
  /** Onde pulsante. Alpha intégré : c'est un `backgroundColor`, que RN accepte
   *  en `rgba`. */
  wave: string;
};

export const cockpitPalette: Record<ColorScheme, CockpitPalette> = {
  dark: {
    bg: '#121110',
    haloRed: '#E53935',
    haloOpacity: 0.16,
    haloEdge: '#121110',
    title: '#FFFFFF',
    body: '#8C867A',
    eyebrow: '#8C867A',
    rule: '#E53935',
    card: '#1C1A18',
    cardBorder: 'transparent',
    cardSeparator: '#121110',
    rowLabel: '#EDE9E1',
    tabBar: '#171614',
    tabBorder: '#2A2724',
    tabIdle: '#565149',
    tabActive: '#E53935',
    statusFg: '#FFFFFF',
    statusBarStyle: 'light',
    discGlow: '#E53935',
    discGlowOpacity: 0.7,
    discGlowY: 20,
    discGlowBlur: 46,
    discGlowElevation: 15,
    discContact: '#1C1A17',
    discContactOpacity: 0,
    discContactY: 2,
    discContactBlur: 8,
    wave: 'rgba(229,57,53,0.16)',
  },
  light: {
    bg: '#F6F4EF',
    haloRed: '#E53935',
    haloOpacity: 0.1,
    haloEdge: '#F6F4EF',
    title: '#1C1A17',
    body: '#6E6A62',
    eyebrow: '#8C867A',
    rule: '#E53935',
    card: '#FFFFFF',
    cardBorder: '#E8E4DB',
    cardSeparator: '#E8E4DB',
    rowLabel: '#1C1A17',
    tabBar: '#F6F4EF',
    tabBorder: '#E8E4DB',
    tabIdle: '#B5AFA3',
    tabActive: '#E53935',
    statusFg: '#1C1A17',
    statusBarStyle: 'dark',
    discGlow: '#781412',
    discGlowOpacity: 0.26,
    discGlowY: 12,
    discGlowBlur: 28,
    discGlowElevation: 9,
    discContact: '#1C1A17',
    discContactOpacity: 0.1,
    discContactY: 2,
    discContactBlur: 8,
    wave: 'rgba(229,57,53,0.20)',
  },
};
