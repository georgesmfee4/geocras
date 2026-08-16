import { useEffect, useState } from 'react';
import type { TextVariant } from '../theme/tokens';
import { elapsedSecondsSince, formatElapsed, serverNow } from '../time/clock';
import { Text } from '../ui/Text';

export type WaitingClockProps = {
  /** Horodatage serveur d'où part le compteur, en ISO. */
  since: string;
  variant?: TextVariant;
  color?: string;
};

/**
 * Temps d'attente, à la seconde.
 *
 * Il tourne dans le temps du **serveur**. Comparer un horodatage serveur à
 * `Date.now()` revient à soustraire deux horloges : sur un téléphone dont
 * l'heure dérive — le cas ordinaire hors synchronisation réseau, et
 * systématique sur un émulateur — le compteur démarre à plusieurs minutes,
 * parfois en négatif.
 *
 * Composant à part et non quelques lignes recopiées : il apparaît sur chaque
 * ligne de la liste **et** dans le détail, et c'est le même chiffre que le
 * client regarde de son côté. Deux implémentations finiraient par diverger
 * d'une seconde, ce qui suffit à faire douter des deux.
 */
export function WaitingClock({ since, variant = 'num', color }: WaitingClockProps) {
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = elapsedSecondsSince(since, now);

  return (
    <Text variant={variant} style={color ? { color } : undefined}>
      {seconds === null ? '—' : formatElapsed(seconds)}
    </Text>
  );
}
