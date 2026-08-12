import { describe, expect, it } from 'vitest';
import { PositionFilter, type RawFix } from './filter';

function fix(overrides: Partial<RawFix> = {}): RawFix {
  return {
    lat: 3.848,
    lng: 11.5021,
    accuracyM: 12,
    speedMps: 0,
    headingDeg: null,
    timestamp: 1_000_000,
    ...overrides,
  };
}

describe('acceptation des positions', () => {
  it('accepte la première mesure valable', () => {
    const filter = new PositionFilter();
    expect(filter.accept(fix())).not.toBeNull();
  });

  it('accepte un déplacement urbain normal', () => {
    const filter = new PositionFilter();
    filter.accept(fix());

    const moved = filter.accept(
      fix({ lat: 3.8495, timestamp: 1_030_000, speedMps: 6 }),
    );
    expect(moved).not.toBeNull();
  });

  it('rejette une téléportation GPS', () => {
    const filter = new PositionFilter();
    filter.accept(fix());

    // 3 km en 2 secondes : du bruit, pas une voiture.
    const jump = filter.accept(fix({ lat: 3.878, timestamp: 1_002_000 }));
    expect(jump).toBeNull();
  });

  it('conserve la dernière position valable après un rejet', () => {
    const filter = new PositionFilter();
    const first = filter.accept(fix());
    filter.accept(fix({ lat: 3.878, timestamp: 1_002_000 }));

    expect(filter.current).toEqual(first);
  });

  it('rejette une précision inexploitable', () => {
    const filter = new PositionFilter();
    expect(filter.accept(fix({ accuracyM: 500 }))).toBeNull();
  });

  it('accepte une précision médiocre mais utilisable', () => {
    // Mieux vaut un point à ±80 m que pas de point du tout au bord de la route.
    const filter = new PositionFilter();
    expect(filter.accept(fix({ accuracyM: 80 }))).not.toBeNull();
  });

  it('accepte une précision inconnue', () => {
    const filter = new PositionFilter();
    expect(filter.accept(fix({ accuracyM: null }))).not.toBeNull();
  });

  it('rejette un horodatage qui n’avance pas', () => {
    const filter = new PositionFilter();
    filter.accept(fix());
    expect(filter.accept(fix({ lat: 3.849 }))).toBeNull();
  });

  it('rejette un point antérieur au précédent', () => {
    const filter = new PositionFilter();
    filter.accept(fix());
    expect(filter.accept(fix({ lat: 3.849, timestamp: 999_000 }))).toBeNull();
  });
});

describe('lissage de vitesse', () => {
  it('adopte la première mesure telle quelle', () => {
    const filter = new PositionFilter();
    const accepted = filter.accept(fix({ speedMps: 8 }));
    expect(accepted?.smoothedSpeedMps).toBe(8);
  });

  it('amortit un pic au lieu de le suivre', () => {
    const filter = new PositionFilter();
    filter.accept(fix({ speedMps: 5 }));
    const accepted = filter.accept(fix({ lat: 3.8482, timestamp: 1_010_000, speedMps: 25 }));

    expect(accepted!.smoothedSpeedMps).toBeGreaterThan(5);
    expect(accepted!.smoothedSpeedMps).toBeLessThan(25);
  });

  it('traite une vitesse absente comme un arrêt plutôt que comme une inconnue', () => {
    const filter = new PositionFilter();
    const accepted = filter.accept(fix({ speedMps: null }));
    expect(accepted?.smoothedSpeedMps).toBe(0);
  });
});

describe('réinitialisation', () => {
  it('oublie l’historique après reset', () => {
    const filter = new PositionFilter();
    filter.accept(fix());
    filter.reset();

    expect(filter.current).toBeNull();
    // Sans historique, un point lointain redevient acceptable : c'est le
    // comportement voulu après un changement de session ou une reprise.
    expect(filter.accept(fix({ lat: 3.878, timestamp: 1_002_000 }))).not.toBeNull();
  });
});
