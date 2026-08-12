import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { mapColors } from '../theme/tokens';
import { useReducedMotion } from '../ui/useReducedMotion';

export type SosIllustrationProps = {
  height?: number;
};

/**
 * Illustration d'accueil du service SOS.
 *
 * Dessinée, pas importée. Trois raisons, dans l'ordre :
 *
 * 1. **Elle doit être de la même main que le reste.** Une photo ou un GIF
 *    trouvé ailleurs arrive avec ses propres couleurs, sa propre lumière et
 *    son propre style de trait ; posé sur le blanc chaud et le rouge de
 *    GeoCras, il se voit immédiatement comme une pièce rapportée. Ici tout
 *    sort des jetons du thème : le fond est celui de la carte, les routes
 *    sont celles de la carte, l'écusson du garage est le même pentagone que
 *    sur l'écran d'accueil.
 * 2. **Elle ne pèse rien et reste nette partout.** Pas d'asset binaire à
 *    livrer sur un forfait data camerounais, pas de flou sur les grands
 *    écrans.
 * 3. **Elle raconte la bonne scène** : un véhicule arrêté au bord d'une route,
 *    une onde qui part de lui, un garage à proximité. C'est exactement ce que
 *    le bouton SOS déclenche — pas une métaphore générique de « support ».
 *
 * Le viewBox est fixe et le rendu s'étire en largeur : la scène est composée
 * pour être lue en bandeau, jamais en carré.
 */
export function SosIllustration({ height = 176 }: SosIllustrationProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      wave.setValue(0.35);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wave, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [wave, reducedMotion]);

  const dark = theme.scheme === 'dark';
  // Sur fond sombre, le crème de la carte deviendrait un aplat lumineux au
  // milieu de l'écran. On garde la composition et on rebascule les valeurs.
  const land = dark ? theme.colors.surface : mapColors.land;
  const road = dark ? theme.colors.background : mapColors.road;
  const casing = dark ? theme.colors.rule : mapColors.roadCasing;
  const vegetation = dark ? '#1F2A1C' : mapColors.vegetation;
  const building = dark ? theme.colors.rule : mapColors.building;

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Svg width="100%" height={height} viewBox="0 0 320 176" preserveAspectRatio="xMidYMid slice">
        <Rect x={0} y={0} width={320} height={176} fill={land} />

        {/* Végétation : deux masses asymétriques. Une bande régulière lirait
            comme un motif décoratif au lieu d'un terrain. */}
        <Path d="M0 132c40-14 76-6 104 4 22 8 44 10 62 4v36H0z" fill={vegetation} opacity={0.75} />
        <Circle cx={286} cy={44} r={40} fill={vegetation} opacity={0.55} />

        {/* Bâti en arrière-plan */}
        <Rect x={30} y={44} width={30} height={34} fill={building} />
        <Rect x={66} y={30} width={22} height={48} fill={building} opacity={0.8} />
        <Rect x={228} y={38} width={34} height={40} fill={building} opacity={0.7} />

        {/* Route : casing puis remplissage, comme sur la vraie carte. */}
        <Path d="M-10 108h340v30h-340z" fill={casing} />
        <Path d="M-10 112h340v22h-340z" fill={road} />
        <Path
          d="M6 123h22M46 123h22M86 123h22M126 123h22M166 123h22M206 123h22M246 123h22M286 123h22"
          stroke={casing}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Écusson du garage — le même pentagone que les marqueurs de carte. */}
        <G>
          <Path
            d="M232 54h34v21l-17 13-17-13z"
            fill={theme.colors.primary}
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Circle cx={266} cy={54} r={6.4} fill="#FFFFFF" />
          <Path
            d="M263 54.2l2.2 2.2 3.8-4"
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M243 62.5l3.2 3.2 6-6.4"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
        <Path
          d="M236 92c8 3 18 3 26 0"
          fill="none"
          stroke={theme.colors.shadow}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.1}
        />

        {/* Véhicule à l'arrêt, capot ouvert : c'est le capot qui dit « en
            panne » plutôt que « en train de rouler ». */}
        <G>
          <Path
            d="M74 118v-9l6-11h30l9 11h6v9z"
            fill={theme.colors.surface}
            stroke={theme.colors.ink}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Path
            d="M84 98l-8-12"
            stroke={theme.colors.ink}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Path
            d="M76 86h24"
            stroke={theme.colors.ink}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Circle
            cx={88}
            cy={119}
            r={7}
            fill={theme.colors.surface}
            stroke={theme.colors.ink}
            strokeWidth={2.4}
          />
          <Circle
            cx={116}
            cy={119}
            r={7}
            fill={theme.colors.surface}
            stroke={theme.colors.ink}
            strokeWidth={2.4}
          />
        </G>
      </Svg>

      {/*
        L'onde SOS est en React Native et non en SVG : `useNativeDriver` ne
        pilote pas les attributs SVG, et une animation d'opacité sur le fil JS
        saccade dès que l'écran fait autre chose.
      */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          // Calé sur le véhicule : 100/320 en x, 104/176 en y.
          left: '31.25%',
          top: '59%',
          width: 170,
          height: 170,
          marginLeft: -85,
          marginTop: -85,
          borderRadius: 85,
          borderWidth: 2,
          borderColor: theme.colors.primary,
          opacity: wave.interpolate({
            inputRange: [0, 0.12, 1],
            outputRange: [0, 0.5, 0],
          }),
          transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) }],
        }}
      />
    </View>
  );
}
