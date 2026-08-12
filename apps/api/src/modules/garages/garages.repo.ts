import { sql, type Kysely } from 'kysely';
import type { GarageSort, Service } from '@geocras/shared';
import type { Database } from '../../db/types';
import { pointFromLatLng, type LatLng } from '../../db/geo';

/**
 * Recherche géospatiale — le cœur du produit.
 *
 * Deux invariants que rien ne doit casser :
 *
 * 1. `ST_DWithin` filtre AVANT le tri. C'est ce qui fait consommer l'index
 *    GIST. Un `ORDER BY ST_Distance(...)` sans filtre préalable parcourt la
 *    table entière — correct, mais qui s'effondre passé quelques milliers de
 *    garages. Le test `garages.repo.test.ts` vérifie le plan d'exécution.
 *
 * 2. Le rang est calculé ICI, en SQL, par `ROW_NUMBER()`. Le mobile l'affiche
 *    sans jamais le recalculer : un classement recalculé localement diverge du
 *    serveur dès que les données bougent, et la maquette numérote les marqueurs
 *    de 1 à n.
 */

/** Paramètres de la note bayésienne. */
const BAYES = {
  /**
   * Nombre d'avis à partir duquel la note d'un garage pèse pleinement.
   * Sans ça, un garage à 5,0 avec deux avis complaisants passe devant un
   * garage à 4,6 avec 128 avis — exactement ce qu'un tri « mieux noté » ne
   * doit pas faire.
   */
  minReviews: 20,
  /** Note moyenne de référence, à réviser avec les données réelles. */
  priorRating: 3.8,
} as const;

export type NearbyRow = {
  id: string;
  name: string;
  certified: boolean;
  rating: number;
  review_count: number;
  distance_m: number;
  lat: number;
  lng: number;
  address_label: string | null;
  quarter: string | null;
  phone: string | null;
  services: string[];
  photos: string[];
  open_now: boolean;
  rank: string | number;
};

export type NearbySearchParams = {
  origin: LatLng;
  radiusMeters: number;
  sort: GarageSort;
  limit: number;
  services?: readonly Service[] | undefined;
  /** `true` : offrir **un** des services suffit. Défaut : les offrir tous. */
  matchAny?: boolean | undefined;
  openNow?: boolean | undefined;
  certifiedOnly?: boolean | undefined;
};

/**
 * Le tri est exprimé par trois clés dont deux sont neutralisées selon `sort`.
 *
 * Quand une branche `CASE` est inactive elle vaut NULL pour *toutes* les
 * lignes : elle ne discrimine donc rien et le tri retombe sur la clé suivante.
 * Un seul plan de requête couvre les trois tris, sans concaténer de SQL —
 * donc sans surface d'injection.
 */
function rankExpression(sort: GarageSort) {
  return sql`ROW_NUMBER() OVER (ORDER BY
    CASE WHEN ${sort} = 'certified' THEN NOT certified END ASC,
    CASE WHEN ${sort} = 'rating'    THEN score_note     END DESC,
    distance_m ASC,
    id ASC
  )`;
}

