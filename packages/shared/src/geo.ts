/**
 * Géométrie et estimation de durée.
 *
 * ⚠️ PROVISOIRE — `estimateEtaMinutes` est une approximation à vol d'oiseau
 * corrigée par un facteur de détour. Elle tient jusqu'à la mise en service
 * d'OSRM (phase « itinéraire »), après quoi les ETA doivent venir du serveur
 * de routage. Ne pas construire de logique métier sur sa précision.
 */

const EARTH_RADIUS_M = 6_371_008.8;

export type LatLng = { readonly lat: number; readonly lng: number };

/** Distance orthodromique en mètres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Calibration Yaoundé, à réviser avec les données réelles de `position_pings`.
 * `detourFactor` : rapport observé distance routière / distance à vol d'oiseau
 * dans un tissu urbain dense et peu maillé.
 */
export const ETA_CALIBRATION = {
  detourFactor: 1.35,
  urbanSpeedKmh: 22,
  walkingSpeedKmh: 4.5,
} as const;

export type TravelMode = 'driving' | 'walking';

/** Durée estimée en minutes, minimum 1. */
export function estimateEtaMinutes(distanceMeters: number, mode: TravelMode = 'driving'): number {
  const speedKmh =
    mode === 'walking' ? ETA_CALIBRATION.walkingSpeedKmh : ETA_CALIBRATION.urbanSpeedKmh;
  const roadMeters = distanceMeters * ETA_CALIBRATION.detourFactor;
  return Math.max(1, Math.round(roadMeters / 1000 / speedKmh * 60));
}

/**
 * Lissage exponentiel de la vitesse. Sans ça l'ETA saute d'un ping à l'autre et
 * devient anxiogène — le chiffre affiché doit être stable, pas instantané.
 */
export const SPEED_SMOOTHING_ALPHA = 0.3;

export function smoothSpeed(previousMps: number | null, sampleMps: number): number {
  if (previousMps === null) return sampleMps;
  return SPEED_SMOOTHING_ALPHA * sampleMps + (1 - SPEED_SMOOTHING_ALPHA) * previousMps;
}

/**
 * Au-delà, le point est du bruit GPS et non un déplacement : en ville
 * camerounaise, 150 km/h entre deux pings signifie une dérive, pas une voiture.
 */
export const MAX_PLAUSIBLE_SPEED_MPS = 150 / 3.6;

export function isPlausibleMove(from: LatLng, to: LatLng, elapsedSeconds: number): boolean {
  if (elapsedSeconds <= 0) return false;
  return haversineMeters(from, to) / elapsedSeconds <= MAX_PLAUSIBLE_SPEED_MPS;
}

/** Zone de lancement. Sert à rejeter les coordonnées manifestement fausses (0,0). */
export const CAMEROON_BOUNDS = {
  minLat: 1.6,
  maxLat: 13.1,
  minLng: 8.4,
  maxLng: 16.2,
} as const;

export const YAOUNDE_CENTER: LatLng = { lat: 3.848, lng: 11.5021 };

export function isWithinCameroon(point: LatLng): boolean {
  return (
    point.lat >= CAMEROON_BOUNDS.minLat &&
    point.lat <= CAMEROON_BOUNDS.maxLat &&
    point.lng >= CAMEROON_BOUNDS.minLng &&
    point.lng <= CAMEROON_BOUNDS.maxLng
  );
}
