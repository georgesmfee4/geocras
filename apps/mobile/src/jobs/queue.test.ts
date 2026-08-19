import { describe, expect, it } from 'vitest';
import type { Job } from '@geocras/shared';
import { firstToHandle, longestWaitStart, queueMix, waitStartedAt } from './queue';

/**
 * Fabrique minimale : les trois fonctions ne lisent que l'urgence et les deux
 * horodatages. Fournir un `Job` complet ferait de chaque cas de test une page
 * de champs sans rapport avec ce qu'il vérifie.
 */
function job(partial: Partial<Job> & { id: string }): Job {
  return {
    urgency: 'can_wait',
    createdAt: '2026-08-19T08:00:00.000Z',
    selectedAt: null,
    ...partial,
  } as Job;
}

describe('waitStartedAt', () => {
  it('part de la sélection du garage, pas de la création de la demande', () => {
    expect(
      waitStartedAt({
        createdAt: '2026-08-19T08:00:00.000Z',
        selectedAt: '2026-08-19T08:09:00.000Z',
      }),
    ).toBe('2026-08-19T08:09:00.000Z');
  });

  it('retombe sur la création tant que la sélection n’est pas horodatée', () => {
    expect(
      waitStartedAt({ createdAt: '2026-08-19T08:00:00.000Z', selectedAt: null }),
    ).toBe('2026-08-19T08:00:00.000Z');
  });
});

describe('firstToHandle', () => {
  it('rend null sur une file vide', () => {
    expect(firstToHandle([])).toBeNull();
  });

  it('fait passer le danger devant une demande plus ancienne', () => {
    const patient = job({ id: 'a', urgency: 'can_wait', selectedAt: '2026-08-19T08:00:00.000Z' });
    const danger = job({ id: 'b', urgency: 'danger', selectedAt: '2026-08-19T08:14:00.000Z' });

    expect(firstToHandle([patient, danger])?.id).toBe('b');
  });

  it('à urgence égale, désigne la plus ancienne', () => {
    const recent = job({ id: 'a', urgency: 'blocking', selectedAt: '2026-08-19T08:12:00.000Z' });
    const older = job({ id: 'b', urgency: 'blocking', selectedAt: '2026-08-19T08:03:00.000Z' });

    expect(firstToHandle([recent, older])?.id).toBe('b');
  });
});

describe('longestWaitStart', () => {
  it('rend null sur une file vide', () => {
    expect(longestWaitStart([])).toBeNull();
  });

  it('désigne l’attente la plus longue, quelle que soit l’urgence', () => {
    const danger = job({ id: 'a', urgency: 'danger', selectedAt: '2026-08-19T08:14:00.000Z' });
    const patient = job({ id: 'b', urgency: 'can_wait', selectedAt: '2026-08-19T08:00:00.000Z' });

    expect(longestWaitStart([danger, patient])).toBe('2026-08-19T08:00:00.000Z');
  });

  it('ignore un horodatage illisible plutôt que de rendre NaN', () => {
    const broken = job({ id: 'a', selectedAt: 'pas une date' });
    const sound = job({ id: 'b', selectedAt: '2026-08-19T08:05:00.000Z' });

    expect(longestWaitStart([broken, sound])).toBe('2026-08-19T08:05:00.000Z');
  });
});

describe('queueMix', () => {
  it('ne produit aucune tranche sur une file vide', () => {
    expect(queueMix([])).toEqual([]);
  });

  it('ordonne du plus grave au plus léger et somme à un', () => {
    const mix = queueMix([
      job({ id: 'a', urgency: 'can_wait' }),
      job({ id: 'b', urgency: 'danger' }),
      job({ id: 'c', urgency: 'can_wait' }),
      job({ id: 'd', urgency: 'blocking' }),
    ]);

    expect(mix.map((segment) => segment.urgency)).toEqual(['danger', 'blocking', 'can_wait']);
    expect(mix.map((segment) => segment.count)).toEqual([1, 1, 2]);
    expect(mix.reduce((total, segment) => total + segment.share, 0)).toBeCloseTo(1);
  });

  it('n’ouvre pas de tranche pour un niveau absent', () => {
    const mix = queueMix([job({ id: 'a', urgency: 'danger' })]);

    expect(mix).toEqual([{ urgency: 'danger', count: 1, share: 1 }]);
  });
});
