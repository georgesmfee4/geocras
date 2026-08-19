import { describe, expect, it } from 'vitest';
import { EMISSION, isNear, isPositionFresh, PROXIMITY } from './realtime';

describe('isNear', () => {
  it('ne conclut rien sans distance', () => {
    expect(isNear(null, false)).toBe(false);
    expect(isNear(null, true)).toBe(false);
  });

  it('écarte une distance non finie plutôt que de la comparer', () => {
    expect(isNear(Number.NaN, false)).toBe(false);
    expect(isNear(Number.POSITIVE_INFINITY, true)).toBe(false);
  });

  it('ouvre la fenêtre au seuil d’entrée', () => {
    expect(isNear(PROXIMITY.enterMeters, false)).toBe(true);
    expect(isNear(PROXIMITY.enterMeters + 1, false)).toBe(false);
  });

  it('garde la fenêtre ouverte jusqu’au seuil de sortie', () => {
    // Entre les deux seuils : fermée si elle l'était, ouverte si elle l'était.
    const between = (PROXIMITY.enterMeters + PROXIMITY.exitMeters) / 2;

    expect(isNear(between, false)).toBe(false);
    expect(isNear(between, true)).toBe(true);
  });

  it('referme la fenêtre au-delà du seuil de sortie', () => {
    expect(isNear(PROXIMITY.exitMeters, true)).toBe(true);
    expect(isNear(PROXIMITY.exitMeters + 1, true)).toBe(false);
  });

  it('laisse un écart d’hystérésis réel entre les deux seuils', () => {
    expect(PROXIMITY.exitMeters).toBeGreaterThan(PROXIMITY.enterMeters);
  });
});

describe('isPositionFresh', () => {
  const now = Date.parse('2026-08-19T10:00:00.000Z');

  it('ne conclut rien sans horodatage', () => {
    expect(isPositionFresh(null, now)).toBe(false);
  });

  it('écarte un horodatage illisible', () => {
    expect(isPositionFresh('pas une date', now)).toBe(false);
  });

  it('accepte un point dans la fenêtre de fraîcheur', () => {
    const recent = new Date(now - PROXIMITY.freshWithinMs + 1_000).toISOString();
    expect(isPositionFresh(recent, now)).toBe(true);
  });

  it('rejette un point plus vieux que la fenêtre', () => {
    const stale = new Date(now - PROXIMITY.freshWithinMs - 1).toISOString();
    expect(isPositionFresh(stale, now)).toBe(false);
  });

  it('traite une horloge locale en retard comme fraîche', () => {
    // Horodatage serveur postérieur à l'instant local : c'est l'appareil qui
    // dérive, pas la position qui vient du futur.
    const ahead = new Date(now + 5_000).toISOString();
    expect(isPositionFresh(ahead, now)).toBe(true);
  });

  it('reprend le seuil de péremption de l’émission', () => {
    expect(PROXIMITY.freshWithinMs).toBe(EMISSION.staleAfterMs);
  });
});
