import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Côté de la vignette animée. Calé sur la hauteur du carrousel de garages. */
const ART = 62;

export type EmptyRadiusProps = {
  /** Rayon fouillé, en kilomètres — annoncé en mono comme toute mesure. */
  radiusKm: number;
};

/**
 * Aucun garage dans le rayon, sur l'accueil.
 *
 * Remplace la vignette de repli qui s'affichait auparavant. Cette vignette
 * proposait le garage le plus proche **hors rayon** — à cent kilomètres — juste
 * sous une ligne annonçant « Aucun garage dans ce rayon ». Les deux se
 * contredisaient à l'écran, et surtout le garage montré n'était pas
 * exploitable : personne ne se fait dépanner à cent kilomètres.
 *
 * Le dessin dit littéralement ce qui s'est passé : des ondes partent du point
 * de l'utilisateur, balaient le rayon, et ne rencontrent rien. Le centre reste
 * le point bleu-jaune de la position, les ondes sont ambrées — la couleur
 * d'alerte de l'app — et aucun écusson de garage n'apparaît, parce qu'il n'y
 * en a pas.
 *
 * Format horizontal et compact : il occupe exactement la bande du carrousel
 * qu'il remplace, donc le bouton SOS ne se déplace pas quand on passe d'un
 * état à l'autre.
 */
export function EmptyRadius({ radiusKm }: EmptyRadiusProps) {
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const reducedMotion = useReducedMotion();

  /** Deux ondes décalées : le balayage paraît continu sans être chargé. */
  const first = useRef(new Animated.Value(0)).current;
  const second = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;

    const wave = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.quad),
            // La valeur alimente un rayon SVG, que le pilote natif ne sait pas
            // animer.
            useNativeDriver: false,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      );

    const a = wave(first, 0);
    const b = wave(second, 1100);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [first, second, reducedMotion]);

  const ring = (value: Animated.Value) => ({
    r: value.interpolate({ inputRange: [0, 1], outputRange: [7, 29] }),
    opacity: value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }),
  });

  const a = ring(first);
  const b = ring(second);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        // Filet ambré au flanc : l'alerte entre par le bord, elle n'envahit
        // pas la zone de lecture — même grammaire que l'écran de résultats.
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.warning,
        paddingVertical: theme.space.md,
        paddingHorizontal: theme.space.md,
      }}
    >
      <Svg width={ART} height={ART} viewBox="0 0 62 62">
        <Defs>
          <RadialGradient id="empty-radius-halo" cx="50%" cy="50%" r="50%">
            <Stop offset="45%" stopColor={theme.colors.warning} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={theme.colors.warning} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Circle cx={31} cy={31} r={30} fill="url(#empty-radius-halo)" />

        {/* Limite du rayon fouillé, en pointillés : une frontière cherchée,
            pas une zone pleine. */}
        <Circle
          cx={31}
          cy={31}
          r={26}
          fill="none"
          stroke={theme.colors.warning}
          strokeWidth={1.4}
          strokeDasharray="3 4"
          opacity={0.8}
        />

        {!reducedMotion ? (
          <>
            <AnimatedCircle
              cx={31}
              cy={31}
              r={a.r as unknown as number}
              fill="none"
              stroke={theme.colors.warning}
              strokeWidth={1.8}
              opacity={a.opacity as unknown as number}
            />
            <AnimatedCircle
              cx={31}
              cy={31}
              r={b.r as unknown as number}
              fill="none"
              stroke={theme.colors.warning}
              strokeWidth={1.8}
              opacity={b.opacity as unknown as number}
            />
          </>
        ) : null}

        {/* Le point de l'utilisateur, au centre — reprise exacte du marqueur
            de la carte, double anneau compris. */}
        <Circle cx={31} cy={31} r={7} fill="#FFFFFF" />
        <Circle cx={31} cy={31} r={5} fill={theme.colors.userPosition} />
        <Circle
          cx={31}
          cy={31}
          r={7.6}
          fill="none"
          stroke={theme.colors.shadow}
          strokeWidth={0.8}
          opacity={0.35}
        />
      </Svg>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h2" numberOfLines={1} ellipsizeMode="tail">
          {t('map.noneInRadius')}
        </Text>
        <Text variant="txt" tone="secondary" numberOfLines={2}>
          {t('map.noneInRadiusLead')}{' '}
          <Text variant="numSm" tone="secondary">
            {formatNumber(radiusKm, 0)} km
          </Text>
          .
        </Text>
      </View>
    </View>
  );
}
