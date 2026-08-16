/**
 * Cercle géographique, en **mètres réels**.
 *
 * Un polygone et non un cercle d'écran : le rayon représente une distance sur
 * le terrain — précision GPS, zone d'incertitude d'une position masquée — et
 * doit donc grandir au dézoom. Un cercle à rayon fixe en pixels afficherait une
 * précision constante quel que soit le zoom, c'est-à-dire exactement le
 * contraire de ce que ces cercles servent à dire.
 *
 * Projection plate : à l'échelle du kilomètre et sous l'équateur, l'écart avec
 * une géodésique exacte est de l'ordre du centimètre. Ce qu'on dessine ici est
 * une incertitude, pas un cadastre.
 */
export function circlePolygon(
  center: { lat: number; lng: number },
  radiusMeters: number,
  steps = 48,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((center.lat * Math.PI) / 180);

  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      center.lng + (radiusMeters * Math.cos(angle)) / metersPerDegreeLng,
      center.lat + (radiusMeters * Math.sin(angle)) / metersPerDegreeLat,
    ]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}
