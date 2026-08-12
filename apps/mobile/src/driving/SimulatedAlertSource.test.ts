import { describe, expect, it } from 'vitest';
import { SimulatedAlertSource } from './SimulatedAlertSource';
import type { EmittedAlert, SpeedSample } from './AlertSource';

/**
 * Générateur pseudo-aléatoire déterministe.
 * Sans lui, une simulation qui « passe parfois » serait indistinguable d'une
 * simulation correcte.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Fait tourner la simulation sur une durée simulée, sans minuterie réelle. */
function run(durationMs: number, seed = 42) {
  let now = 0;
  const tickMs = 250;

  const source = new SimulatedAlertSource({
    tickMs,
    random: seededRandom(seed),
    now: () => now,
  });

  const alerts: EmittedAlert[] = [];
  const speeds: SpeedSample[] = [];
  source.onAlert((alert) => alerts.push(alert));
  source.onSpeed((sample) => speeds.push(sample));

  source.start();
  for (let elapsed = 0; elapsed < durationMs; elapsed += tickMs) {
    now = elapsed;
    source.tick();
  }

  return { alerts, speeds, source };
}

describe('courbe de vitesse', () => {
  it('ne saute jamais de 40 à 90 km/h en une seconde', () => {
    const { speeds } = run(180_000);

    // Bornée par l'accélération physique : sur un pas de 250 ms, environ
    // 2 km/h en accélération, 3,5 en freinage. On laisse une marge d'arrondi.
    for (let i = 1; i < speeds.length; i += 1) {
      const delta = Math.abs(speeds[i]!.speedKmh - speeds[i - 1]!.speedKmh);
      expect(delta).toBeLessThanOrEqual(5);
    }
  });

  it('ne produit jamais de vitesse négative', () => {
    const { speeds } = run(180_000);
    for (const sample of speeds) expect(sample.speedKmh).toBeGreaterThanOrEqual(0);
  });

  it('reste dans une plage urbaine plausible', () => {
    const { speeds } = run(300_000);
    const max = Math.max(...speeds.map((s) => s.speedKmh));
    expect(max).toBeLessThanOrEqual(70);
    expect(max).toBeGreaterThan(20);
  });

  it('alterne réellement accélérations, croisière et ralentissements', () => {
    const { speeds } = run(300_000);
    const values = speeds.map((s) => s.speedKmh);

    // Une simulation figée sur une vitesse constante serait « stable » mais
    // n'aurait rien à voir avec de la conduite.
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(15);
  });

  it('émet un échantillon de vitesse à chaque pas', () => {
    const { speeds } = run(10_000);
    expect(speeds.length).toBe(40);
    for (const sample of speeds) expect(sample.deltaMs).toBe(250);
  });
});

describe('cohérence des alertes', () => {
  it('produit des alertes sur une session de cinq minutes', () => {
    const { alerts } = run(300_000);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('ne fait jamais se chevaucher deux alertes de moins de 6 secondes', () => {
    const { alerts } = run(600_000);

    for (let i = 1; i < alerts.length; i += 1) {
      const gap = alerts[i]!.occurredAt - alerts[i - 1]!.occurredAt;
      expect(gap).toBeGreaterThanOrEqual(6000);
    }
  });

  it('ne répète pas le même type d’alerte à moins de 20 secondes', () => {
    const { alerts } = run(600_000);
    const lastByType = new Map<string, number>();

    for (const alert of alerts) {
      const previous = lastByType.get(alert.type);
      if (previous !== undefined) {
        expect(alert.occurredAt - previous).toBeGreaterThanOrEqual(20_000);
      }
      lastByType.set(alert.type, alert.occurredAt);
    }
  });

  it('ne déclenche jamais un feu rouge à l’arrêt', () => {
    const { alerts } = run(600_000);
    const redLights = alerts.filter((alert) => alert.type === 'red_light');

    // Un feu rouge apparaît quand on RALENTIT, pas quand on est déjà immobile.
    for (const alert of redLights) expect(alert.atSpeedKmh).toBeGreaterThan(10);
  });

  it('ne signale un angle mort qu’à vitesse établie', () => {
    const { alerts } = run(600_000);
    const blindSpots = alerts.filter((alert) => alert.type.startsWith('blind_spot'));

    for (const alert of blindSpots) expect(alert.atSpeedKmh).toBeGreaterThan(25);
  });

  it('donne une distance aux alertes qui en ont une, et pas aux autres', () => {
    const { alerts } = run(600_000);

    for (const alert of alerts) {
      if (alert.type === 'red_light' || alert.type === 'obstacle') {
        expect(alert.distanceM).toBeGreaterThan(0);
      } else {
        // Un angle mort est à côté de vous : lui inventer une distance en
        // mètres n'aurait pas de sens.
        expect(alert.distanceM).toBeNull();
      }
    }
  });

  it('reste reproductible à graine identique', () => {
    const first = run(300_000, 7).alerts.map((a) => `${a.type}@${a.occurredAt}`);
    const second = run(300_000, 7).alerts.map((a) => `${a.type}@${a.occurredAt}`);
    expect(first).toEqual(second);
  });
});

describe('cycle de vie', () => {
  it('remet la vitesse à zéro à l’arrêt', () => {
    const { source } = run(60_000);
    source.stop();
    expect(source.currentSpeedKmh).toBe(0);
    expect(source.currentPhase).toBe('stopped');
  });

  it('n’émet plus rien après stop', () => {
    let now = 0;
    const source = new SimulatedAlertSource({
      tickMs: 250,
      random: seededRandom(3),
      now: () => now,
    });

    const received: SpeedSample[] = [];
    source.onSpeed((sample) => received.push(sample));

    source.start();
    for (let i = 0; i < 40; i += 1) {
      now += 250;
      source.tick();
    }
    const countBeforeStop = received.length;

    source.stop();
    expect(received.length).toBe(countBeforeStop);
  });

  it('permet de se désabonner', () => {
    const source = new SimulatedAlertSource({ random: seededRandom(1), now: () => 0 });
    const received: SpeedSample[] = [];
    const unsubscribe = source.onSpeed((sample) => received.push(sample));

    source.tick();
    const afterFirst = received.length;

    unsubscribe();
    source.tick();

    expect(received.length).toBe(afterFirst);
  });
});
