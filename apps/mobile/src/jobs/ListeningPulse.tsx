import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { useReducedMotion } from '../ui/useReducedMotion';

export type ListeningPulseProps = {
  /** Côté du cadran. Le noyau et les ondes s'en déduisent. */
  size?: number;
  /** Couleur des ondes. Par défaut le vert de l'app. */
  color?: string;
  /**
   * Ondes à l'arrêt : le garage n'écoute plus.
   *
   * Le cadran reste dessiné — c'est le même appareil — mais il ne bat pas. Un
   * cadran retiré ferait sauter la mise en page entre les deux états, et
   * surtout ne dirait pas *qu'il y a* quelque chose qui ne tourne plus.
   */
  still?: boolean;
};

/** Le noyau vaut ce sixième du cadran : assez pour se voir, assez petit pour laisser respirer les ondes. */
const CORE_RATIO = 0.2;

/**
 * Cadran de veille du poste de travail.
 *
 * Deux ondes partent d'un noyau plein et s'effacent en s'élargissant — le même
 * vocabulaire que le balayage de `EmptyRadius`, mais l'inverse comme propos :
 * là-bas les ondes ne trouvent rien, ici elles disent que le garage **écoute**.
 * C'est la seule question que se pose un garagiste devant un écran sans
 * demande, et une phrase ne la ferme pas aussi bien qu'un mouvement.
 *
 * Rendu par le fil natif : la veille est l'état normal d'un garage la plupart
 * de la journée, cette boucle tourne donc des heures.
 */
export function ListeningPulse({ size = 50, color, still = false }: ListeningPulseProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const tint = color ?? theme.colors.success;

  const first = useRef(new Animated.Value(0)).current;
  const second = useRef(new Animated.Value(0)).current;
  const frozen = reducedMotion || still;

  useEffect(() => {
    if (frozen) return;

    const wave = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 1900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          // Retour instantané : l'onde n'a pas à se rétracter, elle repart du
          // centre. Sans ce cran, on verrait un cercle se refermer sur le noyau.
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );

    const waves = Animated.parallel([wave(first, 0), wave(second, 950)]);
    waves.start();
    return () => waves.stop();
  }, [first, second, frozen]);

  const core = Math.round(size * CORE_RATIO);

  const ring = (value: Animated.Value) => (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tint,
        opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
        transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
      }}
    />
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {frozen ? (
        <View
          style={{
            position: 'absolute',
            width: size * 0.66,
            height: size * 0.66,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: tint,
            opacity: 0.4,
          }}
        />
      ) : (
        <>
          {ring(first)}
          {ring(second)}
        </>
      )}

      <View
        style={{
          width: core,
          height: core,
          borderRadius: radius.pill,
          backgroundColor: tint,
          opacity: frozen ? 0.55 : 1,
        }}
      />
    </View>
  );
}
