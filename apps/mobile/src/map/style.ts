import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { mapColors } from '../theme/tokens';

/**
 * Style de carte GeoCras.
 *
 * On ne charge PAS un style MapTiler tout fait (`streets-v2`) : on consomme
 * leurs **tuiles vectorielles** et on déclare nos propres couches. C'est la
 * seule façon d'obtenir exactement le fond `#EFEBE2` et les routes `#FEFBF0`
 * sur casing `#E2DDD1` des maquettes — un style tiers impose ses couleurs, et
 * l'identité visuelle est déclarée non négociable.
 *
 * Conséquence voulue : **aucune couche POI**. Le cahier des charges interdit
 * les « POI parasites » et les couleurs vives ; les seuls repères sont les
 * marqueurs de garages, qui doivent rester les objets les plus visibles.
 *
 * Schéma des tuiles : OpenMapTiles v3 (source-layers `water`, `landcover`,
 * `park`, `building`, `transportation`, `transportation_name`, `place`).
 */

/**
 * Police des libellés de carte.
 *
 * ⚠️ Écart connu : Inter n'est pas disponible en glyphes SDF chez MapTiler.
 * Les étiquettes de rues utilisent donc Noto Sans, alors que l'interface est en
 * Inter. Pour aligner les deux, il faudra téléverser Inter dans MapTiler Cloud
 * et remplacer l'URL `glyphs` ci-dessous. Sans conséquence sur la règle
 * « chiffres en mono » : elle porte sur l'interface, pas sur le rendu carte.
 */
const LABEL_FONT = ['Noto Sans Regular'];
const LABEL_FONT_BOLD = ['Noto Sans Bold'];

const INK_LABEL = '#6E6A62';
const INK_HALO = 'rgba(254, 251, 240, 0.9)';

/** Largeur de route, interpolée par niveau de zoom. */
function roadWidth(stops: [number, number][]): unknown {
  return ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flat()];
}

export function buildMapStyle(apiKey: string): StyleSpecification {
  return {
    version: 8,
    name: 'GeoCras',
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${apiKey}`,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${apiKey}`,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': mapColors.land },
      },

      // --- Végétation ------------------------------------------------------
      {
        id: 'landcover-vegetation',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['in', 'class', 'wood', 'grass', 'scrub', 'farmland'],
        paint: { 'fill-color': mapColors.vegetation, 'fill-opacity': 0.7 },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': mapColors.vegetation, 'fill-opacity': 0.65 },
      },

      // --- Eau -------------------------------------------------------------
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', 'brunnel', 'tunnel'],
        paint: { 'fill-color': mapColors.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: {
          'line-color': mapColors.water,
          'line-width': roadWidth([
            [10, 0.5],
            [16, 4],
          ]) as number,
        },
      },

      // --- Bâtiments -------------------------------------------------------
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-color': mapColors.building,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, 1] as unknown as number,
        },
      },

      // --- Routes : casing d'abord, remplissage ensuite --------------------
      // L'ordre compte : le casing dessiné sous le remplissage produit le
      // liseré `#E2DDD1` visible sur les maquettes.
      {
        id: 'road-minor-casing',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'track'],
        minzoom: 13,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': mapColors.roadCasing,
          'line-width': roadWidth([
            [13, 2],
            [16, 6],
            [20, 22],
          ]) as number,
        },
      },
      {
        id: 'road-secondary-casing',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'secondary', 'tertiary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': mapColors.roadCasing,
          'line-width': roadWidth([
            [8, 1.5],
            [13, 4],
            [16, 10],
            [20, 30],
          ]) as number,
        },
      },
      {
        id: 'road-major-casing',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': mapColors.roadCasing,
          'line-width': roadWidth([
            [6, 2],
            [13, 6],
            [16, 14],
            [20, 38],
          ]) as number,
        },
      },

      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'track'],
        minzoom: 13,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': mapColors.road,
          'line-width': roadWidth([
            [13, 1],
            [16, 4],
            [20, 18],
          ]) as number,
        },
      },
      {
        id: 'road-secondary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'secondary', 'tertiary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': mapColors.road,
          'line-width': roadWidth([
            [8, 0.8],
            [13, 2.5],
            [16, 7],
            [20, 24],
          ]) as number,
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': mapColors.road,
          'line-width': roadWidth([
            [6, 1.2],
            [13, 4],
            [16, 10],
            [20, 30],
          ]) as number,
        },
      },

      // --- Libellés --------------------------------------------------------
      // Discrets : la carte est un fond, pas le sujet. Le sujet, ce sont les
      // écussons numérotés des garages.
      {
        id: 'road-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': LABEL_FONT,
          'text-size': 11,
          'text-letter-spacing': 0.02,
        },
        paint: {
          'text-color': INK_LABEL,
          'text-halo-color': INK_HALO,
          'text-halo-width': 1.2,
        },
      },
      {
        id: 'place-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town', 'suburb', 'neighbourhood'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': LABEL_FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 14] as unknown as number,
          'text-letter-spacing': 0.12,
          'text-transform': 'uppercase',
        },
        paint: {
          'text-color': INK_LABEL,
          'text-halo-color': INK_HALO,
          'text-halo-width': 1.5,
        },
      },
    ],
  } as StyleSpecification;
}

/**
 * Vue initiale : Yaoundé.
 *
 * Sert avant que le GPS ait fixé. Mieux vaut ouvrir sur la ville de lancement
 * que sur le point (0, 0) au large du golfe de Guinée.
 */
export const INITIAL_VIEW = {
  center: [11.5021, 3.848] as [number, number],
  zoom: 13,
} as const;
