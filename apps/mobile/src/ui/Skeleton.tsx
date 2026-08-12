import { useEffect, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from './useReducedMotion';

export type SkeletonProps = {
  width: number | `${number}%`;
  height: number;
  /**
   * `false` rend un bloc **immobile**, sans `Animated` ni boucle.
   *
   * À utiliser pendant une transition d'écran : démarrer douze boucles au
   * moment où le fil JavaScript doit servir l'animation d'ouverture, c'est
   * exactement ce qui la fait tomber à dix images par seconde. L'ondulation
   * n'apporte rien sur trois cents millisecondes — elle sert à faire patienter,
   * pas à couvrir une transition.
   */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Opacité du bloc figé — celle du milieu de l'ondulation. */
const STILL_OPACITY = 0.75;

/**
 * Bloc d'attente.
 *
 * Préféré à un `ActivityIndicator` là où l'on connaît déjà la forme de ce qui
 * arrive : le carrousel de garages garde sa hauteur pendant le chargement, donc
 * le bouton SOS ne saute pas de place au moment où la liste arrive. Sur un
 * écran où le SOS est l'action critique, un bouton qui se déplace sous le pouce
 * est un vrai défaut, pas un détail.
 *
 * L'ondulation reste très discrète — c'est une attente, pas un événement.
 */
export function Skeleton({ width, height, animated = true, style }: SkeletonProps) {
  const theme = useTheme();

  if (!animated) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          { width, height, backgroundColor: theme.colors.rule, opacity: STILL_OPACITY },
          style,
        ]}
      />
    );
  }

  return <PulsingSkeleton width={width} height={height} style={style} />;
}

/**
 * Composant séparé, et non une branche du précédent : les règles des hooks
 * interdisent d'en appeler sous condition, et le bloc figé ne doit **rien**
 * coûter — ni valeur animée, ni effet, ni abonnement au réglage système.
 */
function PulsingSkeleton({ width, height, style }: Omit<SkeletonProps, 'animated'>) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      shimmer.setValue(0.5);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 780,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 780,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, reducedMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          backgroundColor: theme.colors.rule,
          opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
        },
        style,
      ]}
    />
  );
}
