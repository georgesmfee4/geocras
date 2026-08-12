import {
  estimateEtaMinutes,
  haversineMeters,
  type LatLng,
  type TrackingEta,
} from '@geocras/shared';
import type { LatestPosition } from './requests.repo';

/**
 * En dessous, le déplacement est considéré comme piéton.
 * La maquette 04 affiche « 1,2 km · à pied » pour le trajet du client : cette
 * mention doit refléter la vitesse mesurée, pas une hypothèse figée.
 */
const WALKING_THRESHOLD_MPS = 2.5;

function modeFor(speedMps: number | null): 'driving' | 'walking' {
  if (speedMps === null) return 'driving';
  return speedMps < WALKING_THRESHOLD_MPS ? 'walking' : 'driving';
}

function emptyEta(role: TrackingEta['role']): TrackingEta {
  return {
    role,
    etaMin: null,
    distanceM: null,
    speedKmh: null,
    mode: 'driving',
    position: null,
    updatedAt: null,
  };
}

/**
 * Calcule les deux ETA de l'écran de suivi.
 *
 * Volontairement côté serveur : les deux parties doivent voir le même chiffre,
 * et cet ETA alimente la détection de fraude. Un calcul client donnerait deux
 * vérités divergentes et une valeur qu'on ne pourrait pas auditer.
 */
export function computeTracking(
  positions: readonly LatestPosition[],
  destinations: { clientOrigin: LatLng; garageLocation: LatLng | null },
): { toClient: TrackingEta; toGarage: TrackingEta } {
  const garagePing = positions.find((p) => p.role === 'garage') ?? null;
  const clientPing = positions.find((p) => p.role === 'client') ?? null;

  // Garagiste → lieu de la panne.
  const toClient: TrackingEta = garagePing
    ? buildEta('garage', { lat: garagePing.lat, lng: garagePing.lng }, destinations.clientOrigin, garagePing)
    : emptyEta('garage');

  // Client → garage. Sans position émise, on part du lieu de la panne : c'est
  // la meilleure estimation connue tant que le client n'a pas bougé.
  const clientFrom: LatLng = clientPing
    ? { lat: clientPing.lat, lng: clientPing.lng }
    : destinations.clientOrigin;

  const toGarage: TrackingEta = destinations.garageLocation
    ? buildEta('client', clientFrom, destinations.garageLocation, clientPing)
    : emptyEta('client');

  return { toClient, toGarage };
}

function buildEta(
  role: TrackingEta['role'],
  from: LatLng,
  to: LatLng,
  ping: LatestPosition | null,
): TrackingEta {
  const distanceM = Math.round(haversineMeters(from, to));
  const mode = modeFor(ping?.speed_mps ?? null);

  return {
    role,
    distanceM,
    etaMin: estimateEtaMinutes(distanceM, mode),
    speedKmh: ping?.speed_mps == null ? null : Math.round(ping.speed_mps * 3.6),
    mode,
    position: from,
    updatedAt: ping ? new Date(ping.recorded_at).toISOString() : null,
  };
}
