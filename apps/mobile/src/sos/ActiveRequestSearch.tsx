import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { mapColors } from '../theme/tokens';
import { useReducedMotion } from '../ui/useReducedMotion';
import { Text } from '../ui/Text';

export type ActiveRequestSearchProps = {
  visible: boolean;
};

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Côté du cadre de l'illustration, en unités SVG. */
const BOX = 200;

/**
 * Modale d'attente : « recherche d'une demande en cours ».
 *
 * Elle occupe la seconde ou deux pendant lesquelles on interroge le serveur
 * avant d'ouvrir le formulaire de déclaration. Ce n'est pas un ornement : sans
 * elle, l'appui sur SOS ne produit rien de visible, puis l'écran change tout
 * seul — et quelqu'un en panne qui ne voit pas sa touche prise en compte
 * appuie une deuxième fois.
 *
 * Le dessin est un **plan de ville balayé par un faisceau**, construit avec le
 * vocabulaire de l'app : les teintes de la carte (`mapColors`), l'écusson
 * pentagonal des garages, la cible concentrique du logo. Un fichier GIF aurait
 * pesé dans le bundle, ne se recolorerait pas en thème sombre, et pixelliserait
 * sur les écrans denses ; un tracé vectoriel animé fait les trois.
 *
 * `Modal` plutôt qu'une surcouche dans l'arbre : le balayage retour d'Android
 * doit être capté ici, sinon il ramène à la carte pendant que la requête part
 * quand même — et l'écran suivant s'ouvre par-dessus la carte.
 */
export function ActiveRequestSearch({ visible }: ActiveRequestSearchProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();

  /** Rotation du faisceau, en boucle. */
  const sweep = useRef(new Animated.Value(0)).current;
  /** Onde concentrique qui s'échappe du centre. */
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || reducedMotion) {
      sweep.setValue(0);
      pulse.setValue(0);
      return;
    }

    const spin = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        // `useNativeDriver` est impossible ici : la valeur alimente une
        // propriété SVG (`rotation`), que le pilote natif ne connaît pas.
        useNativeDriver: false,
      }),
    );

    const wave = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );

    spin.start();
    wave.start();
    return () => {
      spin.stop();
      wave.stop();
    };
  }, [visible, reducedMotion, sweep, pulse]);

  const rotation = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 360] });
  const waveRadius = pulse.interpolate({ inputRange: [0, 1], outputRange: [10, 78] });
  const waveOpacity = pulse.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.5, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          // Voile encre : la carte reste devinable derrière, on ne bascule pas
          // sur un écran plein qui donnerait l'impression d'avoir quitté.
          backgroundColor: 'rgba(28, 26, 23, 0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.space.xl,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 340,
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.sheetLarge,
            borderTopRightRadius: theme.radius.sheetLarge,
            borderBottomLeftRadius: theme.radius.sheetLarge,
            paddingTop: theme.space.xxl,
            paddingHorizontal: theme.space.xl,
            paddingBottom: theme.space.xxl,
            alignItems: 'center',
            gap: theme.space.lg,
          }}
        >
          <RadarScene
            rotation={rotation}
            waveRadius={waveRadius}
            waveOpacity={waveOpacity}
            animated={!reducedMotion}
          />

          <View style={{ alignItems: 'center', gap: theme.space.sm }}>
            <Text variant="heading" style={{ textAlign: 'center' }}>
              {t('sos.checkingActive')}
            </Text>
            <Text variant="small" tone="secondary" style={{ textAlign: 'center' }}>
              {t('sos.checkingActiveLead')}
            </Text>
          </View>

          <ProgressRule animated={!reducedMotion} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * Le plan balayé.
 *
 * Trois plans de lecture, du fond vers l'avant : la trame de rues, les
 * écussons de garages, puis le faisceau et la cible. C'est le même empilement
 * que sur la vraie carte, ce qui fait qu'on reconnaît l'app avant même d'avoir
 * lu le texte.
 */
