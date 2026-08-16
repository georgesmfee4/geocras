/**
 * Décodage des géométries encodées d'OSRM.
 *
 * OSRM peut rendre sa géométrie en GeoJSON, mais on demande du **polyline6** :
 * un trajet urbain d'un kilomètre pèse environ 300 octets encodé contre 2 à
 * 3 Ko en GeoJSON, pour un tracé identique. Le décodage se fait ici, une fois,
 * et le mobile reçoit des coordonnées prêtes à peindre — c'est notre serveur
 * qui absorbe le format d'OSRM, pas l'app.
 *
 * L'algorithme est celui de Google (« encoded polyline algorithm format ») :
 * différences successives, zig-zag, découpe en groupes de 5 bits. `polyline6`
 * n'en diffère que par le facteur d'échelle — 1e6 au lieu de 1e5, soit une
 * précision de dix centimètres au lieu de un mètre.
 */

const PRECISION_6 = 1e6;

/**
 * Rend une liste de `[lng, lat]` — l'ordre de GeoJSON et de MapLibre, pas
 * celui d'OSRM.
 *
 * OSRM encode en **latitude d'abord**. L'inversion est faite ici, au seul
 * endroit qui connaît la convention d'OSRM ; la laisser fuir plus loin
 * produirait une polyligne au milieu de l'océan Atlantique — l'erreur
 * géospatiale classique, et parfaitement silencieuse.
 */
export function decodePolyline6(encoded: string): [number, number][] {
  const points: [number, number][] = [];

  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    lat += nextDelta();
    lng += nextDelta();
    points.push([lng / PRECISION_6, lat / PRECISION_6]);
  }

  return points;

  /**
   * Lit une valeur : groupes de 5 bits tant que le sixième est armé, puis
   * dézigzague — le bit de poids faible porte le signe.
   */
  function nextDelta(): number {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    return result & 1 ? ~(result >> 1) : result >> 1;
  }
}
