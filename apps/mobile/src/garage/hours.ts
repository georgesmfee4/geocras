import type { OpeningHours } from '@geocras/shared';
import { CAMEROON_UTC_OFFSET_MIN } from '../time/clock';

/**
 * Lecture des horaires d'ouverture.
 *
 * Le serveur stocke une semaine sous forme de sept chaînes : `08:00-18:00`,
 * `24h` ou `closed`. Ce module les met en français lisible et dit quel jour on
 * est — rien d'autre. L'état « ouvert maintenant », lui, reste calculé côté
 * serveur (`openNow`) : il dépend de l'heure réelle et de règles que le client
 * n'a pas à rejouer.
 */

/** Ordre d'affichage : la semaine commence le lundi, pas le dimanche. */
export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

/**
 * Jour courant au Cameroun.
 *
 * Calculé sur le fuseau du pays et non sur celui de l'appareil : un téléphone
 * resté sur l'heure d'Europe mettrait en avant les horaires de la veille passé
 * minuit. C'est la même raison qui fait afficher les heures d'envoi d'un SOS en
 * heure locale du Cameroun — voir `src/time/clock.ts`.
 */
export function currentWeekDay(now: number = Date.now()): WeekDay {
  const shifted = new Date(now + CAMEROON_UTC_OFFSET_MIN * 60_000);
  // `getUTCDay()` rend 0 pour dimanche ; notre semaine commence lundi.
  const index = (shifted.getUTCDay() + 6) % 7;
  return WEEK_DAYS[index] as WeekDay;
}

/**
 * Met en forme une plage horaire.
 *
 * `08:00-18:00` devient « 08h – 18h » en français, « 08:00 – 18:00 » en
 * anglais. Les minutes rondes disparaissent : « 08h00 – 18h00 » aligne quatre
 * zéros inutiles dans un tableau de sept lignes, là où la seule information
 * utile est l'heure.
 *
 * Retourne `null` sur `closed` et sur toute valeur non reconnue — l'appelant
 * affiche alors « Fermé » plutôt qu'une chaîne brute venue de la base.
 */
export function formatOpeningRange(
  value: string | undefined,
  locale: 'fr' | 'en' = 'fr',
): string | null {
  if (!value || value === 'closed') return null;
  if (value === '24h') return '24h';

  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, openH, openM, closeH, closeM] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];

  const clock = (hours: string, minutes: string): string =>
    locale === 'fr'
      ? minutes === '00'
        ? `${hours}h`
        : `${hours}h${minutes}`
      : `${hours}:${minutes}`;

  // Tiret demi-cadratin entouré d'espaces fines : c'est la typographie d'une
  // plage, pas d'une soustraction.
  return `${clock(openH, openM)} – ${clock(closeH, closeM)}`;
}

/** Plage du jour, ou `null` si le garage est fermé ou n'a pas publié d'horaires. */
export function todayRange(
  hours: OpeningHours | null,
  locale: 'fr' | 'en' = 'fr',
  now: number = Date.now(),
): string | null {
  if (!hours) return null;
  return formatOpeningRange(hours[currentWeekDay(now)], locale);
}
