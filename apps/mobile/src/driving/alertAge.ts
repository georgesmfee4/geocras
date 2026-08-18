import type { Locale } from '@geocras/shared';

/**
 * Durée pendant laquelle une alerte est encore **d'actualité**, en
 * millisecondes.
 *
 * Vingt-cinq secondes : au-delà, l'événement est derrière soi — le feu est
 * passé, le véhicule doublé — et la ligne cesse d'être un avertissement pour
 * devenir une trace. C'est un peu plus que le délai minimal entre deux alertes
 * d'un même type, de sorte qu'une alerte reste rarement seule à l'écran, et
 * bien plus que le délai global de six secondes, qui ferait vieillir les lignes
 * plus vite qu'elles n'arrivent.
 */
export const ALERT_LIVE_MS = 25_000;

/**
 * Ancienneté d'une alerte de conduite, à la seconde.
 *
 * `formatRelativeAge` existe déjà et sert partout ailleurs, mais il écrit
 * « à l'instant » sous la minute : c'est le bon choix pour un avis de garage,
 * et le mauvais ici. Une session de conduite se raconte en secondes — « il y a
 * 40 s » situe l'événement à un carrefour près, « à l'instant » ne situe rien
 * et rend les trois lignes de la pile indistinguables.
 *
 * Fonction pure, sans dépendance à React ni à l'horloge : c'est ce qui la rend
 * testable, et c'est aussi pourquoi `now` n'est pas lu ici.
 */
export function formatAlertAge(ageMs: number, locale: Locale): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  const fr = locale === 'fr';

  if (seconds < 60) return fr ? `il y a ${seconds} s` : `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return fr ? `il y a ${minutes} min` : `${minutes}min ago`;

  const hours = Math.floor(minutes / 60);
  return fr ? `il y a ${hours} h` : `${hours}h ago`;
}
