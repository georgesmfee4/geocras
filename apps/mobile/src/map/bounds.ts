/**
 * Rectangle englobant, dans l'ordre plat de MapLibre : ouest, sud, est, nord.
 *
 * Le même ordre que `LngLatBounds` attend, pour qu'aucun appelant n'ait à
 * réarranger quatre nombres — c'est exactement le genre d'inversion
 * latitude/longitude qui envoie une caméra au large du golfe de Guinée sans
 * qu'aucune erreur ne soit levée.
 */
export type Bounds = readonly [west: number, south: number, east: number, north: number];

/**
 * En dessous de cet écart, un rectangle n'est plus cadrable.
 *
 * Quatre dix-millièmes de degré, soit une quarantaine de mètres. Ce n'est pas
 * une précaution théorique : quand le dépanneur arrive sur la panne, son point
 * de départ et sa destination se confondent, et `fitBounds` sur une boîte de
 * hauteur nulle part en butée de zoom — la carte saute au maximum et on ne voit
 * plus qu'un carré de bitume.
 */
export const MIN_SPAN_DEGREES = 0.0004;

/**
 * Le plus petit rectangle contenant tous les points fournis.
 *
 * `null` quand il n'y a rien à cadrer. Les points non finis sont **écartés** au
 * lieu de contaminer le résultat : un seul `NaN` dans une géométrie suffirait
 * sinon à rendre les quatre bornes indéfinies, et `fitBounds` échoue alors en
 * silence — la caméra ne bouge pas, et rien à l'écran ne dit pourquoi.
 */
export function boundsOf(points: readonly (readonly [number, number])[]): Bounds | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let seen = false;

  for (const point of points) {
    const [lng, lat] = point;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    seen = true;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }

  return seen ? [west, south, east, north] : null;
}

/**
 * Le rectangle est-il trop petit pour être cadré ?
 *
 * Les deux côtés doivent être sous le seuil : un trajet parfaitement nord-sud
 * a une largeur nulle et reste parfaitement cadrable.
 */
export function isDegenerate(bounds: Bounds, epsilon: number = MIN_SPAN_DEGREES): boolean {
  const [west, south, east, north] = bounds;
  return east - west < epsilon && north - south < epsilon;
}

/** Centre du rectangle, en `[lng, lat]` — l'ordre de MapLibre. */
export function centerOf(bounds: Bounds): [number, number] {
  const [west, south, east, north] = bounds;
  return [(west + east) / 2, (south + north) / 2];
}
