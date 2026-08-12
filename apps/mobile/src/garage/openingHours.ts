import type { OpeningHours } from '@geocras/shared';
import { WEEK_DAYS, type WeekDay } from './hours';

/**
 * Règles de saisie des horaires.
 *
 * Séparées du composant pour être testables : ce sont elles qui décident ce
 * que le serveur recevra, et une plage mal formée fait disparaître le garage
 * des recherches « ouvert maintenant » sans que personne ne s'en aperçoive.
 *
 * Le format est celui de la base — `08:00-18:00`, `24h` ou `closed`, une
 * chaîne par jour. Le composant ne manipule jamais ces chaînes à la main.
 */

/** Les trois états qu'un jour peut prendre. */
export const DAY_MODES = ['closed', 'range', '24h'] as const;
export type DayMode = (typeof DAY_MODES)[number];

/** Plage proposée quand un jour passe de « fermé » à « ouvert ». */
export const DEFAULT_RANGE = '08:00-18:00';

/** Jours ouvrés, au sens où on les recopie ensemble. */
export const WEEKDAYS: readonly WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

/** Heures et minutes proposées au sélecteur. */
export const PICKER_HOURS: readonly string[] = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, '0'),
);
export const PICKER_MINUTES = ['00', '15', '30', '45'] as const;

export function dayMode(value: string | undefined): DayMode {
  if (!value || value === 'closed') return 'closed';
  if (value === '24h') return '24h';
  return 'range';
}

/**
 * Bornes d'un jour.
 *
 * Retombe sur la plage par défaut plutôt que sur des champs vides : le
 * sélecteur a besoin d'une position de départ, et « 08:00 » est une supposition
 * plus utile que « 00:00 » pour un atelier.
 */
export function dayRange(value: string | undefined): { open: string; close: string } {
  const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(value ?? '');
  if (!match) return { open: '08:00', close: '18:00' };
  return { open: match[1] as string, close: match[2] as string };
}

/** Une heure n'est complète et plausible qu'à `HH:MM`, 00–23 et 00–59. */
export function isValidTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

/** Un jour est valide s'il est fermé, ouvert 24 h, ou borné par deux heures lisibles. */
export function areHoursValid(hours: OpeningHours): boolean {
  return WEEK_DAYS.every((day) => {
    const value = hours[day];
    if (!value || value === 'closed' || value === '24h') return true;
    const { open, close } = dayRange(value);
    return isValidTime(open) && isValidTime(close) && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value);
  });
}

/**
 * Change l'état d'un jour.
 *
 * Repasser en « ouvert » restaure la plage précédente si elle existe encore
 * dans la valeur, sinon la plage par défaut : quelqu'un qui ferme le samedi par
 * erreur et se ravise ne doit pas ressaisir ses heures.
 */
export function setDayMode(hours: OpeningHours, day: WeekDay, mode: DayMode): OpeningHours {
  if (mode === 'closed') return { ...hours, [day]: 'closed' };
  if (mode === '24h') return { ...hours, [day]: '24h' };

  const current = hours[day];
  return { ...hours, [day]: dayMode(current) === 'range' ? current : DEFAULT_RANGE };
}

/** Déplace une des deux bornes d'un jour, en gardant l'autre. */
export function setDayTime(
  hours: OpeningHours,
  day: WeekDay,
  edge: 'open' | 'close',
  time: string,
): OpeningHours {
  const { open, close } = dayRange(hours[day]);
  const next = edge === 'open' ? `${time}-${close}` : `${open}-${time}`;
  return { ...hours, [day]: next };
}

/**
 * Recopie un jour sur d'autres.
 *
 * Ressaisir six fois la même plage sur un téléphone est exactement le genre de
 * corvée qui fait abandonner un formulaire à mi-chemin.
 */
export function copyDayTo(
  hours: OpeningHours,
  day: WeekDay,
  targets: readonly WeekDay[],
): OpeningHours {
  const source = hours[day];
  if (!source) return hours;
  return targets.reduce<OpeningHours>(
    (accumulated, target) => ({ ...accumulated, [target]: source }),
    hours,
  );
}

/** Le lundi recopié sur les sept jours. */
export function copyToWholeWeek(hours: OpeningHours, day: WeekDay = 'mon'): OpeningHours {
  return copyDayTo(hours, day, WEEK_DAYS);
}

/** Le lundi recopié du lundi au vendredi — le week-end garde ses propres horaires. */
export function copyToWeekdays(hours: OpeningHours, day: WeekDay = 'mon'): OpeningHours {
  return copyDayTo(hours, day, WEEKDAYS);
}
