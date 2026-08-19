import { useCallback, useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from './useReducedMotion';

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  /**
   * Échelle atteinte pendant l'appui.
   *
   * Défaut volontairement timide : sur un panneau qui occupe le tiers de
   * l'écran, un demi-pour-cent de retrait suffit à faire « bouger sous le
   * doigt », alors que le 0,95 des bibliothèques génériques donne l'impression
   * que la page recule. Un petit élément peut demander plus.
   */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Appui qui s'enfonce.
 *
 * Le produit s'utilise debout, au bord d'une route, souvent avec des gants ou
 * une main grasse : le retour d'appui doit être visible sans avoir à guetter
 * un changement d'opacité de dix pour cent. Le ressort donne cette matière,
 * et il est **rendu par le fil natif** — le poste de travail reçoit ses SOS par
 * socket, et le fil JavaScript n'est pas garanti libre au moment où le doigt
 * touche l'écran.
 *
 * Sous « réduire les animations », on retombe sur le retrait d'opacité employé
 * partout ailleurs dans l'app : le retour d'appui reste, seul le mouvement
 * disparaît.
 */
export function PressableScale({
  scaleTo = 0.99,
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const spring = useCallback(
    (toValue: number) => {
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        stiffness: 320,
        damping: 26,
        mass: 0.7,
      }).start();
    },
    [scale],
  );

  const handleIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!reducedMotion) spring(scaleTo);
      onPressIn?.(event);
    },
    [onPressIn, reducedMotion, scaleTo, spring],
  );

  const handleOut = useCallback(
    (event: GestureResponderEvent) => {
      if (!reducedMotion) spring(1);
      onPressOut?.(event);
    },
    [onPressOut, reducedMotion, spring],
  );

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={({ pressed }) => ({
        opacity: disabled === true ? 1 : pressed && reducedMotion ? 0.85 : 1,
      })}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
