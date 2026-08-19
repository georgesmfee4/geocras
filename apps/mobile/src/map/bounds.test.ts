import { describe, expect, it } from 'vitest';
import { boundsOf, centerOf, isDegenerate, MIN_SPAN_DEGREES } from './bounds';

describe('boundsOf', () => {
  it('rend null quand il n’y a rien à cadrer', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('englobe tous les points, dans l’ordre ouest / sud / est / nord', () => {
    expect(
      boundsOf([
        [11.52, 3.87],
        [11.48, 3.91],
        [11.55, 3.84],
      ]),
    ).toEqual([11.48, 3.84, 11.55, 3.91]);
  });

  it('rend un rectangle plat sur un point unique', () => {
    expect(boundsOf([[11.5167, 3.8667]])).toEqual([11.5167, 3.8667, 11.5167, 3.8667]);
  });

  it('écarte les points non finis au lieu d’indéfinir les bornes', () => {
    const bounds = boundsOf([
      [11.52, 3.87],
      [Number.NaN, 3.9],
      [11.5, Number.POSITIVE_INFINITY],
      [11.48, 3.91],
    ]);

    expect(bounds).toEqual([11.48, 3.87, 11.52, 3.91]);
  });

  it('rend null quand aucun point n’est exploitable', () => {
    expect(boundsOf([[Number.NaN, Number.NaN]])).toBeNull();
  });
});

describe('isDegenerate', () => {
  it('reconnaît un départ confondu avec l’arrivée', () => {
    const bounds = boundsOf([
      [11.5167, 3.8667],
      [11.51672, 3.86671],
    ]);

    expect(bounds).not.toBeNull();
    expect(isDegenerate(bounds!)).toBe(true);
  });

  it('laisse passer un trajet strictement nord-sud', () => {
    const bounds = boundsOf([
      [11.5167, 3.86],
      [11.5167, 3.9],
    ]);

    expect(isDegenerate(bounds!)).toBe(false);
  });

  it('laisse passer un trajet strictement est-ouest', () => {
    const bounds = boundsOf([
      [11.48, 3.8667],
      [11.55, 3.8667],
    ]);

    expect(isDegenerate(bounds!)).toBe(false);
  });

  it('bascule exactement au seuil', () => {
    const justUnder: Parameters<typeof isDegenerate>[0] = [
      11.5,
      3.8,
      11.5 + MIN_SPAN_DEGREES / 2,
      3.8,
    ];
    const justOver: Parameters<typeof isDegenerate>[0] = [
      11.5,
      3.8,
      11.5 + MIN_SPAN_DEGREES * 2,
      3.8,
    ];

    expect(isDegenerate(justUnder)).toBe(true);
    expect(isDegenerate(justOver)).toBe(false);
  });
});

describe('centerOf', () => {
  it('rend le milieu en [lng, lat]', () => {
    expect(centerOf([11.48, 3.84, 11.52, 3.88])).toEqual([11.5, 3.86]);
  });
});
