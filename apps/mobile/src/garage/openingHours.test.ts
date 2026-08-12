import { describe, expect, it } from 'vitest';
import type { OpeningHours } from '@geocras/shared';
import {
  areHoursValid,
  copyToWeekdays,
  copyToWholeWeek,
  dayMode,
  dayRange,
  isValidTime,
  setDayMode,
  setDayTime,
} from './openingHours';

const WEEK: OpeningHours = {
  mon: '08:00-18:00',
  tue: '08:00-18:00',
  wed: '08:00-18:00',
  thu: '08:00-18:00',
  fri: '08:00-18:00',
  sat: '08:00-14:00',
  sun: 'closed',
};

describe('dayMode', () => {
  it('lit les trois états', () => {
    expect(dayMode('closed')).toBe('closed');
    expect(dayMode('24h')).toBe('24h');
    expect(dayMode('08:00-18:00')).toBe('range');
  });

  it('traite un jour absent comme fermé', () => {
    expect(dayMode(undefined)).toBe('closed');
  });
});

describe('dayRange', () => {
  it('sépare les deux bornes', () => {
    expect(dayRange('06:30-21:45')).toEqual({ open: '06:30', close: '21:45' });
  });

  it('propose une plage de départ quand il n’y en a pas', () => {
    expect(dayRange('closed')).toEqual({ open: '08:00', close: '18:00' });
    expect(dayRange(undefined)).toEqual({ open: '08:00', close: '18:00' });
  });
});

describe('setDayMode', () => {
  it('ferme et ouvre 24 h sans toucher au reste de la semaine', () => {
    const closed = setDayMode(WEEK, 'mon', 'closed');
    expect(closed.mon).toBe('closed');
    expect(closed.tue).toBe('08:00-18:00');

    expect(setDayMode(WEEK, 'sun', '24h').sun).toBe('24h');
  });

  it('rouvre sur la plage par défaut quand il n’y en avait aucune', () => {
    expect(setDayMode(WEEK, 'sun', 'range').sun).toBe('08:00-18:00');
  });

  it('garde la plage existante quand elle en est déjà une', () => {
    expect(setDayMode(WEEK, 'sat', 'range').sat).toBe('08:00-14:00');
  });
});

describe('setDayTime', () => {
  it('déplace une borne en gardant l’autre', () => {
    expect(setDayTime(WEEK, 'mon', 'open', '07:30').mon).toBe('07:30-18:00');
    expect(setDayTime(WEEK, 'mon', 'close', '20:00').mon).toBe('08:00-20:00');
  });

  it('part de la plage par défaut sur un jour fermé', () => {
    expect(setDayTime(WEEK, 'sun', 'open', '09:00').sun).toBe('09:00-18:00');
  });
});

describe('copie', () => {
  it('recopie le lundi sur les sept jours', () => {
    const next = copyToWholeWeek(WEEK);
    expect(Object.values(next).every((value) => value === '08:00-18:00')).toBe(true);
  });

  it('recopie le lundi sans écraser le week-end', () => {
    const next = copyToWeekdays(WEEK);
    expect(next.fri).toBe('08:00-18:00');
    expect(next.sat).toBe('08:00-14:00');
    expect(next.sun).toBe('closed');
  });
});

describe('validation', () => {
  it('accepte une heure plausible et refuse le reste', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('08:60')).toBe(false);
    expect(isValidTime('8:00')).toBe(false);
  });

  it('valide une semaine complète', () => {
    expect(areHoursValid(WEEK)).toBe(true);
    // Une plage qui franchit minuit reste valide : le serveur la sait lire.
    expect(areHoursValid({ ...WEEK, sat: '20:00-02:00' })).toBe(true);
    expect(areHoursValid({ ...WEEK, sat: '20:00-' })).toBe(false);
  });
});
