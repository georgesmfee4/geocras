import { describe, expect, it } from 'vitest';
import {
  compareIncomingJobs,
  nextJobAction,
  PRIVACY_UNTIL_ACCEPTED,
  snapToPrivacyGrid,
  type Job,
} from './jobs';

/** Demande minimale : chaque test ne renseigne que ce qu'il éprouve. */
function job(patch: Partial<Job>): Job {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    status: 'selected',
    problemType: 'battery',
    vehicleType: 'car',
    vehicleLabel: null,
    description: '',
    urgency: 'blocking',
    immobilized: true,
    vulnerablePassengers: false,
    photos: [],
    origin: { lat: 2.9285, lng: 11.165 },
    originPrecise: false,
    distanceM: 800,
    etaMin: 3,
    serviceMode: 'on_site',
    createdAt: '2026-08-12T02:00:00.000Z',
    selectedAt: '2026-08-12T02:10:00.000Z',
    acceptedAt: null,
    enRouteAt: null,
    garageArrivedAt: null,
    clientArrivedAt: null,
    client: {
      fullName: 'Georges Mfee',
      initials: 'GM',
      phone: null,
      avatarUrl: null,
      vehicleLabel: null,
      plate: null,
    },
    lastSeq: 1,
    ...patch,
  };
}

describe('action suivante du garagiste', () => {
  it('propose une seule action par état du parcours nominal', () => {
    expect(nextJobAction(job({ status: 'selected' }))).toBe('accept');
    expect(nextJobAction(job({ status: 'accepted' }))).toBe('en_route');
    expect(nextJobAction(job({ status: 'en_route' }))).toBe('confirm_arrival');
  });

  it('laisse confirmer tant que le garage ne l’a pas fait', () => {
    // Le client a confirmé le premier : la demande attend le garage.
    expect(
      nextJobAction(job({ status: 'awaiting_confirmation', garageArrivedAt: null })),
    ).toBe('confirm_arrival');
  });

  it('ne repropose pas une confirmation déjà enregistrée', () => {
    /**
     * Le cas qui compte : la route est idempotente, un second appui ne
     * changerait rien en base. Mais reproposer le bouton ferait croire au
     * garagiste que sa confirmation n'est pas passée, et l'inviterait à
     * attendre au lieu de partir sur la demande suivante.
     */
    expect(
      nextJobAction(
        job({ status: 'awaiting_confirmation', garageArrivedAt: '2026-08-12T02:40:00.000Z' }),
      ),
    ).toBeNull();
  });

  it('n’offre rien sur une demande terminée ou pas encore adressée', () => {
    expect(nextJobAction(job({ status: 'closed' }))).toBeNull();
    expect(nextJobAction(job({ status: 'cancelled' }))).toBeNull();
    // `pending` : aucun garage n'a encore été retenu, personne n'a la main.
    expect(nextJobAction(job({ status: 'pending' }))).toBeNull();
  });
});

describe('ordre des demandes reçues', () => {
  it('fait passer le danger devant, quelle que soit l’heure', () => {
    const danger = job({ urgency: 'danger', selectedAt: '2026-08-12T02:30:00.000Z' });
    const older = job({ urgency: 'blocking', selectedAt: '2026-08-12T02:00:00.000Z' });

    expect([older, danger].sort(compareIncomingJobs)[0]).toBe(danger);
  });

  it('départage deux urgences égales par la plus ancienne', () => {
    const first = job({ id: 'a', selectedAt: '2026-08-12T02:00:00.000Z' });
    const second = job({ id: 'b', selectedAt: '2026-08-12T02:20:00.000Z' });

    expect([second, first].sort(compareIncomingJobs).map((j) => j.id)).toEqual(['a', 'b']);
  });

  it('retombe sur la date de création quand le choix du garage est inconnu', () => {
    // Demandes antérieures à la migration 0004 : `selectedAt` y est nul.
    const legacy = job({ id: 'a', selectedAt: null, createdAt: '2026-08-12T01:00:00.000Z' });
    const recent = job({ id: 'b', selectedAt: '2026-08-12T02:00:00.000Z' });

    expect([recent, legacy].sort(compareIncomingJobs).map((j) => j.id)).toEqual(['a', 'b']);
  });
});

describe('maille de confidentialité', () => {
  it('arrondit sans laisser de traînée de décimales', () => {
    // 2.9285 / 0.005 tombe pile entre deux mailles : le calcul naïf rend
    // 2.9300000000000002, qui affiche une précision au dix-milliardième de
    // degré sur un point volontairement flouté.
    expect(snapToPrivacyGrid(2.9285)).toBe(2.93);
    expect(snapToPrivacyGrid(11.1651)).toBe(11.165);
  });

  it('ne déplace jamais le point de plus d’une demi-maille', () => {
    const half = PRIVACY_UNTIL_ACCEPTED.originGridDegrees / 2;

    for (const value of [2.9, 2.9012, 2.9349, 11.1608, 3.8481]) {
      expect(Math.abs(snapToPrivacyGrid(value) - value)).toBeLessThanOrEqual(half + 1e-9);
    }
  });

  it('rend le même point pour deux positions de la même maille', () => {
    // C'est la propriété qui protège : deux relevés à cent mètres l'un de
    // l'autre ne doivent pas permettre de trianguler la position exacte en
    // observant le point bouger.
    expect(snapToPrivacyGrid(2.9281)).toBe(snapToPrivacyGrid(2.9284));
  });
});

describe('action suivante — quand le client vient à l’atelier', () => {
  const atGarage = (patch: Partial<Job>) => job({ serviceMode: 'at_garage', ...patch });

  it('accepte comme dans l’autre sens', () => {
    expect(nextJobAction(atGarage({ status: 'selected' }))).toBe('accept');
  });

  /**
   * Le cœur du partage.
   *
   * `en_route` appartient à celui qui se déplace. Proposer « Je pars » à un
   * garagiste qui ne bouge pas produirait deux dégâts : un bouton que le
   * serveur refuse (`declareEnRoute` n'accepte que le voyageur du mode), et
   * surtout un `en_route_at` posé par la mauvaise partie — c'est-à-dire la
   * fenêtre de lecture de la trace du client ouverte par quelqu'un d'autre,
   * au mauvais moment.
   */
  it('ne propose aucun départ au garagiste : ce n’est pas lui qui roule', () => {
    expect(nextJobAction(atGarage({ status: 'accepted' }))).toBeNull();
    expect(nextJobAction(job({ status: 'accepted' }))).toBe('en_route');
  });

  it('rouvre la confirmation dès que le client a pris la route', () => {
    expect(nextJobAction(atGarage({ status: 'en_route' }))).toBe('confirm_arrival');
  });

  it('ne repropose pas une confirmation déjà enregistrée', () => {
    expect(
      nextJobAction(
        atGarage({ status: 'awaiting_confirmation', garageArrivedAt: '2026-08-12T03:00:00.000Z' }),
      ),
    ).toBeNull();
  });
});
