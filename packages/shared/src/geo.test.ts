import { describe, expect, it } from 'vitest';
import {
  estimateEtaMinutes,
  haversineMeters,
  isPlausibleMove,
  isWithinCameroon,
  smoothSpeed,
  YAOUNDE_CENTER,
} from './geo';

describe('haversine', () => {
  it('renvoie zéro pour deux points identiques', () => {
    expect(haversineMeters(YAOUNDE_CENTER, YAOUNDE_CENTER)).toBe(0);
  });

  it('mesure une distance connue à Yaoundé avec moins de 2 % d’écart', () => {
    // Centre-ville → Bastos, ~3,1 km à vol d'oiseau.
    const bastos = { lat: 3.8869, lng: 11.5089 };
    const meters = haversineMeters(YAOUNDE_CENTER, bastos);
    expect(meters).toBeGreaterThan(4200);
    expect(meters).toBeLessThan(4500);
  });

  it('est symétrique', () => {
    const a = { lat: 3.848, lng: 11.5021 };
    const b = { lat: 3.87, lng: 11.52 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe('estimation de durée', () => {
  it('ne descend jamais sous une minute', () => {
    expect(estimateEtaMinutes(5)).toBe(1);
    expect(estimateEtaMinutes(0)).toBe(1);
  });

  it('croît avec la distance', () => {
    expect(estimateEtaMinutes(5000)).toBeGreaterThan(estimateEtaMinutes(1000));
  });

  it('donne une durée à pied plus longue qu’en voiture', () => {
    expect(estimateEtaMinutes(2000, 'walking')).toBeGreaterThan(estimateEtaMinutes(2000, 'driving'));
  });

  it('reste plausible sur la distance de la maquette : 1,2 km ≈ 5 min', () => {
    expect(estimateEtaMinutes(1200, 'driving')).toBeGreaterThanOrEqual(4);
    expect(estimateEtaMinutes(1200, 'driving')).toBeLessThanOrEqual(6);
  });
});

describe('lissage de vitesse', () => {
  it('adopte la première mesure telle quelle', () => {
    expect(smoothSpeed(null, 12)).toBe(12);
  });

  it('amortit un pic au lieu de le suivre', () => {
    const smoothed = smoothSpeed(10, 40);
    expect(smoothed).toBeGreaterThan(10);
    expect(smoothed).toBeLessThan(40);
  });

  it('converge vers la valeur stable après plusieurs mesures', () => {
    let speed = smoothSpeed(null, 0);
    for (let i = 0; i < 40; i += 1) speed = smoothSpeed(speed, 20);
    expect(speed).toBeCloseTo(20, 1);
  });
});

describe('rejet du bruit GPS', () => {
  it('accepte un déplacement urbain normal', () => {
    const from = { lat: 3.848, lng: 11.5021 };
    const to = { lat: 3.8495, lng: 11.5035 };
    expect(isPlausibleMove(from, to, 30)).toBe(true);
  });

  it('rejette une téléportation de 3 km en 2 secondes', () => {
    const from = { lat: 3.848, lng: 11.5021 };
    const to = { lat: 3.878, lng: 11.5021 };
    expect(isPlausibleMove(from, to, 2)).toBe(false);
  });

  it('rejette un intervalle nul plutôt que de diviser par zéro', () => {
    const point = { lat: 3.848, lng: 11.5021 };
    expect(isPlausibleMove(point, point, 0)).toBe(false);
  });
});

describe('bornes géographiques', () => {
  it('accepte Yaoundé', () => {
    expect(isWithinCameroon(YAOUNDE_CENTER)).toBe(true);
  });

  it('rejette le point nul, symptôme classique d’un GPS non fixé', () => {
    expect(isWithinCameroon({ lat: 0, lng: 0 })).toBe(false);
  });

  it('rejette Paris', () => {
    expect(isWithinCameroon({ lat: 48.8566, lng: 2.3522 })).toBe(false);
  });
});
