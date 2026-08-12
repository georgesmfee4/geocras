import { describe, expect, it } from 'vitest';
import { currentWeekDay, formatOpeningRange, todayRange } from './hours';

describe('jour courant', () => {
  it('commence la semaine le lundi', () => {
    // Lundi 10 août 2026, midi UTC.
    expect(currentWeekDay(Date.parse('2026-08-10T12:00:00.000Z'))).toBe('mon');
    // Dimanche, le dernier de la liste et non le premier.
    expect(currentWeekDay(Date.parse('2026-08-09T12:00:00.000Z'))).toBe('sun');
  });

  it('bascule à minuit heure du Cameroun, pas à minuit UTC', () => {
    // 23h30 UTC un dimanche, c'est déjà lundi 00h30 à Yaoundé.
    expect(currentWeekDay(Date.parse('2026-08-09T23:30:00.000Z'))).toBe('mon');
  });
});

describe('plage horaire', () => {
  it('efface les minutes rondes en français', () => {
    expect(formatOpeningRange('08:00-18:00')).toBe('08h – 18h');
    expect(formatOpeningRange('08:30-18:45')).toBe('08h30 – 18h45');
  });

  it('garde les deux-points en anglais', () => {
    expect(formatOpeningRange('08:00-18:00', 'en')).toBe('08:00 – 18:00');
  });

  it('laisse « 24h » tel quel', () => {
    expect(formatOpeningRange('24h')).toBe('24h');
  });

  it('rend null sur une fermeture, une absence ou une valeur illisible', () => {
    expect(formatOpeningRange('closed')).toBeNull();
    expect(formatOpeningRange(undefined)).toBeNull();
    // Une valeur inattendue en base ne doit pas se retrouver à l'écran.
    expect(formatOpeningRange('de 8h à 18h')).toBeNull();
  });
});

describe('horaires du jour', () => {
  const week = {
    mon: '08:00-18:00',
    tue: '08:00-18:00',
    wed: '08:00-18:00',
    thu: '08:00-18:00',
    fri: '08:00-18:00',
    sat: '09:00-13:00',
    sun: 'closed',
  } as const;

  it('lit la ligne du jour', () => {
    expect(todayRange(week, 'fr', Date.parse('2026-08-15T09:00:00.000Z'))).toBe('09h – 13h');
  });

  it('rend null le jour de fermeture comme sans horaires publiés', () => {
    expect(todayRange(week, 'fr', Date.parse('2026-08-16T09:00:00.000Z'))).toBeNull();
    expect(todayRange(null)).toBeNull();
  });
});
