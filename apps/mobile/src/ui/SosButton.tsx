import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { ChamferView } from './ChamferView';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

export type SosButtonProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
};

/** Hauteur imposée par le cahier des charges. */
const HEIGHT = 64;
const ICON = 44;

/**
 * Bouton SOS.
 *
 * C'est l'action la plus importante de l'application, et le seul bouton qui
 * mérite son propre composant plutôt qu'une variante de `<Button>` : il porte
 * une icône à ondes concentriques, un halo qui pulse en boucle et un chevron,
 * qu'aucun autre bouton n'a.
 *
 * Trois choix tiennent à son usage — quelqu'un en panne, debout au bord d'une
 * route, éventuellement de nuit :
 *
 * 1. **Le halo pulse.** Ce n'est pas une décoration : c'est ce qui attire
 *    l'œil sur la bonne cible quand on ouvre l'app en panique. Il est coupé si
 *    le système demande de réduire les animations.
 * 2. **Retour haptique lourd** à l'appui. Sous stress, avec des gants ou les
 *    mains sales, la confirmation tactile arrive avant la confirmation
 *    visuelle.
 * 3. **Titre et sous-titre sur une ligne chacun, jamais tronqués** — imposé
 *    par le cahier des charges. D'où `adjustsFontSizeToFit` plutôt que des
 *    points de suspension : mieux vaut un point de moins que « Position
 *    envoyée automatiq… ».
 */
export function SosButton({ title, subtitle, onPress, disabled = false }: SosButtonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion || disabled) {
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Retour instantané : l'onde doit repartir du centre, pas se rétracter.
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(420),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion, disabled]);

  const handlePress = (): void => {
    // `void` : un appareil sans moteur haptique rejette la promesse, et ce
    // n'est pas une raison pour ne pas déclencher le SOS.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPress();
  };

  return (
    <View>
      {/*
        Halo : un second chamfer posé derrière, qui grandit et s'efface. Un
        `box-shadow` animé n'existe pas de façon portable en React Native, et
        un halo rectangulaire dépasserait de la coupe à 45° du bouton.
      */}
      {!reducedMotion && !disabled ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: HEIGHT,
            opacity: pulse.interpolate({
              inputRange: [0, 0.1, 1],
              outputRange: [0, 0.28, 0],
            }),
            transform: [
              { scaleX: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
              { scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) },
            ],
          }}
        >
          <ChamferView
            variant="wide"
            fill={theme.colors.primary}
            style={{ height: HEIGHT }}
            contentStyle={{ height: HEIGHT }}
          >
            <View />
          </ChamferView>
        </Animated.View>
      ) : null}

      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        accessibilityState={{ disabled }}
        style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.9 : 1 })}
      >
        <ChamferView
          variant="wide"
          fill={theme.colors.primary}
          style={{ minHeight: HEIGHT }}
          contentStyle={{
            minHeight: HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.lg,
            paddingLeft: theme.space.md,
            // Rembourrage droit plus généreux : le chevron ne doit pas tomber
            // dans l'angle coupé.
            paddingRight: theme.space.xxl,
          }}
        >
          <WaveIcon pulse={pulse} animated={!reducedMotion && !disabled} />

          <View style={{ flex: 1 }}>
            <Text variant="heading" tone="inverse" numberOfLines={1} adjustsFontSizeToFit>
              {title}
            </Text>
            <Text
              variant="small"
              tone="inverse"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ opacity: 0.85 }}
            >
              {subtitle}
            </Text>
          </View>

          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </ChamferView>
      </Pressable>
    </View>
  );
}

/**
 * Cible à ondes concentriques : un point plein, un anneau fixe, et un anneau
 * qui s'échappe. C'est la marque GeoCras — la même cible que le logo — mise en
 * mouvement pour signifier l'émission de la position.
 */
function WaveIcon({ pulse, animated }: { pulse: Animated.Value; animated: boolean }) {
  return (
    <View style={{ width: ICON, height: ICON, alignItems: 'center', justifyContent: 'center' }}>
      {animated ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: ICON,
            height: ICON,
            borderRadius: ICON / 2,
            borderWidth: 1.5,
            borderColor: '#FFFFFF',
            opacity: pulse.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0, 0.55, 0],
            }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) },
            ],
          }}
        />
      ) : null}

      <Svg width={26} height={26} viewBox="0 0 40 40">
        <Circle cx={20} cy={20} r={17.4} fill="none" stroke="#FFFFFF" strokeWidth={5.2} />
        <Circle cx={20} cy={20} r={6.5} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}
