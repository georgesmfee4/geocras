import { describe, expect, it } from 'vitest';
import {
  isProblemValidForVehicle,
  PROBLEM_LABELS,
  PROBLEM_TYPES,
  PROBLEMS_BY_VEHICLE,
  problemsForVehicle,
  requiresTowing,
  servicesForProblem,
  SERVICES,
  VEHICLE_TYPES,
} from './taxonomy';

describe('taxonomie des pannes', () => {
  it('couvre les trois véhicules du cahier des charges', () => {
    expect(VEHICLE_TYPES).toEqual(['car', 'moto', 'truck']);
  });

  it('reproduit l’ordre du cahier des charges pour la voiture', () => {
    expect(problemsForVehicle('car').slice(0, 4)).toEqual([
      'battery',
      'flat_tyre',
      'overheating',
      'out_of_fuel',
    ]);
  });

  it('termine chaque liste par « Autre »', () => {
    for (const vehicle of VEHICLE_TYPES) {
      const problems = problemsForVehicle(vehicle);
      expect(problems.at(-1)).toBe('other');
    }
  });

  it('propose des pannes spécifiques à la moto, absentes de la voiture', () => {
    expect(problemsForVehicle('moto')).toContain('chain_transmission');
    expect(problemsForVehicle('moto')).toContain('carburettor');
    expect(problemsForVehicle('car')).not.toContain('chain_transmission');
  });

  it('propose des pannes spécifiques au camion', () => {
    expect(problemsForVehicle('truck')).toContain('air_circuit');
    expect(problemsForVehicle('truck')).toContain('load_securing');
  });

  it('ne contient aucun doublon par véhicule', () => {
    for (const vehicle of VEHICLE_TYPES) {
      const problems = problemsForVehicle(vehicle);
      expect(new Set(problems).size).toBe(problems.length);
    }
  });

  it('valide la paire (véhicule, panne)', () => {
    expect(isProblemValidForVehicle('moto', 'chain_transmission')).toBe(true);
    expect(isProblemValidForVehicle('car', 'chain_transmission')).toBe(false);
  });

  it('libelle chaque panne déclarée, en français et en anglais', () => {
    for (const problem of PROBLEM_TYPES) {
      expect(PROBLEM_LABELS[problem].fr.length).toBeGreaterThan(0);
      expect(PROBLEM_LABELS[problem].en.length).toBeGreaterThan(0);
    }
  });

  it('n’expose aucune panne orpheline : chacune appartient à au moins un véhicule', () => {
    const used = new Set(VEHICLE_TYPES.flatMap((v) => [...PROBLEMS_BY_VEHICLE[v]]));
    for (const problem of PROBLEM_TYPES) {
      expect(used.has(problem)).toBe(true);
    }
  });

  it('associe chaque panne à des services connus', () => {
    for (const problem of PROBLEM_TYPES) {
      const services = servicesForProblem(problem);
      expect(services.length).toBeGreaterThan(0);
      for (const service of services) expect(SERVICES).toContain(service);
    }
  });
});

describe('détection du besoin de remorquage', () => {
  it('impose le remorquage pour un accident', () => {
    expect(requiresTowing('accident', false)).toBe(true);
  });

  it('impose le remorquage dès que le véhicule est immobilisé', () => {
    expect(requiresTowing('flat_tyre', true)).toBe(true);
  });

  it('ne l’impose pas pour un pneu crevé sur un véhicule mobile', () => {
    expect(requiresTowing('flat_tyre', false)).toBe(false);
  });
});
