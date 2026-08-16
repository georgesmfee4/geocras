import { z } from 'zod';
import { coordinatesSchema } from './common';

/**
 * Itinéraire routier.
 *
 * Le cahier des charges impose un trajet **tracé dans l'app** : aucun lien
 * sortant vers une application de navigation tierce. Ce contrat est donc le
 * seul canal par lequel une distance et une durée de trajet entrent dans le
 * produit.
 *
 * Le calcul est fait **par le serveur**, comme les ETA de suivi, et pour la
 * même raison : les deux parties doivent voir le même chiffre. Un garagiste qui
 * annonce vingt minutes pendant que le client en lit trente n'a pas un écart
 * d'arrondi, il a une dispute.
 */

/**
 * Un trajet calculé, du point de départ au lieu de la panne.
 *
 * `precise` est le champ le plus important de cet objet — voir plus bas.
 */
export const routeLegSchema = z.object({
  /** Distance **routière**, en mètres. Pas la distance à vol d'oiseau. */
  distanceM: z.number().nonnegative(),
  /** Durée estimée, en secondes. */
  durationS: z.number().nonnegative(),
  /**
   * Tracé simplifié, en `[lng, lat]` — l'ordre de GeoJSON et de MapLibre.
   *
   * Simplifié et non détaillé : le tracé sert à montrer par où l'on passe, pas
   * à guider virage par virage. La géométrie complète d'un trajet urbain pèse
   * dix fois plus pour un rendu identique à l'échelle où on l'affiche, et cette
   * différence se paie en forfait data.
   */
  geometry: z.array(z.tuple([z.number(), z.number()])),
  /**
   * Le calcul vient-il du **réseau routier réel** ?
   *
   * `false` signale le repli : le serveur de routage n'a pas répondu, et les
   * valeurs ci-dessus sont une estimation à vol d'oiseau corrigée d'un facteur
   * de détour. L'écart peut atteindre un facteur deux en ville.
   *
   * L'app **doit** le montrer. Un garagiste qui promet « 8 min » à un client
   * sur la foi d'une ligne droite arrive à 15 et passe pour quelqu'un qui a
   * menti — alors que c'est l'app qui n'a pas dit ce qu'elle savait.
   */
  precise: z.boolean(),
  /** Départ retenu pour ce calcul — la position réelle de qui répond au SOS. */
  from: coordinatesSchema,
  /** Arrivée : le lieu de la panne, tel qu'enregistré sur la demande. */
  to: coordinatesSchema,
  computedAt: z.string().datetime(),
});
export type RouteLeg = z.infer<typeof routeLegSchema>;

/**
 * Le trajet d'approche, **vu par le client**.
 *
 * Même géométrie que celle du garagiste, mais le client ne fournit pas le
 * départ : il ne connaît pas la position du dépanneur, et il n'a pas à la
 * demander. C'est le serveur qui prend le dernier point émis par le garage —
 * la même source que l'ETA du suivi — et qui trace depuis là.
 *
 * Une seule vérité pour les deux écrans : le kilométrage que le client lit est
 * celui que le garagiste conduit.
 */
export const approachRouteSchema = routeLegSchema.extend({
  /**
   * Le départ vient-il d'une position **réellement émise** par le garagiste ?
   *
   * `false` signifie qu'aucun point n'est encore arrivé et qu'on est parti de
   * l'adresse de l'atelier. C'est le cas normal des premières secondes après
   * l'acceptation, et il doit se voir : un client qui croit suivre une
   * dépanneuse en mouvement alors qu'il regarde un garage immobile conclut à
   * un dépanneur qui ne part pas.
   */
  fromLive: z.boolean(),
});
export type ApproachRoute = z.infer<typeof approachRouteSchema>;

/**
 * Vitesse en dessous de laquelle on considère le véhicule **à l'arrêt**.
 *
 * 4 km/h : la marche. En dessous, un GPS de téléphone produit surtout du bruit,
 * et annoncer « 2 km/h » sur un véhicule immobile ferait douter de tout le
 * reste de l'écran.
 *
 * Ce seuil est ce qui permet de dire honnêtement « arrêté » à un client qui
 * voit son ETA ne plus bouger — feu rouge, embouteillage, ou dépanneur qui
 * s'est garé. Sans lui, l'écran laisse croire à une donnée figée.
 */
export const STOPPED_SPEED_KMH = 4;

export const routeQuerySchema = z.object({
  /**
   * Position de celui qui répond, et **pas** celle du garage.
   *
   * C'est toute la raison d'être du paramètre : le garagiste peut être chez
   * lui, sur une autre intervention, ou déjà en route. Calculer depuis
   * l'adresse de l'atelier donnerait une durée fausse dans le cas le plus
   * fréquent.
   */
  fromLat: z.coerce.number().min(-90).max(90),
  fromLng: z.coerce.number().min(-180).max(180),
});
export type RouteQuery = z.infer<typeof routeQuerySchema>;

/**
 * Cadence de recalcul, côté mobile.
 *
 * Deux garde-fous cumulés, comme pour l'émission de position : un déplacement
 * minimal **et** un intervalle minimal. Un véhicule à l'arrêt dans un
 * embouteillage ne relance rien — recalculer le même trajet toutes les cinq
 * secondes coûterait un appel de routage par tranche de rien.
 *
 * 150 m parce qu'en dessous le tracé ne change pas visiblement à l'échelle
 * d'affichage, et que la durée bouge d'une poignée de secondes.
 */
export const ROUTE_REFRESH = {
  minMoveMeters: 150,
  minIntervalMs: 20_000,
  /** Au-delà, la durée affichée est signalée comme datée. */
  staleAfterMs: 90_000,
} as const;

/** Durée de trajet en une ligne : `8 min`, `1 h 05`. */
export function formatRouteDuration(seconds: number, locale: 'fr' | 'en' = 'fr'): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const padded = String(rest).padStart(2, '0');
  return locale === 'fr' ? `${hours} h ${padded}` : `${hours}h${padded}`;
}

/**
 * Heure d'arrivée prévue, au format `14:32`, **en heure du Cameroun**.
 *
 * Le pays n'applique pas d'heure d'été : un décalage fixe d'une heure suffit,
 * là où `Intl` avec un fuseau dépend de la présence d'ICU dans le moteur — dont
 * on ne peut rien présumer sur Hermes. Et surtout, l'heure d'arrivée est un
 * fait local que le client et le garagiste doivent lire pareil, quel que soit
 * le réglage de leur appareil.
 */
export function arrivalClock(seconds: number, now: number = Date.now()): string {
  const at = new Date(now + seconds * 1000);
  const cameroon = new Date(at.getTime() + (60 + at.getTimezoneOffset()) * 60_000);
  const hh = String(cameroon.getHours()).padStart(2, '0');
  const mm = String(cameroon.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
