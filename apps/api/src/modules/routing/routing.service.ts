import {
  estimateEtaMinutes,
  haversineMeters,
  type LatLng,
  type RouteLeg,
} from '@geocras/shared';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { decodePolyline6 } from './polyline';

/**
 * Calcul d'itinéraire.
 *
 * Le cahier des charges impose un trajet tracé **dans l'app**, sans lien
 * sortant vers une application de navigation. C'est donc à nous de produire la
 * géométrie, la distance et la durée — d'où ce module, qui parle à OSRM.
 *
 * Deux principes le gouvernent :
 *
 *  1. **Il ne tombe jamais.** OSRM peut être lent, saturé, ou simplement
 *     absent de l'environnement de développement. Un garagiste qui appuie sur
 *     « Y aller » doit obtenir une réponse dans tous les cas — quitte à ce
 *     qu'elle soit une estimation, clairement annoncée comme telle.
 *
 *  2. **Il dit ce qu'il vaut.** `precise: false` traverse le contrat jusqu'à
 *     l'écran, qui l'affiche. Une durée à vol d'oiseau présentée comme un
 *     calcul routier fait arriver le dépanneur en retard sur sa propre
 *     promesse.
 */

/** Au-delà, on n'attend plus : mieux vaut une estimation tout de suite. */
const OSRM_TIMEOUT_MS = 4_000;

/**
 * Durée de vie d'une entrée de cache.
 *
 * Le trafic n'est pas modélisé par le profil `driving` d'OSRM : entre deux
 * appels à une minute d'intervalle depuis le même endroit, la réponse est
 * identique au mètre près. Le cache existe pour ne pas payer un appel par
 * position GPS pendant qu'une dépanneuse roule.
 */
const CACHE_TTL_MS = 60_000;

/**
 * Maille de la clé de cache, en degrés. ≈ 110 m.
 *
 * Assez fine pour que le tracé reste juste, assez grossière pour que deux
 * points GPS successifs d'un véhicule à l'arrêt tombent dans la même case.
 */
const CACHE_GRID = 0.001;

/** Plafond : le cache est un tampon, pas un entrepôt. */
const CACHE_MAX_ENTRIES = 500;

type CacheEntry = { leg: RouteLeg; at: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(from: LatLng, to: LatLng): string {
  const snap = (value: number) => Math.round(value / CACHE_GRID);
  return `${snap(from.lat)}:${snap(from.lng)}>${snap(to.lat)}:${snap(to.lng)}`;
}

/**
 * Réponse d'OSRM, réduite à ce qu'on lui demande.
 *
 * Typée à la main plutôt que validée par zod : c'est un service que nous
 * hébergeons, dont la forme est figée par la version que nous déployons, et le
 * chemin de repli couvre déjà toute réponse inattendue — un échec de parsing y
 * mène exactement comme un timeout.
 */
type OsrmResponse = {
  code?: string;
  routes?: { distance?: number; duration?: number; geometry?: string }[];
};

/**
 * Estimation à vol d'oiseau, corrigée du facteur de détour de Yaoundé.
 *
 * Le repli, et le seul endroit du serveur où une durée de trajet est fabriquée
 * sans réseau routier. `geometry` reste **vide** plutôt que de contenir le
 * segment droit : une ligne qui traverse les bâtiments sur une carte se lit
 * comme un bug du tracé, alors que l'absence de tracé se lit comme ce qu'elle
 * est — on n'a pas pu calculer l'itinéraire.
 */
function fallbackLeg(from: LatLng, to: LatLng): RouteLeg {
  const straightM = haversineMeters(from, to);

  return {
    distanceM: Math.round(straightM),
    durationS: estimateEtaMinutes(straightM) * 60,
    geometry: [],
    precise: false,
    from,
    to,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Itinéraire routier entre deux points.
 *
 * Ne rejette jamais : toute erreur — réseau, délai dépassé, réponse
 * inattendue — se résout en estimation marquée `precise: false`.
 */
export async function computeRoute(from: LatLng, to: LatLng): Promise<RouteLeg> {
  const key = cacheKey(from, to);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.leg;

  const leg = await requestOsrm(from, to);

  // Une estimation de repli n'entre pas au cache : elle vaut pour cette
  // seconde-là, et la garder une minute empêcherait de retrouver le calcul
  // routier dès qu'OSRM redevient joignable.
  if (leg.precise) {
    if (cache.size >= CACHE_MAX_ENTRIES) {
      // Éviction naïve de la plus ancienne clé insérée : `Map` conserve
      // l'ordre d'insertion, et un LRU complet serait du zèle pour un tampon
      // d'une minute.
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, { leg, at: Date.now() });
  }

  return leg;
}

async function requestOsrm(from: LatLng, to: LatLng): Promise<RouteLeg> {
  /**
   * `lng,lat` — dans cet ordre, comme partout en géospatial et à l'inverse de
   * la façon dont on énonce une position. C'est l'erreur la plus fréquente du
   * domaine, et elle ne se voit pas : elle rend un itinéraire plausible, mais
   * ailleurs sur la planète.
   */
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `${env.OSRM_URL}/route/v1/driving/${coordinates}` +
    `?overview=simplified&geometries=polyline6&alternatives=false&steps=false`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });

    if (!response.ok) throw new Error(`OSRM ${response.status}`);

    const body = (await response.json()) as OsrmResponse;
    const route = body.routes?.[0];

    if (body.code !== 'Ok' || !route || route.distance === undefined || route.duration === undefined) {
      throw new Error(`OSRM ${body.code ?? 'réponse vide'}`);
    }

    return {
      distanceM: Math.round(route.distance),
      durationS: Math.round(route.duration),
      geometry: route.geometry ? decodePolyline6(route.geometry) : [],
      precise: true,
      from,
      to,
      computedAt: new Date().toISOString(),
    };
  } catch (error) {
    // `warn` et non `error` : le repli est un chemin prévu, pas un incident.
    // En revanche, s'il devient permanent, c'est cette ligne qui le dira.
    logger.warn({ err: error, osrm: env.OSRM_URL }, 'Routage indisponible — repli à vol d’oiseau');
    return fallbackLeg(from, to);
  }
}
