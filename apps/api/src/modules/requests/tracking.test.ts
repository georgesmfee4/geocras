import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '../../db/client';
import { computeTracking } from './tracking';
import type { LatestPosition } from './requests.repo';

afterAll(async () => {
  await pool.end();
});

const PANNE = { lat: 3.848, lng: 11.5021 };
const GARAGE = { lat: 3.8869, lng: 11.5089 };

function ping(
  role: 'client' | 'garage',
  lat: number,
  lng: number,
  speedMps: number | null = null,
): LatestPosition {
  return { role, lat, lng, speed_mps: speedMps, recorded_at: new Date('2026-08-01T10:00:00Z') };
}

describe('calcul des deux ETA', () => {
  it('rend les deux compteurs de la maquette 04', () => {
    const { toClient, toGarage } = computeTracking(
      [ping('garage', 3.86, 11.505, 12.5), ping('client', 3.848, 11.5021, 1.2)],
      { clientOrigin: PANNE, garageLocation: GARAGE },
    );

    expect(toClient.role).toBe('garage');
    expect(toGarage.role).toBe('client');
    expect(toClient.etaMin).toBeGreaterThan(0);
    expect(toGarage.etaMin).toBeGreaterThan(0);
  });

  it('qualifie de « à pied » un client qui se déplace lentement', () => {
    const { toGarage } = computeTracking([ping('client', 3.85, 11.503, 1.1)], {
      clientOrigin: PANNE,
      garageLocation: GARAGE,
    });

    expect(toGarage.mode).toBe('walking');
  });

  it('qualifie de « en voiture » un garagiste roulant à 45 km/h', () => {
    const { toClient } = computeTracking([ping('garage', 3.86, 11.505, 12.5)], {
      clientOrigin: PANNE,
      garageLocation: GARAGE,
    });

    expect(toClient.mode).toBe('driving');
    expect(toClient.speedKmh).toBe(45);
  });

  it('rapproche l’ETA à mesure que le garagiste se rapproche', () => {
    const loin = computeTracking([ping('garage', 3.92, 11.52, 12)], {
      clientOrigin: PANNE,
      garageLocation: GARAGE,
    });
    const proche = computeTracking([ping('garage', 3.85, 11.503, 12)], {
      clientOrigin: PANNE,
      garageLocation: GARAGE,
    });

    expect(proche.toClient.etaMin!).toBeLessThan(loin.toClient.etaMin!);
  });
});

describe('absence de données', () => {
  it('ne fabrique pas d’ETA pour un garagiste qui n’a rien émis', () => {
    const { toClient } = computeTracking([], {
      clientOrigin: PANNE,
      garageLocation: GARAGE,
    });

    // Un « 8 min » inventé serait pire qu'un tiret : l'utilisateur attendrait.
    expect(toClient.etaMin).toBeNull();
    expect(toClient.distanceM).toBeNull();
    expect(toClient.updatedAt).toBeNull();
  });

  it('estime le trajet du client depuis le lieu de la panne tant qu’il n’a pas bougé', () => {
    const { toGarage } = computeTracking([], {
      clientOrigin: PANNE,
      garageLocation: GARAGE,
    });

    expect(toGarage.distanceM).toBeGreaterThan(0);
    expect(toGarage.position).toEqual(PANNE);
    expect(toGarage.updatedAt).toBeNull();
  });

  it('ne calcule rien vers le garage tant qu’aucun garage n’est retenu', () => {
    const { toGarage } = computeTracking([ping('client', 3.85, 11.503)], {
      clientOrigin: PANNE,
      garageLocation: null,
    });

    expect(toGarage.etaMin).toBeNull();
  });

  it('reste en mode voiture quand la vitesse est inconnue', () => {
    const { toClient } = computeTracking([ping('garage', 3.86, 11.505, null)], {
      clientOrigin: PANNE,
      garageLocation: GARAGE,
    });

    expect(toClient.mode).toBe('driving');
    expect(toClient.speedKmh).toBeNull();
  });
});

describe('fraîcheur de la donnée', () => {
  it('expose l’horodatage du dernier point reçu, base du compteur « MAJ 3s »', () => {
    const recordedAt = new Date('2026-08-01T10:00:00Z');
    const { toClient } = computeTracking(
      [{ role: 'garage', lat: 3.86, lng: 11.505, speed_mps: 10, recorded_at: recordedAt }],
      { clientOrigin: PANNE, garageLocation: GARAGE },
    );

    expect(toClient.updatedAt).toBe(recordedAt.toISOString());
  });
});
