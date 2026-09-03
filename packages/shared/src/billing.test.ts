import { describe, expect, it } from 'vitest';
import { ANTI_FRAUD } from './loyalty';
import {
  ARRIVAL_PROOF,
  commissionXaf,
  noArrivalProof,
  pathLengthMeters,
  proveArrival,
  serviceGeometry,
  TARIFF_CLASSES,
  TARIFF_XAF,
  tariffClassOf,
  type ProofPing,
  type ProveArrivalInput,
} from './billing';

/** Le lieu de la panne, quelque part dans Yaoundé. */
const PANNE = { lat: 3.848, lng: 11.5021 };

/** L'atelier, à environ 4,4 km au nord — de quoi produire un vrai trajet. */
const ATELIER = { lat: 3.8869, lng: 11.5089 };

const DEPART = '2026-08-19T10:00:00.000Z';

function at(minutes: number): string {
  return new Date(Date.parse(DEPART) + minutes * 60_000).toISOString();
}

/** Un point à `meters` au nord de la panne. Un degré de latitude ≈ 110 574 m. */
function northOfPanne(meters: number, minutes: number): ProofPing {
  return { lat: PANNE.lat + meters / 110_574, lng: PANNE.lng, recordedAt: at(minutes) };
}

/** L'approche nominale : on part de l'atelier et on se gare sur la panne. */
function approach(): ProofPing[] {
  return [
    { ...ATELIER, recordedAt: at(0) },
    northOfPanne(2_000, 2),
    northOfPanne(800, 4),
    northOfPanne(200, 6),
    northOfPanne(30, 7),
  ];
}

function prove(overrides: Partial<ProveArrivalInput> = {}) {
  return proveArrival({
    pings: approach(),
    destination: PANNE,
    enRouteAt: DEPART,
    until: at(25),
    ...overrides,
  });
}

describe('pathLengthMeters', () => {
  it('rend zéro en dessous de deux points', () => {
    expect(pathLengthMeters([])).toBe(0);
    expect(pathLengthMeters([PANNE])).toBe(0);
  });

  it('cumule les segments', () => {
    const direct = pathLengthMeters([PANNE, ATELIER]);
    const detour = pathLengthMeters([PANNE, { lat: 3.87, lng: 11.52 }, ATELIER]);

    expect(direct).toBeGreaterThan(4_000);
    expect(detour).toBeGreaterThan(direct);
  });
});

describe('proveArrival — le cas nominal', () => {
  it('établit une preuve facturable sur une approche qui se gare sur la panne', () => {
    const proof = prove();

    expect(proof.level).toBe('trail');
    expect(proof.billable).toBe(true);
    expect(proof.settled).toBe(true);
    // Le point de la minute 6 est à 200 m : hors du rayon de 150. La première
    // entrée réelle est celui de la minute 7.
    expect(proof.arrivedAt).toBe(at(7));
    expect(proof.closestMeters).toBeLessThanOrEqual(40);
    expect(proof.travelledMeters).toBeGreaterThan(ARRIVAL_PROOF.minTravelMeters);
    expect(proof.dwellSeconds).toBe(18 * 60);
  });

  it('hisse la preuve à « mutual » quand les deux parties ont reconnu l’arrivée', () => {
    const proof = prove({ acknowledged: true });

    expect(proof.level).toBe('mutual');
    expect(proof.billable).toBe(true);
  });

  it('ne facture pas davantage pour autant : la reconnaissance n’ouvre aucun droit seule', () => {
    // Même reconnaissance, mais aucune trace : la confirmation ne supplée rien.
    const proof = prove({ pings: [], acknowledged: true });

    expect(proof.level).toBe('none');
    expect(proof.billable).toBe(false);
  });
});

