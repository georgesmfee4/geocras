import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  isTerminal,
  REQUEST_STATUSES,
  TERMINAL_STATUSES,
} from './requests';

describe('machine à états d’une demande', () => {
  it('suit le parcours nominal jusqu’à la clôture', () => {
    expect(canTransition('pending', 'selected')).toBe(true);
    expect(canTransition('selected', 'accepted')).toBe(true);
    expect(canTransition('accepted', 'en_route')).toBe(true);
    expect(canTransition('en_route', 'awaiting_confirmation')).toBe(true);
    expect(canTransition('awaiting_confirmation', 'closed')).toBe(true);
  });

  it('interdit de sauter la sélection du garage', () => {
    expect(canTransition('pending', 'accepted')).toBe(false);
    expect(canTransition('pending', 'en_route')).toBe(false);
  });

  it('interdit de clôturer sans passer par une confirmation d’arrivée', () => {
    // La contrainte SQL `closed_requires_both_arrivals` verrouille la même
    // règle en base : ici c'est la ceinture, là-bas les bretelles.
    expect(canTransition('en_route', 'closed')).toBe(false);
    expect(canTransition('accepted', 'closed')).toBe(false);
  });

  it('permet d’annuler depuis tout état non terminal', () => {
    for (const status of REQUEST_STATUSES) {
      if (isTerminal(status)) continue;
      expect(canTransition(status, 'cancelled')).toBe(true);
    }
  });

  it('ne laisse sortir d’aucun état terminal', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toHaveLength(0);
      for (const target of REQUEST_STATUSES) {
        expect(canTransition(status, target)).toBe(false);
      }
    }
  });

  it('laisse le garage rendre la demande à la recherche', () => {
    // Le refus. Sans lui, un garage qui ne peut pas intervenir n'avait que
    // l'annulation — c'est-à-dire fermer le SOS de quelqu'un en panne.
    expect(canTransition('selected', 'pending')).toBe(true);
  });

  it('ne revient jamais en arrière, sauf pour ce refus', () => {
    expect(canTransition('accepted', 'selected')).toBe(false);
    expect(canTransition('accepted', 'pending')).toBe(false);
    expect(canTransition('en_route', 'accepted')).toBe(false);
    expect(canTransition('en_route', 'pending')).toBe(false);
    expect(canTransition('awaiting_confirmation', 'en_route')).toBe(false);

    /**
     * Le garde-fou de la règle : `selected` est le **seul** état d'où l'on
     * puisse redescendre. Une fois le garage engagé, la demande ne peut plus
     * lui être retirée par une transition — il reste l'annulation, qui est un
     * fait, pas un retour en arrière.
     */
    const backward = REQUEST_STATUSES.filter((status) =>
      ALLOWED_TRANSITIONS[status].includes('pending'),
    );
    expect(backward).toEqual(['selected']);
  });

  it('déclare terminaux exactement closed et cancelled', () => {
    expect(isTerminal('closed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('en_route')).toBe(false);
    expect(isTerminal('pending')).toBe(false);
  });

  it('décrit une transition pour chaque état connu', () => {
    for (const status of REQUEST_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
    }
  });
});
