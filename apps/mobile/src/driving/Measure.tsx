import type { StyleProp, TextStyle } from 'react-native';
import type { TextVariant } from '../theme/tokens';
import { Text } from '../ui/Text';

/**
 * Coupe une mesure déjà formatée entre sa valeur et son unité.
 *
 * On repart de la chaîne produite par `formatDistance` plutôt que de refaire le
 * calcul : les seuils — mètres en dessous du kilomètre, arrondi à la dizaine,
 * virgule décimale française — sont des décisions produit déjà prises et
 * documentées, et les redécider ici les ferait diverger au premier changement.
 *
 * La coupe se fait sur la **dernière** espace : « 1,2 km » se sépare en
 * « 1,2 » et « km », et une chaîne sans espace ressort entière, sans unité.
 */
export function splitMeasure(formatted: string): { value: string; unit: string } {
  const at = formatted.lastIndexOf(' ');
  if (at === -1) return { value: formatted, unit: '' };
  return { value: formatted.slice(0, at), unit: formatted.slice(at + 1) };
}

export type MeasureProps = {
  /** Mesure formatée, unité comprise — « 24 km », « 120 m ». */
  formatted: string;
  /** Niveau du chiffre. L'unité prend toujours `numSm`. */
  variant: Extract<TextVariant, 'num' | 'numLg' | 'numXl'>;
  color: string;
  style?: StyleProp<TextStyle>;
};

/**
 * Une donnée mesurée, chiffre grand et unité petite.
 *
 * L'unité ne disparaît jamais — sans elle « 24 » ne veut rien dire — mais elle
 * ne se lit pas : elle se sait. La mettre à la taille du chiffre lui donnerait
 * un poids qu'elle n'a pas, surtout dans une rangée de trois compteurs lue d'un
 * coup d'œil au volant.
 *
 * L'espace de « 24 km » saute avec la coupe : la maquette colle l'unité au
 * chiffre, et à deux tailles différentes le blanc typographique suffit déjà à
 * les séparer.
 *
 * Les deux niveaux sont en Plex Mono — c'est une donnée mesurée, la règle ne
 * souffre pas d'exception.
 */
export function Measure({ formatted, variant, color, style }: MeasureProps) {
  const { value, unit } = splitMeasure(formatted);

  return (
    <Text variant={variant} style={[{ color }, style]} numberOfLines={1}>
      {value}
      {unit ? (
        <Text variant="numSm" style={{ color }}>
          {unit}
        </Text>
      ) : null}
    </Text>
  );
}
