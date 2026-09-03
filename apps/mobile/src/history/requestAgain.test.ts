import { describe, expect, it } from 'vitest';
import { REQUEST_STATUSES } from '@geocras/shared';
import { canRequestAgain, type RecallCandidate } from './requestAgain';

function candidate(partial: Partial<RecallCandidate> = {}): RecallCandidate {
  return { role: 'client', status: 'closed', garageId: 'g-1', ...partial };
}

describe('canRequestAgain', () => {
  it('accepte une intervention terminée dont on connaît le garage', () => {
    expect(canRequestAgain(candidate())).toBe(true);
  });

  it('accepte une demande annulée dont un garage avait été retenu', () => {
    // On a choisi un garage puis renoncé : rien n'empêche de le rappeler.
    expect(canRequestAgain(candidate({ status: 'cancelled' }))).toBe(true);
  });

  it('refuse du côté du garagiste', () => {
    expect(canRequestAgain(candidate({ role: 'garage' }))).toBe(false);
  });

  it('refuse tant que la demande vit', () => {
    const ongoing: RequestStatusList = [
      'pending',
      'selected',
      'accepted',
      'en_route',
      'awaiting_confirmation',
    ];

    for (const status of ongoing) {
      expect(canRequestAgain(candidate({ status }))).toBe(false);
    }
  });

  it('refuse sans garage connu — demande abandonnée, ou refusée par le garage', () => {
    // Le refus detache le garage cote serveur : `garage_id` repart a `null`.
    expect(canRequestAgain(candidate({ status: 'cancelled', garageId: null }))).toBe(false);
    expect(canRequestAgain(candidate({ status: 'closed', garageId: null }))).toBe(false);
  });

  it('ne laisse passer que les deux etats terminaux', () => {
    const accepted = REQUEST_STATUSES.filter((status) =>
      canRequestAgain(candidate({ status })),
    );

    expect(accepted).toEqual(['closed', 'cancelled']);
  });
});

type RequestStatusList = ReadonlyArray<RecallCandidate['status']>;