describe('proveArrival — ce qui n’est pas une arrivée', () => {
  it('rejette le passage devant : la trace continue au lieu de s’arrêter', () => {
    const proof = prove({
      pings: [
        { ...ATELIER, recordedAt: at(0) },
        northOfPanne(300, 4),
        // On frôle la panne...
        northOfPanne(40, 6),
        // ...et on continue vers le sud sans s'arrêter.
        { lat: PANNE.lat - 900 / 110_574, lng: PANNE.lng, recordedAt: at(8) },
      ],
    });

    expect(proof.settled).toBe(false);
    expect(proof.level).toBe('none');
    expect(proof.billable).toBe(false);
    // La preuve reste instruite : on sait qu'il est passé tout près.
    expect(proof.closestMeters).toBeLessThanOrEqual(50);
  });

  it('rejette une trace qui n’entre jamais dans le rayon', () => {
    const proof = prove({
      pings: [
        { ...ATELIER, recordedAt: at(0) },
        northOfPanne(600, 5),
        northOfPanne(400, 9),
      ],
    });

    expect(proof.level).toBe('none');
    expect(proof.arrivedAt).toBeNull();
  });

  it('rejette une demande sans départ déclaré', () => {
    // Le serveur refuse la confirmation d'arrivée avant `en_route` : une telle
    // demande n'a jamais pu aller à son terme.
    expect(prove({ enRouteAt: null }).level).toBe('none');
  });

  it('rejette une fin inconnue ou antérieure au départ', () => {
    expect(prove({ until: null }).level).toBe('none');
    expect(prove({ until: at(-5) }).level).toBe('none');
  });

  it('écarte les horodatages illisibles au lieu de les propager', () => {
    const proof = prove({
      pings: [...approach(), { ...PANNE, recordedAt: 'pas une date' }],
    });

    expect(proof.level).toBe('trail');
  });
});

describe('proveArrival — les preuves faibles', () => {
  it('déclasse une intervention trop courte pour être plausible', () => {
    const proof = prove({ until: at(8) });

    expect(proof.settled).toBe(true);
    expect(proof.dwellSeconds).toBeLessThan(ARRIVAL_PROOF.minDwellSeconds);
    expect(proof.level).toBe('weak');
    expect(proof.billable).toBe(false);
  });

  it('déclasse un garage qui n’a pas eu à se déplacer', () => {
    // Panne devant l'atelier : deux points, quelques mètres. Rien n'a été
    // apporté, et l'anti-fraude le dit déjà pour les points de fidélité.
    const proof = prove({
      pings: [northOfPanne(60, 0), northOfPanne(20, 6)],
    });

    expect(proof.settled).toBe(true);
    expect(proof.travelledMeters).toBeLessThan(ARRIVAL_PROOF.minTravelMeters);
    expect(proof.level).toBe('weak');
    expect(proof.billable).toBe(false);
  });
});

describe('proveArrival — la fenêtre de lecture', () => {
  it('ignore le retour du garagiste après la clôture', () => {
    // Le défaut que la fenêtre corrige : app laissée ouverte, retour à
    // l'atelier. Sans bornage, la trace « se terminerait » à l'atelier et le
    // garage consciencieux serait le seul à ne pas être payé.
    const proof = prove({
      pings: [...approach(), { ...ATELIER, recordedAt: at(40) }],
      until: at(25),
    });

    expect(proof.settled).toBe(true);
    expect(proof.level).toBe('trail');
  });

  it('ignore les points antérieurs au départ déclaré', () => {
    const proof = prove({
      pings: [{ ...PANNE, recordedAt: at(-30) }, ...approach()],
    });

    // Le point de la minute 6 est à 200 m : hors du rayon de 150. La première
    // entrée réelle est celui de la minute 7.
    expect(proof.arrivedAt).toBe(at(7));
  });

  it('remet la trace en ordre plutôt que de se fier à celui reçu', () => {
    const shuffled = [...approach()].reverse();
    const proof = prove({ pings: shuffled });

    expect(proof.level).toBe('trail');
    // Le point de la minute 6 est à 200 m : hors du rayon de 150. La première
    // entrée réelle est celui de la minute 7.
    expect(proof.arrivedAt).toBe(at(7));
    expect(proof.settled).toBe(true);
  });
});

