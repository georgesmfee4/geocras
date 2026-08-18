import { describe, expect, it } from 'vitest';
import { gateDepth, throughGate } from './gate';

/** Promesse dont on décide du dénouement depuis le test. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('limiteur de requêtes simultanées', () => {
  it('n’en laisse passer que quatre à la fois et met les autres en file', async () => {
    const gates = Array.from({ length: 6 }, () => deferred());
    const runs = gates.map((gate) => throughGate(() => gate.promise));

    // Le temps que les micro-tâches s'installent.
    await Promise.resolve();

    expect(gateDepth()).toEqual({ inFlight: 4, waiting: 2 });

    // Une place se libère : la file avance d'un cran, pas de deux.
    gates[0]!.resolve();
    await runs[0];
    await Promise.resolve();

    expect(gateDepth().waiting).toBe(1);

    for (const gate of gates) gate.resolve();
    await Promise.all(runs);

    expect(gateDepth()).toEqual({ inFlight: 0, waiting: 0 });
  });

  /**
   * Le défaut qui n'apparaît qu'après plusieurs minutes d'usage : un créneau
   * jamais rendu réduit la capacité pour de bon, et quatre erreurs figent
   * l'application entière. C'est exactement le genre de panne qu'un test manuel
   * ne trouve pas.
   */
  it('rend le créneau même quand la requête échoue', async () => {
    await expect(
      throughGate(() => Promise.reject(new Error('réseau'))),
    ).rejects.toThrow('réseau');

    expect(gateDepth()).toEqual({ inFlight: 0, waiting: 0 });
  });
});
