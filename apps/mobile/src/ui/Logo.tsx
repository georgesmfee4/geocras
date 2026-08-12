import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { ChamferView } from './ChamferView';

export type LogoProps = {
  /** Côté du carré, en points. 94 sur le splash. */
  size?: number;
  /**
   * `light` : carré blanc, marque rouge — sur fond rouge.
   * `dark`  : carré rouge, marque blanche — sur fond sombre.
   */
  variant?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
};

/**
 * Marque GeoCras : carré **chamfré** portant une cible concentrique.
 *
 * La cible n'est pas décorative — c'est une position sur une carte, le sujet
 * même du produit. Anneau et point central sont dimensionnés en fraction du
 * carré pour rester justes à toute taille (94 px sur le splash, 58 px dans le
 * tiroir).
 *
 * Le chamfer passe par `<ChamferView>` : c'est la brique commune à tous les
 * éléments chamfrés, jamais réimplémentée localement.
 */
export function Logo({ size = 94, variant = 'light', style }: LogoProps) {
  const theme = useTheme();

  const squareColor = variant === 'light' ? '#FFFFFF' : theme.colors.primary;
  const markColor = variant === 'light' ? theme.colors.primary : '#FFFFFF';

  // Proportions relevées sur la maquette : cible à ~40 % du carré, anneau épais.
  // L'anneau et le point sont exprimés dans le repère 0–40 du viewBox, donc
  // indépendants de `size` : la marque reste identique à toute échelle.
  const markSize = size * 0.4;
  const RING_STROKE = 5.2;
  const RING_RADIUS = 20 - RING_STROKE / 2;
  const DOT_RADIUS = 6.5;

  return (
    <ChamferView
      fill={squareColor}
      style={[{ width: size, height: size }, style]}
      contentStyle={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityRole="image"
      accessibilityLabel="GeoCras"
    >
      {/* Léger décalage vers le haut-gauche : centrer optiquement dans un
          carré dont le coin bas-droit est coupé demande de compenser le vide. */}
      <View style={{ transform: [{ translateX: -size * 0.03 }, { translateY: -size * 0.03 }] }}>
        <Svg width={markSize} height={markSize} viewBox="0 0 40 40">
          <Circle
            cx={20}
            cy={20}
            r={RING_RADIUS}
            fill="none"
            stroke={markColor}
            strokeWidth={RING_STROKE}
          />
          <Circle cx={20} cy={20} r={DOT_RADIUS} fill={markColor} />
        </Svg>
      </View>
    </ChamferView>
  );
}