function RadarScene({
  rotation,
  waveRadius,
  waveOpacity,
  animated,
}: {
  rotation: Animated.AnimatedInterpolation<string | number>;
  waveRadius: Animated.AnimatedInterpolation<string | number>;
  waveOpacity: Animated.AnimatedInterpolation<string | number>;
  animated: boolean;
}) {
  const theme = useTheme();
  const centre = BOX / 2;

  return (
    <View style={{ width: 176, height: 176 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`}>
        {/* Fond de carte, découpé au disque du radar. */}
        <Circle cx={centre} cy={centre} r={88} fill={mapColors.land} />

        {/* Trame de rues, volontairement asymétrique : une grille régulière
            lirait comme un motif décoratif, pas comme un plan de ville. */}
        <G opacity={0.9}>
          <Rect x={12} y={70} width={176} height={7} fill={mapColors.road} />
          <Rect x={12} y={124} width={176} height={4.5} fill={mapColors.road} />
          <Rect x={62} y={12} width={6} height={176} fill={mapColors.road} />
          <Rect x={132} y={12} width={4} height={176} fill={mapColors.road} />
          <Path
            d="M12 168 L188 40"
            stroke={mapColors.road}
            strokeWidth={5}
            fill="none"
          />
          {/* Cours d'eau — le seul élément courbe, il casse la rigidité. */}
          <Path
            d="M18 44 C60 62, 74 96, 118 108 S172 132, 190 150"
            stroke={mapColors.water}
            strokeWidth={9}
            fill="none"
            strokeLinecap="round"
          />
        </G>

        {/* Écussons de garages, à leur vraie forme pentagonale. */}
        <GarageBadge x={64} y={58} fill={theme.colors.primary} />
        <GarageBadge x={128} y={122} fill={theme.colors.surface} stroke={theme.colors.ink} />
        <GarageBadge x={44} y={132} fill={theme.colors.surface} stroke={theme.colors.ink} />

        {/* Cercles de portée. */}
        <Circle cx={centre} cy={centre} r={88} fill="none" stroke={theme.colors.rule} strokeWidth={2} />
        <Circle cx={centre} cy={centre} r={58} fill="none" stroke={theme.colors.rule} strokeWidth={1.5} />
        <Circle cx={centre} cy={centre} r={28} fill="none" stroke={theme.colors.rule} strokeWidth={1.5} />

        {/* Onde qui s'échappe du centre — même sémantique que le halo du
            bouton SOS : quelque chose est en train d'être émis. */}
        {animated ? (
          <AnimatedCircle
            cx={centre}
            cy={centre}
            r={waveRadius as unknown as number}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={2}
            opacity={waveOpacity as unknown as number}
          />
        ) : null}

        {/* Faisceau. Un secteur plein plutôt qu'un simple rayon : c'est le
            balayage qui dit « on cherche », pas l'aiguille. */}
        {animated ? (
          <AnimatedG
            originX={centre}
            originY={centre}
            rotation={rotation as unknown as number}
          >
            <Path
              d={`M${centre} ${centre} L${centre + 88} ${centre} A88 88 0 0 0 ${centre + 76} ${centre - 44} Z`}
              fill={theme.colors.primary}
              opacity={0.22}
            />
            <Path
              d={`M${centre} ${centre} L${centre + 88} ${centre}`}
              stroke={theme.colors.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </AnimatedG>
        ) : null}

        {/* Cible centrale : la marque GeoCras, reprise du logo. */}
        <Circle cx={centre} cy={centre} r={13} fill="none" stroke={theme.colors.primary} strokeWidth={4} />
        <Circle cx={centre} cy={centre} r={5} fill={theme.colors.primary} />
      </Svg>
    </View>
  );
}

/**
 * Écusson pentagonal, la même géométrie que `<GarageMarker>` :
 * `polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)`.
 */
function GarageBadge({
  x,
  y,
  fill,
  stroke,
}: {
  x: number;
  y: number;
  fill: string;
  stroke?: string;
}) {
  const w = 17;
  const h = 21;
  const shoulder = h * 0.62;

  return (
    <Path
      d={`M${x} ${y} h${w} v${shoulder} L${x + w / 2} ${y + h} L${x} ${y + shoulder} Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? 2 : 0}
      strokeLinejoin="round"
    />
  );
}

/**
 * Filet de progression indéterminé.
 *
 * Une barre qui se remplirait mentirait : on ignore combien de temps le
 * serveur mettra. Un segment qui traverse dit « ça travaille » sans promettre
 * d'échéance.
 */
function ProgressRule({ animated }: { animated: boolean }) {
  const theme = useTheme();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, slide]);

  return (
    <View
      style={{
        width: 96,
        height: 2,
        backgroundColor: theme.colors.rule,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: 32,
          height: 2,
          backgroundColor: theme.colors.primary,
          transform: [
            { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-32, 96] }) },
          ],
        }}
      />
    </View>
  );
}
