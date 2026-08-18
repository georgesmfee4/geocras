import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { EYE_STRIKE_RATIO, EyeIcon } from './icons';
import { useReducedMotion } from './useReducedMotion';

/** Côté de l'œil. Le reste de la géométrie s'en déduit. */
const ICON = 20;

/** Épaisseur de la barre — celle du trait de l'icône, sinon elle jure. */
const STRIKE_WIDTH = 1.7;

const TOGGLE_MS = 180;

export type RevealToggleProps = {
  revealed: boolean;
  onToggle: () => void;
  /** Libellé de l'assistance vocale. Il change avec l'état, à l'appelant de le traduire. */
  label: string;
};

/**
 * Bascule d'affichage du mot de passe.
 *
 * L'œil ne change pas d'icône : **la barre se trace**, du centre vers ses deux
 * extrémités, et se rétracte de la même façon. Deux dessins qui se
 * remplaceraient d'un coup donneraient un clignotement, et on perdrait ce que
 * le geste a de littéral — quelque chose vient se poser sur l'œil, ou s'en
 * retire.
 *
 * La barre est une vue et non un tracé SVG : `d` ne s'anime pas sur le fil
 * natif, une échelle si. Sa longueur est celle du tracé qu'elle remplace,
 * reprise à l'icône par `EYE_STRIKE_RATIO`, et son inclinaison la même — les
 * deux restent d'aplomb à toute taille.
 */
export function RevealToggle({ revealed, onToggle, label }: RevealToggleProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  const strike = useRef(new Animated.Value(revealed ? 1 : 0)).current;

  useEffect(() => {
    const anim = Animated.timing(strike, {
      toValue: revealed ? 1 : 0,
      duration: reduced ? 0 : TOGGLE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [revealed, reduced, strike]);

  // Révélé, l'œil passe à l'encre : la valeur est à découvert, l'icône ne peut
  // pas rester au même niveau de discrétion que lorsqu'elle la protégeait.
  const color = revealed ? theme.colors.ink : theme.colors.muted;

  const length = ICON * EYE_STRIKE_RATIO;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: revealed }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: ICON, height: ICON }}>
        <EyeIcon color={color} size={ICON} />

        <Animated.View
          style={{
            position: 'absolute',
            left: (ICON - length) / 2,
            top: (ICON - STRIKE_WIDTH) / 2,
            width: length,
            height: STRIKE_WIDTH,
            borderRadius: STRIKE_WIDTH / 2,
            backgroundColor: color,
            // L'opacité monte sur le premier quart de la course : la barre est
            // déjà pleine quand elle finit de s'étendre, sinon on la voit
            // arriver en fondu et le geste perd son tranchant.
            opacity: strike.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
            transform: [
              { rotate: '-45deg' },
              { scaleX: strike.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }) },
            ],
          }}
        />
      </View>
    </Pressable>
  );
}
