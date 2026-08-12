/**
 * Tracés SVG des formes de l'identité GeoCras.
 *
 * Toutes sont exprimées dans un repère 0–100 puis étirées via
 * `preserveAspectRatio="none"`. Ce n'est pas un raccourci : c'est exactement la
 * sémantique de `polygon()` en CSS, avec lequel les maquettes ont été
 * dessinées. Un tracé en unités absolues obligerait à mesurer chaque conteneur
 * avant de pouvoir peindre, donc à afficher une frame vide à chaque montage.
 */

export type ChamferRatios = { x: number; y: number };

/** Angle coupé en bas à droite. */
export function chamferPath({ x, y }: ChamferRatios): string {
  const cutX = x * 100;
  const cutY = y * 100;
  return `M0 0 H100 V${cutY} L${cutX} 100 H0 Z`;
}

/**
 * Écusson pentagonal des marqueurs de carte.
 * La pointe basse est le point d'ancrage exact sur la position du garage —
 * c'est elle qui doit toucher la coordonnée, pas le centre de l'écusson.
 */
export function markerPath(shoulder: number): string {
  const shoulderY = shoulder * 100;
  return `M0 0 H100 V${shoulderY} L50 100 L0 ${shoulderY} Z`;
}

/** Fraction verticale de la pointe, pour ancrer le marqueur sur la carte. */
export const MARKER_ANCHOR = { x: 0.5, y: 1 } as const;
