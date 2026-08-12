import { describe, expect, it } from 'vitest';
import {
  ANTI_FRAUD,
  ledgerIdempotencyKey,
  POINTS,
  TIER_DEFINITIONS,
  tierForRepairs,
  tierProgress,
} from './loyalty';

describe('grades de fidélité', () => {
  it('part de « Membre » tant qu’aucune réparation n’est terminée', () => {
    expect(tierForRepairs(0).id).toBe('standard');
    expect(tierForRepairs(0).discountPct).toBe(0);
  });

  it('passe en Bronze dès la première réparation terminée', () => {
    expect(tierForRepairs(1).id).toBe('bronze');
  });

  it('passe en Or à la dixième, pas à la neuvième', () => {
    expect(tierForRepairs(9).id).toBe('bronze');
    expect(tierForRepairs(10).id).toBe('gold');
  });

  it('ouvre la famille VIP au-delà de l’Or, et elle a plusieurs grades', () => {
    const vipTiers = TIER_DEFINITIONS.filter((tier) => tier.vip);
    expect(vipTiers.length).toBeGreaterThan(1);
    expect(vipTiers[0]!.threshold).toBeGreaterThan(
      TIER_DEFINITIONS.find((tier) => tier.id === 'gold')!.threshold,
    );
    expect(tierForRepairs(vipTiers[0]!.threshold).vip).toBe(true);
  });

  it('annonce ce qui reste à parcourir avant le grade suivant', () => {
    const progress = tierProgress(7);
    expect(progress.current.id).toBe('bronze');
    expect(progress.next?.id).toBe('gold');
    expect(progress.repairsToNext).toBe(3);
  });

  it('sature au grade maximum sans grade suivant', () => {
    const progress = tierProgress(9_999);
    expect(progress.current.id).toBe('vip_diamond');
    expect(progress.next).toBeNull();
    expect(progress.repairsToNext).toBe(0);
    expect(progress.ratio).toBe(1);
  });

  it('borne le ratio de progression entre 0 et 1', () => {
    for (const repairs of [0, 1, 9, 10, 19, 20, 34, 35, 59, 60, 5000]) {
      const { ratio } = tierProgress(repairs);
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });

  it('a des seuils et des remises strictement croissants', () => {
    for (let i = 1; i < TIER_DEFINITIONS.length; i += 1) {
      const previous = TIER_DEFINITIONS[i - 1]!;
      const current = TIER_DEFINITIONS[i]!;
      expect(current.threshold).toBeGreaterThan(previous.threshold);
      expect(current.discountPct).toBeGreaterThan(previous.discountPct);
    }
  });
});

describe('garde-fous anti-fraude', () => {
  it('crédite plus une intervention que le simple dépôt d’un avis', () => {
    expect(POINTS.assistance_completed).toBeGreaterThan(POINTS.review_published);
  });

  it('exige une séparation initiale réelle entre les deux parties', () => {
    // Deux téléphones posés côte à côte ne doivent jamais produire de crédit.
    expect(ANTI_FRAUD.minInitialSeparationMeters).toBeGreaterThan(0);
    expect(ANTI_FRAUD.minGarageTravelMeters).toBeGreaterThan(0);
  });

  it('laisse une fenêtre d’annulation avant de confirmer les points', () => {
    expect(ANTI_FRAUD.pendingPeriodHours).toBeGreaterThanOrEqual(1);
  });
});

describe('clé d’idempotence du journal', () => {
  it('est stable pour un même triplet', () => {
    const a = ledgerIdempotencyKey('u1', 'assistance_completed', 'r1');
    const b = ledgerIdempotencyKey('u1', 'assistance_completed', 'r1');
    expect(a).toBe(b);
  });

  it('sépare les motifs pour une même demande', () => {
    const assistance = ledgerIdempotencyKey('u1', 'assistance_completed', 'r1');
    const review = ledgerIdempotencyKey('u1', 'review_published', 'r1');
    expect(assistance).not.toBe(review);
  });

  it('sépare les utilisateurs', () => {
    expect(ledgerIdempotencyKey('u1', 'assistance_completed', 'r1')).not.toBe(
      ledgerIdempotencyKey('u2', 'assistance_completed', 'r1'),
    );
  });
});
