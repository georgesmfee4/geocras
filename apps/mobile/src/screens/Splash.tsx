import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { GhostMap } from '../ui/GhostMap';
import { Logo } from '../ui/Logo';
import { Text, Wordmark } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';

/**
 * Arrêts du dégradé radial, centré haut.
 * Les trois valeurs claires sont celles de la spécification, au caractère près.
 */
const LIGHT_STOPS = [
  { offset: '0', color: '#F1544F' },
  { offset: '0.52', color: '#E53935' },
  { offset: '1', color: '#BF2723' },
] as const;

/** Variante sombre : `#121110`, réchauffé au centre par la teinte primaire. */
const DARK_STOPS = [
  { offset: '0', color: '#2A1513' },
  { offset: '0.55', color: '#1A1412' },
  { offset: '1', color: '#121110' },
] as const;

const LOGO_SIZE = 94;
const WAVE_SIZE = LOGO_SIZE * 2.9;
const HALO_SIZE = LOGO_SIZE * 3.1;
const PROGRESS_WIDTH = 128;

/**
 * Écran de lancement.
 *
 * Il ne se pilote pas au chronomètre : sa disparition est décidée par
 * `app/index.tsx`, qui attend une **vraie** acquisition GPS (ou son échec au
 * bout de 4 s). Ce composant ne fait qu'afficher l'état de cette acquisition.
 *
 * Le dégradé est **radial**, pas linéaire : `expo-linear-gradient` ne sait pas
 * le produire, d'où le passage par un `RadialGradient` SVG. Un dégradé linéaire
 * donnerait une bande, pas le halo lumineux centré haut de la maquette.
 */
export function Splash() {
  const theme = useTheme();
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const isDark = theme.scheme === 'dark';

  const waveA = useRef(new Animated.Value(0)).current;
  const waveB = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;

  // Sur fond sombre, les ondes et le halo passent au rouge — le blanc y serait
  // agressif et casserait le parti pris du « sombre chaud ».
  const accent = isDark ? theme.colors.primary : '#FFFFFF';

  useEffect(() => {
    const fadeIn = Animated.timing(entrance, {
      toValue: 1,
      duration: reducedMotion ? 0 : 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    fadeIn.start();

    if (reducedMotion) {
      // Figé sur un état lisible plutôt qu'arrêté sur une image vide.
      progress.setValue(0.5);
      return () => fadeIn.stop();
    }

    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 2600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );

    // Décalage d'une seconde entre les deux ondes, comme spécifié.
    const loops = [pulse(waveA, 0), pulse(waveB, 1000)];

    const sweep = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    for (const loop of loops) loop.start();
    sweep.start();

    return () => {
      fadeIn.stop();
      for (const loop of loops) loop.stop();
      sweep.stop();
    };
  }, [entrance, progress, reducedMotion, waveA, waveB]);

  const waveStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({
      inputRange: [0, 0.15, 1],
      outputRange: [0, 0.34, 0],
    }),
    transform: [
      {
        scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] }),
      },
    ],
  });

  const rise = entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <View style={styles.root}>
      {/* --- Fond : dégradé radial --------------------------------------- */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="splash-bg" cx="50%" cy="26%" rx="92%" ry="78%">
            {(isDark ? DARK_STOPS : LIGHT_STOPS).map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#splash-bg)" />
      </Svg>

      {/* Fond de carte fantôme à 10 %, repris de l'écran Carte. */}
      <GhostMap opacity={isDark ? 0.06 : 0.1} color={isDark ? theme.colors.primary : '#FFFFFF'} />

      <SafeAreaView style={styles.safe}>
        {/* --- Bloc central ---------------------------------------------- */}
        <View style={styles.center}>
          <View style={styles.logoStage}>
            {/* Halo diffus : c'est lui qui détache le logo du fond et donne
                la profondeur visible sur la maquette. */}
            <View
              style={[
                styles.halo,
                {
                  width: HALO_SIZE,
                  height: HALO_SIZE,
                  borderRadius: HALO_SIZE / 2,
                  backgroundColor: accent,
                  opacity: isDark ? 0.07 : 0.11,
                },
              ]}
            />

            <Animated.View
              style={[
                styles.wave,
                {
                  width: WAVE_SIZE,
                  height: WAVE_SIZE,
                  borderRadius: WAVE_SIZE / 2,
                  borderColor: accent,
                },
                waveStyle(waveA),
              ]}
            />
            <Animated.View
              style={[
                styles.wave,
                {
                  width: WAVE_SIZE,
                  height: WAVE_SIZE,
                  borderRadius: WAVE_SIZE / 2,
                  borderColor: accent,
                },
                waveStyle(waveB),
              ]}
            />

            <Animated.View style={{ opacity: entrance }}>
              <Logo size={LOGO_SIZE} variant={isDark ? 'dark' : 'light'} />
            </Animated.View>
          </View>

          <Animated.View
            style={{
              alignItems: 'center',
              gap: theme.space.md,
              opacity: entrance,
              transform: [{ translateY: rise }],
            }}
          >
            <Wordmark size={36} color="#FFFFFF" />

            <Text
              variant="baseline"
              style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}
            >
              {t('splash.tagline')}
            </Text>
          </Animated.View>
        </View>

        {/* --- Acquisition GPS -------------------------------------------- */}
        <View style={styles.status}>
          <View
            style={{
              width: PROGRESS_WIDTH,
              height: 2,
              backgroundColor: 'rgba(255,255,255,0.22)',
              overflow: 'hidden',
            }}
            accessibilityRole="progressbar"
            accessibilityLabel={t('splash.acquiring')}
          >
            <Animated.View
              style={{
                width: PROGRESS_WIDTH * 0.42,
                height: 2,
                backgroundColor: '#FFFFFF',
                transform: [
                  {
                    // Balayage indéterminé : on ne connaît pas l'avancement
                    // réel d'un fix GPS. Une barre qui se remplit à 80 % puis
                    // stagne serait un mensonge.
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-PROGRESS_WIDTH * 0.42, PROGRESS_WIDTH],
                    }),
                  },
                ],
              }}
            />
          </View>

          <View style={styles.acquiringRow}>
            <PulsingDot reduced={reducedMotion} />
            <Text variant="mono" style={{ color: 'rgba(255,255,255,0.82)' }}>
              {t('splash.acquiring')}
            </Text>
          </View>
        </View>

        {/* La variante `footnote` porte déjà 9,5 px et letter-spacing .16em. */}
        <Text variant="footnote" style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
          Cameroun · V1.0
        </Text>
      </SafeAreaView>
    </View>
  );
}

/** Pastille blanche du bandeau d'acquisition — plus discrète que la verte. */
function PulsingDot({ reduced }: { reduced: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);

  return (
    <Animated.View
      style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FFFFFF', opacity }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E53935' },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 },
  logoStage: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  wave: { position: 'absolute', borderWidth: 1.5 },
  status: { alignItems: 'center', gap: 14, paddingBottom: 8 },
  acquiringRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
