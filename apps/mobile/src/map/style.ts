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
      /**
       * Noms de rue — à partir du zoom 12, et non plus 14.
       *
       * **Le seuil de 14 était la cause d'une absence qu'on a longtemps prise
       * pour une panne.** Il avait été calé sur la carte de recherche, où l'on
       * est toujours serré sur un quartier. Or presque tous les autres écrans du
       * produit cadrent un **trajet entier** — la navigation du garagiste, le
       * suivi du client, le trajet vers l'atelier : faire tenir cinq kilomètres
       * dans la bande laissée par un panneau descend le zoom vers 12 ou 13. Les
       * voies restaient dessinées, leurs noms disparaissaient, et la carte
       * devenait un labyrinthe de traits gris qu'on ne peut pas nommer.
       *
       * Douze est le seuil en dessous duquel un nom de rue ne veut plus rien
       * dire : on regarde alors une région, pas une ville.
       *
       * La rampe d'opacité tient la règle du fond discret sans passer par
       * l'absence : les noms entrent en retrait au cadrage large, et ne
       * prennent leur pleine encre qu'une fois qu'on s'est approché. La carte
       * de recherche, qui ouvre au zoom 13, garde donc des marqueurs de garages
       * nettement plus présents que la voirie.
       *
       * ⚠️ Ce seuil ne concerne **pas** la position masquée d'une demande non
       * acceptée : le fond aveugle retire cette couche entière, à tout zoom.
       * Voir `buildBlindMapStyle`.
       */
      {
        id: 'road-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 12,
        layout: {
          'symbol-placement': 'line',
          /*
            Le nom, ou à défaut le **numéro de route**.

            Hors des grandes villes, OSM nomme rarement les voies mais numérote
            les axes : à Ebolowa, quatre tronçons portent `N2`, `D 39`, `P10`
            sans aucun `name`. Ne lire que `name` les laissait muets — c'est-à-
            dire précisément les routes sur lesquelles on roule pour rejoindre
            une panne entre deux villes.

            `coalesce` rend le premier champ non nul ; sans ni l'un ni l'autre,
            MapLibre n'écrit rien et la voie reste un simple trait.
          */
          'text-field': ['coalesce', ['get', 'name'], ['get', 'ref']] as unknown as string,
          'text-font': LABEL_FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9.5, 16, 11.5] as unknown as number,
          'text-letter-spacing': 0.02,
        },
        paint: {
          'text-color': INK_LABEL,
          'text-halo-color': INK_HALO,
          'text-halo-width': 1.2,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.45, 15, 1] as unknown as number,
        },
      },
      /** La ville elle-même. Rare, grande, toujours visible. */
      {
        id: 'place-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town'],
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

      /**
       * Quartiers, lieux-dits — **le repère qui remplace le nom de rue**.
       *
       * La classe `village` est la clé, et son absence était un vrai trou. En
       * dehors des grandes villes, OSM range presque tous les quartiers
       * camerounais sous `village` : à Ebolowa, vingt noms — Abang, Adjap
       * Biyeng, Bilon, Bissok… — que le filtre précédent écartait, contre trois
       * seulement qu'il retenait. On jetait sept repères sur huit, dans les
       * villes qui en ont le plus besoin puisque leurs rues n'ont pas de nom.
       *
       * Séparé de la ville plutôt que fondu dans un même filtre : les deux
       * n'ont ni la même taille, ni le même seuil d'apparition. Un nom de
       * quartier au zoom 8 est du bruit ; le nom de la ville, non.
       */
      {
        id: 'locality-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'suburb', 'neighbourhood', 'quarter', 'village', 'hamlet'],
        minzoom: 11,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': LABEL_FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9.5, 15, 12] as unknown as number,
          'text-letter-spacing': 0.08,
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
 * Couches qui permettent de **situer** un point dans la ville.
 *
 * Voies, noms de voies, noms de quartiers, bâti : tout ce à partir de quoi
 * quelqu'un qui connaît Yaoundé recompose une adresse. C'est exactement la
 * liste que le style aveugle retire.
 */
const LOCATING_LAYERS: ReadonlySet<string> = new Set([
  'road-minor-casing',
  'road-secondary-casing',
  'road-major-casing',
  'road-minor',
  'road-secondary',
  'road-major',
  'road-label',
  'place-label',
  'locality-label',
  'building',
]);

/**
 * Le fond de carte **aveugle**, pour une position qu'on ne veut pas révéler.
 *
 * Servi au garagiste tant qu'il n'a pas accepté. Le disque d'incertitude y est
 * dessiné à son échelle réelle — il dit honnêtement « un kilomètre » — mais il
 * flotte sur un fond dépourvu de toute voie, de tout nom et de tout bâtiment.
 *
 * ---
 *
 * **Pourquoi retirer les rues plutôt que le point.**
 *
 * Le risque ne tenait ni au point seul, ni aux rues seules : il tenait à leur
 * **rencontre**. Un rond posé sur un plan de ville se rapporte au carrefour le
 * plus proche, et quelqu'un qui connaît son quartier sait alors où aller —
 * l'arrondi de coordonnées n'y change rien, puisqu'il reste dans les quatre
 * cents mètres. Le même rond sur un fond muet ne se rapporte à rien.
 *
 * Retirer les rues plutôt que le repère laisse en outre au garagiste ce dont il
 * a besoin pour décider : l'étendue de la zone, à l'échelle, et le fait qu'une
 * demande vient bien de quelque part. Un cadre vide se serait lu comme une
 * carte en panne.
 *
 * L'eau et la végétation restent : elles donnent une masse au fond sans nommer
 * quoi que ce soit, et aucune adresse ne se déduit d'une tache verte.
 */
export function buildBlindMapStyle(apiKey: string): StyleSpecification {
  const full = buildMapStyle(apiKey);

  return {
    ...full,
    name: 'GeoCras — aveugle',
    layers: full.layers.filter((layer) => !LOCATING_LAYERS.has(layer.id)),
  };
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
