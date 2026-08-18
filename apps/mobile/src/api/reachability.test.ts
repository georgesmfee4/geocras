import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  circuitIsOpen,
  forceProbe,
  msUntilProbe,
  noteReachable,
  noteUnreachable,
  resetReachability,
} from './reachability';

beforeEach(() => {
  resetReachability();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('coupe-circuit réseau', () => {
  it('laisse passer tant que rien n’a échoué', () => {
    expect(circuitIsOpen()).toBe(false);
  });

  /**
   * Le cœur du correctif. Avant, chaque écran repayait la découverte : quatre
   * tentatives à vingt secondes, pour lui tout seul. Ici le premier échec suffit
   * à renseigner tous les suivants, qui échouent sans ouvrir de socket.
   */
  it('ferme la porte dès le premier échec, pour tout le monde', () => {
    noteUnreachable();
    expect(circuitIsOpen()).toBe(true);
    expect(circuitIsOpen()).toBe(true);
  });

  it('laisse passer une sonde, et une seule, après le refroidissement', () => {
    noteUnreachable();
    vi.advanceTimersByTime(5_000);

    // La première demande devient la sonde…
    expect(circuitIsOpen()).toBe(false);
    // …et les suivantes continuent d'échouer vite tant qu'elle n'a pas répondu.
    expect(circuitIsOpen()).toBe(true);
  });

  it('allonge le refroidissement à chaque échec, puis le plafonne', () => {
    noteUnreachable();
    expect(msUntilProbe()).toBe(5_000);

    vi.advanceTimersByTime(5_000);
    circuitIsOpen();
    noteUnreachable();
    expect(msUntilProbe()).toBe(15_000);

    vi.advanceTimersByTime(15_000);
    circuitIsOpen();
    noteUnreachable();
    expect(msUntilProbe()).toBe(30_000);

    vi.advanceTimersByTime(30_000);
    circuitIsOpen();
    noteUnreachable();
    // Plafond : on ne condamne jamais l'application pour plus de trente secondes.
    expect(msUntilProbe()).toBe(30_000);
  });

  it('rouvre tout dès qu’une requête aboutit', () => {
    noteUnreachable();
    noteReachable();

    expect(circuitIsOpen()).toBe(false);
    expect(msUntilProbe()).toBe(0);
  });

  it('rend la main à l’utilisateur avant la fin du refroidissement', () => {
    noteUnreachable();
    expect(circuitIsOpen()).toBe(true);

    // « Réessayer » : il sait souvent avant nous que le réseau est revenu.
    forceProbe();
    expect(circuitIsOpen()).toBe(false);
  });
});
