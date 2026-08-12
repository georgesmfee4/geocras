import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { markerPath } from './shapes';
import { Text } from './Text';

export type GarageMarkerProps = {
  /**
   * Rang de pertinence, calculé par le serveur.
   *
   * Ne JAMAIS le dériver de l'index d'un tableau côté client : le tri actif
   * vit sur le serveur, et un rang recalculé localement diverge dès que les
   * données bougent.
   */
  rank: number;
  certified: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Écusson pentagonal numéroté — jamais la goutte par défaut.
 *
 * Certifié : rempli rouge, bordure blanche, pastille ✓ en haut à droite, 38 px.
 * Non certifié : fond blanc, bordure encre de 2 px, 33 px.
 *
 * La pointe basse est le point d'ancrage : sur la carte, c'est elle qui doit
 * tomber sur la coordonnée du garage, pas le centre de l'écusson.
 */
export function GarageMarker({ rank, certified, style }: GarageMarkerProps) {
  const theme = useTheme();
  const size = certified ? theme.markerSize.certified : theme.markerSize.standard;
  const height = size * 1.18;

  const fill = certified ? theme.colors.primary : theme.colors.surface;
  const stroke = certified ? theme.colors.surface : theme.colors.ink;
  const strokeWidth = certified ? 1.5 : 2;

  return (
    <View
      style={[{ width: size, height }, style]}
      accessibilityRole="image"
      accessibilityLabel={`Garage numéro ${rank}${certified ? ', certifié' : ''}`}
    >
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        pointerEvents="none"
      >
        <Path
          d={markerPath(theme.markerShape.shoulder)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>

      <View
        style={{
          height: height * theme.markerShape.shoulder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          variant="monoStrong"
          style={{
            color: certified ? theme.colors.surface : theme.colors.ink,
            fontSize: certified ? 15 : 13,
          }}
        >
          {rank}
        </Text>
      </View>

      {certified ? (
        <View style={{ position: 'absolute', top: -3, right: -3 }}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Circle cx={12} cy={12} r={11} fill={theme.colors.surface} />
            <Path
              d="M7 12.5l3.2 3.2L17 9"
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}
