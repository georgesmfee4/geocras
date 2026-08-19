import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@geocras/shared';
import { latestEventType } from './tracking';

function event(seq: number, type: RequestEvent['type']): RequestEvent {
  return {
    seq,
    type,
    actorUserId: null,
    actorRole: null,
    payload: null,
    createdAt: '2026-08-19T10:00:00.000Z',
  };
}

describe('latestEventType', () => {
  it('ne conclut rien d’un lot absent ou vide', () => {
    expect(latestEventType(undefined)).toBeNull();
    expect(latestEventType([])).toBeNull();
  });

  it('retient le dernier fait d’un historique rejoué', () => {
    // Ce que le serveur envoie à la reconnexion : tout, dans l'ordre.
    const replay = [
      event(1, 'created'),
      event(2, 'garage_selected'),
      event(3, 'declined'),
    ];

    expect(latestEventType(replay)).toBe('declined');
  });

  it('retient l’événement déclencheur d’une transition isolée', () => {
    // Ce que le serveur envoie sur un changement d'état : celui-là seul.
    expect(latestEventType([event(4, 'accepted')])).toBe('accepted');
  });

  it('se fie à `seq` et non à l’ordre du tableau', () => {
    // Un lot recomposé après une coupure peut arriver dans le désordre : lire
    // le dernier élément ferait conclure à un refus sur une demande reprise.
    const outOfOrder = [event(3, 'declined'), event(4, 'garage_selected')];

    expect(latestEventType(outOfOrder)).toBe('garage_selected');
  });

  it('distingue une demande reprise après refus d’une demande refusée', () => {
    const declined = [event(1, 'created'), event(2, 'garage_selected'), event(3, 'declined')];
    const reselected = [...declined, event(4, 'garage_selected')];

    expect(latestEventType(declined)).toBe('declined');
    expect(latestEventType(reselected)).toBe('garage_selected');
  });
});