describe('les seuils', () => {
  it('reprend la distance de déplacement de l’anti-fraude, sans la redéclarer', () => {
    expect(ARRIVAL_PROOF.minTravelMeters).toBe(ANTI_FRAUD.minGarageTravelMeters);
  });

  it('exige une présence plus longue que la durée minimale d’intervention', () => {
    expect(ARRIVAL_PROOF.minDwellSeconds).toBeGreaterThan(ANTI_FRAUD.minInterventionSeconds);
  });

  it('ouvre un rayon plus large que l’erreur GPS urbaine', () => {
    expect(ARRIVAL_PROOF.radiusMeters).toBeGreaterThanOrEqual(100);
  });
});

describe('le barème', () => {
  it('classe en lourd un véhicule qui ne roule plus', () => {
    expect(tariffClassOf('battery', true)).toBe('heavy');
    expect(tariffClassOf('gearbox', true)).toBe('heavy');
  });

  it('classe en léger un véhicule qui roule encore', () => {
    expect(tariffClassOf('battery', false)).toBe('light');
    expect(tariffClassOf('lighting', false)).toBe('light');
  });

  it('classe un accident en lourd quoi que réponde le client', () => {
    // Le seul cas ou la declaration du client ne change rien a la nature de
    // l'intervention.
    expect(tariffClassOf('accident', false)).toBe('heavy');
    expect(tariffClassOf('accident', true)).toBe('heavy');
  });

  it('applique le tarif plein sur un premier client apporté', () => {
    expect(commissionXaf({ tariffClass: 'light', repeatPair: false })).toBe(TARIFF_XAF.light);
    expect(commissionXaf({ tariffClass: 'heavy', repeatPair: false })).toBe(TARIFF_XAF.heavy);
  });

  it('applique la moitié quand le client était déjà venu chez ce garage', () => {
    expect(commissionXaf({ tariffClass: 'light', repeatPair: true })).toBe(250);
    expect(commissionXaf({ tariffClass: 'heavy', repeatPair: true })).toBe(750);
  });

  it('arrondit à la centaine inférieure', () => {
    // Cinquante francs est la plus petite piece dont on se sert couramment.
    // Un arrondi a la centaine aurait ramene 250 a 200 : soixante pour cent de
    // remise au lieu de cinquante.
    expect(commissionXaf({ tariffClass: 'heavy', repeatPair: true }) % 50).toBe(0);
    expect(commissionXaf({ tariffClass: 'light', repeatPair: true }) % 50).toBe(0);
  });

  it('ne rend jamais un montant négatif ni un tarif au-dessus du plein', () => {
    for (const tariffClass of TARIFF_CLASSES) {
      for (const repeatPair of [true, false]) {
        const due = commissionXaf({ tariffClass, repeatPair });
        expect(due).toBeGreaterThanOrEqual(0);
        expect(due).toBeLessThanOrEqual(TARIFF_XAF[tariffClass]);
      }
    }
  });

  it('rend le dépannage lourd strictement plus cher que le léger', () => {
    expect(TARIFF_XAF.heavy).toBeGreaterThan(TARIFF_XAF.light);
  });
});

/* ------------------------------------------------------------------------ *
 * Le second sens : le client va au garage
 * ------------------------------------------------------------------------ */

