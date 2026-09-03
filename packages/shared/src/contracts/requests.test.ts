import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  createRequestBodySchema,
  isTerminal,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUSES,
  requestStatusLabel,
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

describe('mode de service à la création', () => {
  const body = (patch: Record<string, unknown> = {}) => ({
    vehicleType: 'car' as const,
    problemType: 'battery' as const,
    origin: { lat: 3.848, lng: 11.5021 },
    ...patch,
  });

  it('vaut « sur place » par défaut', () => {
    // Le seul comportement qui existait avant la migration 0009 : c'est ce que
    // doit comprendre une version de l'app antérieure à ce champ.
    const parsed = createRequestBodySchema.parse(body());
    expect(parsed.serviceMode).toBe('on_site');
  });

  it('accepte « au garage » sur un véhicule qui roule encore', () => {
    const parsed = createRequestBodySchema.parse(
      body({ serviceMode: 'at_garage', immobilized: false }),
    );
    expect(parsed.serviceMode).toBe('at_garage');
  });

  /**
   * Un véhicule immobilisé ne conduit personne nulle part.
   *
   * Deuxième des trois barrières : le formulaire grise l'option, ce contrat
   * refuse le corps de requête, la contrainte SQL
   * `at_garage_requires_rolling_vehicle` interdit la ligne.
   */
  it('refuse « au garage » sur un véhicule immobilisé', () => {
    const result = createRequestBodySchema.safeParse(
      body({ serviceMode: 'at_garage', immobilized: true }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'serviceMode')).toBe(true);
    }
  });

  it('refuse aussi par défaut, `immobilized` valant `true` sans réponse', () => {
    expect(createRequestBodySchema.safeParse(body({ serviceMode: 'at_garage' })).success).toBe(
      false,
    );
  });
});

describe('libellés d’état selon le mode', () => {
  it('garde les libellés d’origine quand le garagiste se déplace', () => {
    expect(requestStatusLabel('en_route', 'on_site')).toEqual(REQUEST_STATUS_LABELS.en_route);
    expect(requestStatusLabel('accepted', 'on_site')).toEqual(REQUEST_STATUS_LABELS.accepted);
  });

  it('rend la parole au client quand c’est lui qui roule', () => {
    expect(requestStatusLabel('en_route', 'at_garage').fr).not.toBe(
      REQUEST_STATUS_LABELS.en_route.fr,
    );
    expect(requestStatusLabel('accepted', 'at_garage').fr).not.toBe(
      REQUEST_STATUS_LABELS.accepted.fr,
    );
  });

  it('ne dédouble que ce qui change vraiment de sujet', () => {
    // Une demande annulée est annulée dans les deux sens. Recopier les cinq
    // libellés identiques pour en changer deux, c'est se condamner à corriger
    // un mot à deux endroits et à en oublier un.
    for (const status of ['pending', 'selected', 'awaiting_confirmation', 'closed', 'cancelled'] as const) {
      expect(requestStatusLabel(status, 'at_garage')).toEqual(REQUEST_STATUS_LABELS[status]);
    }
  });
});
