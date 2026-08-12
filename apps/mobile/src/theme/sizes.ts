import { MIN_TOUCH_TARGET, sectionRule } from './tokens';

/**
 * Gabarits de la refonte typographique.
 *
 * Une interface ne casse pas seulement par sa police : elle casse quand ses
 * hauteurs sont **déduites** du texte. `allowFontScaling={false}` empêche le
 * texte de grandir, ces valeurs empêchent les conteneurs de suivre.
 *
 * Règles d'emploi, dans l'ordre où on les oublie :
 *
 *  1. `height` fixe, jamais `minHeight`, sur les lignes, boutons, tuiles,
 *     en-têtes et badges. Un conteneur qui peut grandir est un conteneur qui
 *     grandira, un jour, sur un téléphone qu'on n'a pas testé.
 *  2. `lineHeight` toujours explicite — il est déjà dans chaque niveau
 *     typographique, ne pas le retirer. Sans lui, la hauteur de ligne dépend
 *     des métriques de la police et diverge entre iOS et Android.
 *  3. Aucun pourcentage ni `Dimensions.get('window')` pour un gabarit
 *     d'interface. Le pourcentage reste aux zones qui doivent réellement
 *     occuper le reste : la carte, une liste défilante.
 *  4. Zone tactile de 44 px minimum. Un élément visuellement plus petit ne
 *     grossit pas : il reçoit un `hitSlop`.
 *  5. Un texte qui déborderait d'un gabarit fixe est tronqué, pas rétréci —
 *     `numberOfLines={1}` et `ellipsizeMode="tail"`. Seule exception, les
 *     grands chiffres du mode conduite, où `adjustsFontSizeToFit` avec
 *     `minimumFontScale={0.8}` est acceptable.
 *
 * **Les largeurs restent fluides.** On fige la hauteur et la typographie, pas
 * la largeur : marges et colonnes restent en `flex`, pour tenir aussi bien sur
 * un petit Android que sur un grand iPhone.
 *
 * ---
 *
 * **Divergences avec les valeurs actuellement implémentées.** Plusieurs de ces
 * gabarits ne valent pas ce que le code applique aujourd'hui, lui aussi relevé
 * sur maquette. Ce fichier n'est encore importé nulle part : rien ne bouge tant
 * que la question n'est pas tranchée, et l'écart est noté ligne par ligne.
 */
export const size = {
  /** Barre de titre d'écran. `ScreenHeader` applique aujourd'hui `minHeight: 60`. */
  headerH: 52,

  /** Ligne de liste, ligne de réglage. `SettingsCard` : 58. `MenuRow` : 56. */
  rowH: 48,

  /** Bouton principal pleine largeur. `Button` variante normale : 48. */
  btnH: 56,

  /** Bouton carré à icône. Les boutons flottants de la carte : 48. */
  btnSquare: 56,

  /** Bouton SOS — concorde avec la variante `large` de `Button`. */
  sosH: 64,

  /** Tuile de filtre / type de panne. `VehicleTile` : 72. */
  tileH: 64,

  /** Écusson de profil. Sans équivalent aujourd'hui. */
  crestSize: 72,

  /** Case de chiffre du code garagiste. Sans équivalent : l'écran reste à faire. */
  digitBox: { w: 37, h: 42 },

  /** Interrupteur. `Switch` applique aujourd'hui 46 × 26, pastille 18. */
  toggleW: 42,
  toggleH: 24,
  toggleKnob: 18,

  /** Gabarit d'icône de ligne — le tracé reste dedans. */
  iconBox: 20,

  /** Chevron de fin de ligne. `ChevronRightSmallIcon` est dessiné à 16. */
  chevron: 8,

  /**
   * Filet rouge de section.
   *
   * Repris de `sectionRule` plutôt que redéclaré : c'est le même trait, et
   * deux constantes pour les mêmes deux pixels finiraient par diverger.
   */
  ruleW: sectionRule.width,
  ruleH: sectionRule.height,

  /** Marge latérale d'écran. Les écrans utilisent `space.xl`, soit 20. */
  gutter: 18,

  /**
   * Rattrapage de zone tactile.
   *
   * Huit points de chaque côté ramènent au-dessus des {@link MIN_TOUCH_TARGET}
   * 44 px imposés tout élément visuel d'au moins 28 px — chevrons, croix de
   * fermeture, interrupteurs.
   */
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },

  /** La cible tactile minimale, réexportée pour n'avoir qu'un point d'entrée. */
  touchMin: MIN_TOUCH_TARGET,
} as const;

export type SizeToken = keyof typeof size;
