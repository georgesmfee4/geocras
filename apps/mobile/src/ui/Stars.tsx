import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

/**
 * Étoile à cinq branches dans un repère 0–24.
 *
 * Exportée : la note en étoiles, le pictogramme du bouton « Noter » et la
 * saisie d’un avis doivent dessiner exactement la même forme, sinon l’app a
 * trois étoiles légèrement différentes selon l’écran.
 */
export const STAR_PATH =
  'M12 1.6l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.35l-6.18 3.25L7 13.73l-5-4.87 6.91-1z';

function Star({ size, fill, stroke }: { size: number; fill: string; stroke: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

export type StarsProps = {
  /** Note de 0 à 5. */
  value: number;
  size?: number;
  /** Affiche la valeur chiffrée à droite, en mono comme l'exige l'identité. */
  showValue?: boolean;
  /** Nombre d'avis, affiché après la note. */
  reviewCount?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Note en étoiles.
 *
 * L'arrondi est fait à l'étoile pleine la plus proche : une demi-étoile
 * rendrait la lecture ambiguë à 13 px, taille à laquelle ce composant apparaît
 * dans les carrousels. La valeur exacte est portée par le chiffre en mono,
 * qui est la donnée de référence.
 */
export function Stars({ value, size = 13, showValue = false, reviewCount, style }: StarsProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(5, value));
  const filled = Math.round(clamped);

  const label =
    reviewCount === undefined
      ? `${clamped.toFixed(1).replace('.', ',')}`
      : `${clamped.toFixed(1).replace('.', ',')} · ${reviewCount} avis`;

  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }, style]}
      accessibilityRole="text"
      accessibilityLabel={`Note ${clamped.toFixed(1)} sur 5${
        reviewCount === undefined ? '' : `, ${reviewCount} avis`
      }`}
    >
      <View style={{ flexDirection: 'row', gap: 1 }}>
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            size={size}
            fill={index < filled ? theme.colors.warning : 'transparent'}
            stroke={index < filled ? theme.colors.warning : theme.colors.muted}
          />
        ))}
      </View>
      {showValue ? (
        <Text variant="monoSmall" tone="secondary">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
