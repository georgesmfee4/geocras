import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from './useReducedMotion';

/** Gabarit repris de la maquette 10 : piste 46 × 26, pavé 18. */
const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 26;
const KNOB = 18;
const INSET = (TRACK_HEIGHT - KNOB) / 2;

export type SwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Libellé lu par les lecteurs d'écran quand l'interrupteur est seul. */
  accessibilityLabel?: string;
};

/**
 * Interrupteur.
 *
 * **Rectangulaire**, piste et pavé, et c'est tout l'enjeu : la pilule arrondie
 * est le composant le plus générique de tout le mobile — la même sur les deux
 * plateformes, dans toutes les applications, à la teinte près. La maquette 10
 * la refuse comme la charte refuse les rayons de 8 px partout, et le pavé carré
 * qui coulisse dans une piste carrée appartient à la même famille que l'angle
 * coupé et le filet rouge.
 *
 * Le pavé glisse plutôt que de sauter : c'est le seul mouvement d'un écran de
 * réglages, il dit que l'appui a été pris en compte alors qu'aucun texte ne
 * change à l'écran. Il est coupé si le système demande de réduire les
 * animations.
 *
 * **Piste rouge et pavé blanc à l'état actif**, dans les deux thèmes. Une
 * première version mettait l'encre du thème, au motif qu'un réglage activé
 * n'est pas une alerte — sauf qu'en thème sombre l'encre **est le blanc** : la
 * piste devenait blanche et le pavé sombre, soit l'inverse exact de la
 * maquette. Le blanc du pavé est donc écrit en dur et non pris dans la surface,
 * pour la même raison.
 */
export function Switch({ value, onValueChange, disabled = false, accessibilityLabel }: SwitchProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const slide = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      slide.setValue(value ? 1 : 0);
      return;
    }

    Animated.timing(slide, {
      toValue: value ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [value, slide, reducedMotion]);

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      // La piste seule est plus fine que la cible de 44 px : on rend les pixels
      // manquants en `hitSlop` plutôt que d'épaissir un élément de réglage.
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <View
        style={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          backgroundColor: value ? theme.colors.primary : theme.colors.rule,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            width: KNOB,
            height: KNOB,
            marginLeft: INSET,
            backgroundColor: value ? '#FFFFFF' : theme.colors.muted,
            transform: [
              {
                translateX: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, TRACK_WIDTH - KNOB - INSET * 2],
                }),
              },
            ],
          }}
        />
      </View>
    </Pressable>
  );
}