function candidatesCte(params: NearbySearchParams, constrainRadius: boolean) {
  const origin = pointFromLatLng(params.origin);

  const radiusFilter = constrainRadius
    ? sql`AND ST_DWithin(g.location, ${origin}, ${params.radiusMeters})`
    : sql``;

  /**
   * `&&` (intersection non vide) plutôt que `@>` (contient tout) quand
   * `matchAny` est demandé.
   *
   * Les deux consomment le même index GIN `garages_services_idx` : la bascule
   * ne coûte rien en performance. Elle change en revanche complètement le
   * sens — « offre au moins un de ces services » contre « les offre tous » —
   * et c'est la recherche SOS qui a besoin du premier, parce que la taxonomie
   * lui fournit des compétences **alternatives**, pas une liste d'exigences.
   */
  const servicesFilter =
    params.services && params.services.length > 0
      ? params.matchAny
        ? sql`AND g.services && ${sql.val([...params.services])}::text[]`
        : sql`AND g.services @> ${sql.val([...params.services])}::text[]`
      : sql``;

  const openFilter = params.openNow
    ? sql`AND garage_is_open(g.opening_hours, now())`
    : sql``;

  // Filtre, pas tri : consomme l'index partiel `garages_certified_location_idx`.
  const certifiedFilter = params.certifiedOnly ? sql`AND g.certified` : sql``;

  return sql`
    SELECT
      g.id,
      g.name,
      g.certified,
      g.rating::float8                          AS rating,
      g.review_count,
      g.phone,
      g.address_label,
      g.quarter,
      g.services,
      g.photos,
      ST_Y(g.location::geometry)                AS lat,
      ST_X(g.location::geometry)                AS lng,
      ST_Distance(g.location, ${origin})        AS distance_m,
      garage_is_open(g.opening_hours, now())    AS open_now,
      (
        (g.review_count::numeric / (g.review_count + ${BAYES.minReviews})) * g.rating
        + (${BAYES.minReviews}::numeric / (g.review_count + ${BAYES.minReviews})) * ${BAYES.priorRating}
      )                                         AS score_note
    FROM garages g
    WHERE g.is_active
    ${radiusFilter}
    ${servicesFilter}
    ${openFilter}
    ${certifiedFilter}
  `;
}

/**
 * Exposé séparément de son exécution pour que les tests puissent compiler la
 * requête sans base : `buildNearbyQuery(...).compile(db)` rend le SQL final et
 * ses paramètres, ce qui suffit à vérifier que `ST_DWithin` est présent et que
 * rien n'est interpolé en dur dans la chaîne.
 */
export function buildNearbyQuery(params: NearbySearchParams) {
  return sql<NearbyRow>`
    WITH candidates AS (${candidatesCte(params, true)})
    SELECT
      candidates.*,
      ${rankExpression(params.sort)} AS rank
    FROM candidates
    ORDER BY rank
    LIMIT ${params.limit}
  `;
}

export async function findNearbyGarages(
  db: Kysely<Database>,
  params: NearbySearchParams,
): Promise<NearbyRow[]> {
  const { rows } = await buildNearbyQuery(params).execute(db);
  return rows;
}

/**
 * Garage le plus proche, quel que soit le rayon.
 *
 * Sert uniquement quand la recherche dans le rayon ne renvoie rien : au bord de
 * la route, un écran vide est un échec produit. Volontairement séparé de la
 * requête principale — cette variante n'utilise PAS l'index GIST (pas de
 * `ST_DWithin`) et ne doit donc jamais devenir le chemin nominal.
 */
export async function findClosestGarage(
  db: Kysely<Database>,
  params: Omit<NearbySearchParams, 'limit' | 'sort'>,
): Promise<NearbyRow | null> {
  const query = sql<NearbyRow>`
    WITH candidates AS (${candidatesCte({ ...params, sort: 'distance', limit: 1 }, false)})
    SELECT candidates.*, 1 AS rank
    FROM candidates
    ORDER BY distance_m ASC, id ASC
    LIMIT 1
  `;

  const { rows } = await query.execute(db);
  return rows[0] ?? null;
}

/** Plan d'exécution de la requête de proximité — utilisé par les tests. */
export async function explainNearby(
  db: Kysely<Database>,
  params: NearbySearchParams,
): Promise<string> {
  const query = sql<{ 'QUERY PLAN': string }>`
    EXPLAIN
    WITH candidates AS (${candidatesCte(params, true)})
    SELECT candidates.*, ${rankExpression(params.sort)} AS rank
    FROM candidates
    ORDER BY rank
    LIMIT ${params.limit}
  `;

  const { rows } = await query.execute(db);
  return rows.map((row) => row['QUERY PLAN']).join('\n');
}
