import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { markerShape } from '../theme/tokens';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Côté du repère de dessin, en unités SVG. */
const BOX = 200;
const CENTRE = BOX / 2;

/** Rayons des trois cercles de portée. */
const RINGS = [92, 64, 36] as const;

/** Position de l'écusson du garage sur le cercle médian. */
const GARAGE_ANGLE_DEG = -52;

export type WaitingRadarProps = {
  /** Écusson rouge plein si le garage est certifié, blanc bordé sinon. */
  certified: boolean;
  /** `false` sous « réduire les animations » : la scène est alors figée. */
  animated: boolean;
  size?: number;
};

/**
 * Radar d'attente de réponse.
 *
 * Il dit une chose et une seule : **la demande est partie, elle n'a pas encore
 * de réponse**. Le centre est vous, l'écusson posé sur le cercle médian est le
 * garage retenu, et chaque onde qui part du centre est un appel qui n'a pas
 * encore été rendu. L'écusson pulse au lieu de rester allumé — un pictogramme
 * fixe se lirait comme un garage déjà acquis.
 *
 * C'est délibérément le même vocabulaire que la recherche de demande en cours
 * (`ActiveRequestSearch`) : cercles de portée, faisceau, cible centrale reprise
 * du logo. Quelqu'un qui a vu l'un reconnaît l'autre — l'app n'a qu'une seule
 * façon de dire « ça travaille ».
 *
 * Aucun fichier animé : un GIF pèserait dans le bundle, ne se recolorerait pas
 * en thème sombre et pixelliserait sur les écrans denses.
 */
export function WaitingRadar({ certified, animated, size = 216 }: WaitingRadarProps) {
  const theme = useTheme();

  /** Rotation du faisceau. */
  const sweep = useRef(new Animated.Value(0)).current;
  /** Deux ondes, décalées d'une demi-période pour ne jamais laisser de vide. */
  const waveA = useRef(new Animated.Value(0)).current;
  const waveB = useRef(new Animated.Value(0)).current;
  /** Battement de l'écusson du garage. */
  const beat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) {
      sweep.setValue(0);
      waveA.setValue(0);
      waveB.setValue(0);
      beat.setValue(1);
      return;
    }

    // `useNativeDriver` est impossible sur toute cette scène : les valeurs
    // alimentent des propriétés SVG — rotation, rayon, opacité de tracé — que
    // le pilote natif ne connaît pas.
    const spin = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );

    const ripple = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(beat, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );

    const rippleA = ripple(waveA, 0);
    const rippleB = ripple(waveB, 1100);

    spin.start();
    rippleA.start();
    rippleB.start();
    pulse.start();

    return () => {
      spin.stop();
      rippleA.stop();
      rippleB.stop();
      pulse.stop();
    };
  }, [animated, sweep, waveA, waveB, beat]);

  const rotation = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 360] });

  const radians = (GARAGE_ANGLE_DEG * Math.PI) / 180;
  const garageX = CENTRE + RINGS[1] * Math.cos(radians);
  const garageY = CENTRE + RINGS[1] * Math.sin(radians);

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`}>
        {/* Le disque prend la surface du thème : le radar doit basculer en
            sombre avec le reste, contrairement au fond de carte. */}
        <Circle cx={CENTRE} cy={CENTRE} r={RINGS[0]} fill={theme.colors.surface} />

        {/* Croix de visée, très discrète : elle donne l'échelle sans dessiner
            une mire de jeu vidéo. */}
        <Path
          d={`M${CENTRE - RINGS[0]} ${CENTRE} H${CENTRE + RINGS[0]}`}
          stroke={theme.colors.rule}
          strokeWidth={1}
        />
        <Path
          d={`M${CENTRE} ${CENTRE - RINGS[0]} V${CENTRE + RINGS[0]}`}
          stroke={theme.colors.rule}
          strokeWidth={1}
        />

        {RINGS.map((radius, index) => (
          <Circle
            key={radius}
            cx={CENTRE}
            cy={CENTRE}
            r={radius}
            fill="none"
            stroke={theme.colors.rule}
            strokeWidth={index === 0 ? 2 : 1.5}
          />
        ))}

        {animated ? (
          <>
            <Ripple value={waveA} color={theme.colors.primary} />
            <Ripple value={waveB} color={theme.colors.primary} />
          </>
        ) : null}

        {/* Faisceau : un secteur plein et non une aiguille. C'est le balayage
            qui dit « on écoute », pas le trait. */}
        {animated ? (
          <AnimatedG
            originX={CENTRE}
            originY={CENTRE}
            rotation={rotation as unknown as number}
          >
            <Path
              d={`M${CENTRE} ${CENTRE} L${CENTRE + RINGS[0]} ${CENTRE} A${RINGS[0]} ${RINGS[0]} 0 0 0 ${CENTRE + 79} ${CENTRE - 47} Z`}
              fill={theme.colors.primary}
              opacity={0.18}
            />
            <Path
              d={`M${CENTRE} ${CENTRE} L${CENTRE + RINGS[0]} ${CENTRE}`}
              stroke={theme.colors.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </AnimatedG>
        ) : null}

        {/* Le garage retenu, à sa vraie forme d'écusson. Le halo tient lieu de
            « contact en attente » : il bat, il ne s'allume pas. */}
        <AnimatedG opacity={animated ? (beat as unknown as number) : 1}>
          <Circle cx={garageX} cy={garageY - 11} r={19} fill={theme.colors.primaryTint} />
          <GarageBadge
            x={garageX}
            y={garageY}
            fill={certified ? theme.colors.primary : theme.colors.surface}
            stroke={certified ? undefined : theme.colors.ink}
          />
        </AnimatedG>

        {/* Cible centrale : vous. Reprise du logo, à l'identique. */}
        <Circle
          cx={CENTRE}
          cy={CENTRE}
          r={13}
          fill="none"
          stroke={theme.colors.primary}
          strokeWidth={4}
        />
        <Circle cx={CENTRE} cy={CENTRE} r={5} fill={theme.colors.primary} />
      </Svg>
    </View>
  );
}

/** Onde qui s'échappe du centre — même sémantique que le halo du bouton SOS. */
function Ripple({ value, color }: { value: Animated.Value; color: string }) {
  const radius = value.interpolate({ inputRange: [0, 1], outputRange: [14, 92] });
  const opacity = value.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 0.45, 0],
  });

  return (
    <AnimatedCircle
      cx={CENTRE}
      cy={CENTRE}
      r={radius as unknown as number}
      fill="none"
      stroke={color}
      strokeWidth={2}
      opacity={opacity as unknown as number}
    />
  );
}

/**
 * Écusson pentagonal, la géométrie de `<GarageMarker>` au point près :
 * `polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)`.
 *
 * `x` et `y` désignent la **pointe basse**, le point d'ancrage — comme sur la
 * carte, où c'est elle qui touche la coordonnée du garage.
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
  const width = 19;
  const height = 24;
  const shoulder = height * markerShape.shoulder;
  const left = x - width / 2;
  const top = y - height;

  return (
    <Path
      d={`M${left} ${top} h${width} v${shoulder} L${x} ${y} L${left} ${top + shoulder} Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? 2 : 0}
      strokeLinejoin="round"
    />
  );
}
