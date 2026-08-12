import { describe, expect, it } from 'vitest';
import { haversineMeters } from '@geocras/shared';
import { SEARCH_ANCHOR_THRESHOLD_M, shouldReanchor } from './useStableOrigin';

/**
 * Coordonnées réelles relevées sur appareil à Ebolowa, appareil **posé sur une
 * table**, avec une précision annoncée de ±100 m. Ce sont exactement les trois
 * positions qui avaient déclenché trois recherches serveur successives.
 */
const DRIFT = [
  { lat: 2.9237073, lng: 11.1606953 },
  { lat: 2.9230904, lng: 11.160981 },
  { lat: 2.9231192, lng: 11.1616425 },
] as const;

describe('shouldReanchor', () => {
  it("s'ancre au premier point connu", () => {
    expect(shouldReanchor(null, DRIFT[0])).toBe(true);
  });

  it('ignore la dérive GPS observée à l’arrêt', () => {
    // Garde-fou sur la prémisse : si ces points s'écartaient de plus que le
    // seuil, le test passerait pour la mauvaise raison.
    for (const point of DRIFT.slice(1)) {
      expect(haversineMeters(DRIFT[0], point)).toBeLessThan(SEARCH_ANCHOR_THRESHOLD_M);
      expect(shouldReanchor(DRIFT[0], point)).toBe(false);
    }
  });

  it('suit un déplacement réel', () => {
    // ~330 m au nord : 0,003° de latitude ≈ 334 m.
    const moved = { lat: DRIFT[0].lat + 0.003, lng: DRIFT[0].lng };
    expect(shouldReanchor(DRIFT[0], moved)).toBe(true);
  });

  it('bascule exactement au seuil, pas au-delà', () => {
    const anchor = { lat: 3.8667, lng: 11.5167 };
    // 0,001° de latitude ≈ 111,2 m — en deçà du seuil.
    expect(shouldReanchor(anchor, { lat: anchor.lat + 0.001, lng: anchor.lng })).toBe(false);
    // 0,0014° ≈ 155,7 m — au-delà.
    expect(shouldReanchor(anchor, { lat: anchor.lat + 0.0014, lng: anchor.lng })).toBe(true);
  });
});
