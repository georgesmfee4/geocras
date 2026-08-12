import { sql, type RawBuilder } from 'kysely';

/**
 * Fabriques d'expressions PostGIS.
 *
 * Toute écriture ou comparaison géographique passe par ici. C'est le seul
 * endroit du code où l'on écrit `ST_SetSRID` — ailleurs, le type
 * `GeographyPoint` refuse toute autre valeur.
 *
 * Rappel sur l'ordre des arguments : `ST_MakePoint` prend **(longitude,
 * latitude)**, dans cet ordre. L'inverser produit une position en pleine mer,
 * silencieusement. C'est l'erreur la plus fréquente en géospatial et la raison
 * pour laquelle ces fonctions prennent un objet nommé plutôt que deux nombres.
 */
export type LatLng = { lat: number; lng: number };

export function pointFromLatLng(point: LatLng): RawBuilder<unknown> {
  return sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography`;
}

/** Distance en mètres entre une colonne géographique et un point. */
export function distanceMeters(column: string, point: LatLng): RawBuilder<number> {
  return sql<number>`ST_Distance(${sql.ref(column)}, ${pointFromLatLng(point)})`;
}

/**
 * Filtre de proximité. Toujours l'utiliser AVANT un tri par distance :
 * `ST_DWithin` consomme l'index GIST, un `ORDER BY ST_Distance(...)` seul
 * déclenche un parcours complet de la table.
 */
export function withinMeters(column: string, point: LatLng, meters: number): RawBuilder<boolean> {
  return sql<boolean>`ST_DWithin(${sql.ref(column)}, ${pointFromLatLng(point)}, ${meters})`;
}

/** Projection d'une colonne géographique en latitude/longitude lisibles. */
export function latOf(column: string): RawBuilder<number> {
  return sql<number>`ST_Y(${sql.ref(column)}::geometry)`;
}

export function lngOf(column: string): RawBuilder<number> {
  return sql<number>`ST_X(${sql.ref(column)}::geometry)`;
}