describe('serviceGeometry', () => {
  it('fait voyager le garage vers la panne en dépannage sur place', () => {
    const geometry = serviceGeometry('on_site', {
      origin: PANNE,
      garageLocation: ATELIER,
    });

    expect(geometry).toEqual({ traveller: 'garage', destination: PANNE });
  });

  it('fait voyager le client vers l’atelier dans l’autre sens', () => {
    const geometry = serviceGeometry('at_garage', {
      origin: PANNE,
      garageLocation: ATELIER,
    });

    expect(geometry).toEqual({ traveller: 'client', destination: ATELIER });
  });

  it('n’invente pas de destination quand aucun garage n’est retenu', () => {
    // Rendre le lieu de la panne par défaut aurait mesuré le trajet du client
    // vers l'endroit d'où il part : une preuve toujours vide, sur une
    // intervention qui pouvait être réelle.
    expect(serviceGeometry('at_garage', { origin: PANNE, garageLocation: null })).toBeNull();
  });

  it('garde une destination en sur place même sans garage retenu', () => {
    // Le lieu de la panne est porté par la demande depuis sa création : il ne
    // dépend d'aucun garage.
    expect(serviceGeometry('on_site', { origin: PANNE, garageLocation: null })).toEqual({
      traveller: 'garage',
      destination: PANNE,
    });
  });
});

describe('proveArrival — quand c’est le client qui se déplace', () => {
  /** L'approche du client : il part de sa panne et se gare à l'atelier. */
  function driveToGarage(): ProofPing[] {
    return [
      { ...PANNE, recordedAt: at(0) },
      { lat: 3.86, lng: 11.505, recordedAt: at(3) },
      { lat: 3.878, lng: 11.508, recordedAt: at(6) },
      { lat: ATELIER.lat - 0.0002, lng: ATELIER.lng, recordedAt: at(8) },
    ];
  }

  it('établit une preuve facturable sur un trajet qui se gare à l’atelier', () => {
    const proof = proveArrival({
      pings: driveToGarage(),
      destination: ATELIER,
      enRouteAt: DEPART,
      until: at(30),
      acknowledged: true,
    });

    expect(proof.level).toBe('mutual');
    expect(proof.billable).toBe(true);
    expect(proof.settled).toBe(true);
    expect(proof.travelledMeters).toBeGreaterThan(ARRIVAL_PROOF.minTravelMeters);
  });

  /**
   * Le test qui justifie l'existence de tout le dispositif.
   *
   * Avant la migration 0009, la preuve lisait **toujours** la trace du garage
   * mesurée vers le lieu de la panne. Sur une intervention où le garagiste ne
   * bouge pas, cette lecture rend `none` : un client réellement venu à
   * l'atelier n'aurait jamais été facturable, et le registre l'aurait compté
   * comme un dépannage qui n'a pas eu lieu.
   */
  it('rendrait une preuve vide si on lisait la trace de l’ancien voyageur', () => {
    const garageResteChezLui: ProofPing[] = [{ ...ATELIER, recordedAt: at(2) }];

    const lecture = proveArrival({
      pings: garageResteChezLui,
      destination: PANNE,
      enRouteAt: DEPART,
      until: at(30),
      acknowledged: true,
    });

    expect(lecture.level).toBe('none');
    expect(lecture.billable).toBe(false);
  });

  it('applique au client exactement les mêmes seuils qu’au garagiste', () => {
    // Un client qui habite en face de l'atelier n'a pas davantage été
    // « apporté » qu'un garagiste qui traverse la rue.
    const deuxPas: ProofPing[] = [
      { lat: ATELIER.lat + 0.0004, lng: ATELIER.lng, recordedAt: at(0) },
      { ...ATELIER, recordedAt: at(1) },
    ];

    const proof = proveArrival({
      pings: deuxPas,
      destination: ATELIER,
      enRouteAt: DEPART,
      until: at(30),
      acknowledged: true,
    });

    expect(proof.settled).toBe(true);
    expect(proof.travelledMeters).toBeLessThan(ARRIVAL_PROOF.minTravelMeters);
    expect(proof.level).toBe('weak');
    expect(proof.billable).toBe(false);
  });
});

describe('noArrivalProof', () => {
  it('n’affirme rien du tout', () => {
    const proof = noArrivalProof();

    expect(proof.level).toBe('none');
    expect(proof.billable).toBe(false);
    expect(proof.arrivedAt).toBeNull();
    expect(proof.settled).toBe(false);
  });
});
