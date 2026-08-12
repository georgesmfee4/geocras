import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type BlinkingDotProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pastille clignotante.
 *
 * Elle signale une donnée **vivante** : position en cours d'acquisition,
 * garages ouverts, session active, garagiste en route. C'est un signal d'état,
 * pas une décoration — ne pas l'utiliser sur un élément statique, sinon elle
 * perd tout sens partout ailleurs.
 *
 * Animation en `useNativeDriver` : elle tourne en continu sur l'écran Carte,
 * et un aller-retour par le fil JavaScript toutes les 900 ms sur un Android
 * d'entrée de gamme se voit au défilement.
 */
export function BlinkingDot({ size = 8, color, style }: BlinkingDotProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color ?? theme.colors.success,
          opacity,
        },
        style,
      ]}
    />
  );
}
