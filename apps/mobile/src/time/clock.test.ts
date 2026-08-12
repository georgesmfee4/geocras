import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clockSkewMs,
  elapsedSecondsSince,
  formatElapsed,
  formatClockTime,
  formatRelativeAge,
  noteServerDate,
  serverNow,
} from './clock';

afterEach(() => {
  vi.useRealTimers();
  // L'écart est un état de module : sans cette remise à zéro, un test qui
  // règle une dérive la laisse aux suivants.
  noteServerDate(new Date().toUTCString());
});

describe('décalage d’horloge', () => {
  it('mesure l’écart entre le serveur et un appareil qui retarde', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T00:10:00.000Z'));

    // Le serveur, lui, est à 00:13 : l'appareil retarde de trois minutes.
    noteServerDate('Sun, 09 Aug 2026 00:13:00 GMT');

    expect(clockSkewMs()).toBe(3 * 60_000);
    expect(serverNow()).toBe(Date.parse('2026-08-09T00:13:00.000Z'));
  });

  it('ignore un en-tête absent ou illisible plutôt que de fausser l’horloge', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T00:10:00.000Z'));
    noteServerDate('Sun, 09 Aug 2026 00:13:00 GMT');

    noteServerDate(null);
    noteServerDate('pas une date');

    expect(clockSkewMs()).toBe(3 * 60_000);
  });
});

describe('temps écoulé', () => {
  it('part de zéro sur une demande que le serveur vient d’enregistrer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T00:10:00.000Z'));
    // Appareil trois minutes en retard : sans correction, le compteur
    // afficherait -180 s ou, borné, resterait bloqué à zéro pendant trois
    // minutes.
    noteServerDate('Sun, 09 Aug 2026 00:13:00 GMT');

    expect(elapsedSecondsSince('2026-08-09T00:13:00.000Z')).toBe(0);
  });

  it('ne descend jamais sous zéro', () => {
    expect(elapsedSecondsSince(new Date(Date.now() + 5_000).toISOString())).toBe(0);
  });

  it('rend null sur un horodatage illisible', () => {
    expect(elapsedSecondsSince('bientôt')).toBeNull();
  });

  it('compte les secondes réellement écoulées', () => {
    const now = Date.parse('2026-08-09T01:00:00.000Z');
    expect(elapsedSecondsSince('2026-08-09T00:58:17.000Z', now)).toBe(103);
  });
});

describe('mise en forme', () => {
  it('écrit les minutes et les secondes, puis les heures au-delà', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(7)).toBe('00:07');
    expect(formatElapsed(252)).toBe('04:12');
    expect(formatElapsed(3599)).toBe('59:59');
    expect(formatElapsed(3852)).toBe('1:04:12');
  });

  it('rend l’heure du Cameroun quel que soit le fuseau de l’appareil', () => {
    // 00:13 UTC, c'est 01:13 à Yaoundé — et il doit s'afficher 01:13 même sur
    // un téléphone réglé sur UTC, sur lequel `getHours()` dirait 00.
    expect(formatClockTime('2026-08-09T00:13:00.000Z')).toBe('01h13');
    // Passage de minuit : 23:30 UTC est déjà le lendemain 00:30 au Cameroun.
    expect(formatClockTime('2026-08-08T23:30:00.000Z')).toBe('00h30');
    // L'anglais garde les deux-points.
    expect(formatClockTime('2026-08-09T00:13:00.000Z', 'en')).toBe('01:13');
  });

  it('rend un tiret plutôt qu’une heure inventée sur une date illisible', () => {
    expect(formatClockTime('')).toBe('—');
  });
});

describe('ancienneté', () => {
  const now = Date.parse('2026-08-09T12:00:00.000Z');
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  it('reste vague, et de plus en plus en remontant le temps', () => {
    expect(formatRelativeAge(ago(20), 'fr', now)).toBe('à l’instant');
    expect(formatRelativeAge(ago(300), 'fr', now)).toBe('il y a 5 min');
    expect(formatRelativeAge(ago(7200), 'fr', now)).toBe('il y a 2 h');
    expect(formatRelativeAge(ago(2 * 86_400), 'fr', now)).toBe('il y a 2 j');
    expect(formatRelativeAge(ago(3 * 604_800), 'fr', now)).toBe('il y a 3 sem');
    expect(formatRelativeAge(ago(5 * 2_592_000), 'fr', now)).toBe('il y a 5 mois');
    expect(formatRelativeAge(ago(2 * 31_536_000), 'fr', now)).toBe('il y a 2 ans');
  });

  it('bascule en anglais sans laisser de français traîner', () => {
    expect(formatRelativeAge(ago(20), 'en', now)).toBe('just now');
    expect(formatRelativeAge(ago(2 * 86_400), 'en', now)).toBe('2d ago');
  });

  it('ne rend jamais une durée négative sur un horodatage à venir', () => {
    expect(formatRelativeAge(ago(-90), 'fr', now)).toBe('à l’instant');
  });
});
