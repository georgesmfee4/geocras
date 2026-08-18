import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../useReducedMotion';

/**
 * Les illustrations d'état.
 *
 * **Une grammaire, pas une banque d'images.** Trois dessins seulement, au trait,
 * dans la palette du produit : encre chaude pour la ligne, ambre pour ce qui
 * alerte, rouge pour ce qui a cassé, surface pour les pleins. Aucun ton
 * nouveau — c'est ce qui les fait appartenir à l'application plutôt qu'à une
 * bibliothèque d'illustrations achetée.
 *
 * Le trait est épais et les formes sont grandes : ces images apparaissent au
 * moment où quelque chose ne marche pas, souvent au bord d'une route et en
 * plein soleil. Une illustration fine et grise y disparaît exactement quand on
 * en a besoin.
 *
 * **Chacune bouge, et chacune bouge peu.** Le mouvement dit « l'application
 * n'est pas figée, elle vous a compris » — c'est sa seule fonction. Il est
 * lent, sans rebond, et il s'arrête net si le système demande de réduire les
 * animations : l'image reste alors parfaitement lisible, immobile.
 *
 * Les propriétés SVG sont animées directement, comme `<EmptyRadius>` le fait
 * déjà. Le fil natif ne sait pas les porter, mais il n'y a jamais qu'une seule
 * de ces images à l'écran, sur une page qui ne défile pas.
 */

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Côté du dessin. Grand : c'est le sujet de l'écran, pas une vignette. */
const ART = 132;

export type StateArtProps = { size?: number };

/** Boucle aller-retour, lente. La respiration commune aux trois dessins. */
function useBreath(durationMs: number): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      value.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [value, durationMs, reducedMotion]);

  return value;
}

/**
 * **Signal perdu** — l'état `offline`.
 *
 * Des ondes qui partent d'un point et n'aboutissent pas : la plus lointaine est
 * rompue en son milieu, et une pastille ambrée marque l'interruption. C'est le
 * même vocabulaire d'ondes concentriques que la marque et que le bouton SOS,
 * retourné — ici l'émission ne porte plus.
 *
 * L'onde rompue respire seule : les deux premières tiennent, c'est la
 * troisième qui cherche. Le dessin raconte donc l'endroit exact de la panne.
 */
export function OfflineArt({ size = ART }: StateArtProps) {
  const theme = useTheme();
  const breath = useBreath(1400);

  /** Longueur de l'arc extérieur, pour poser la coupure en son milieu. */
  const outerArc = (Math.PI * 50) / 2;
  const gap = 22;
  const dash = (outerArc - gap) / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${ART} ${ART}`}>
        {/* Le point d'émission — la position de l'utilisateur. */}
        <Circle cx={66} cy={98} r={6} fill={theme.colors.ink} />

        {/* Deux ondes qui portent. */}
        <Path
          d="M 50.4 82.4 A 22 22 0 0 1 81.6 82.4"
          fill="none"
          stroke={theme.colors.ink}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          d="M 40.5 72.5 A 36 36 0 0 1 91.5 72.5"
          fill="none"
          stroke={theme.colors.ink}
          strokeWidth={5}
          strokeLinecap="round"
        />

        {/* Celle qui ne porte plus : rompue au sommet, et qui cherche. */}
        <AnimatedG opacity={breath.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] })}>
          <Path
            d="M 30.6 62.6 A 50 50 0 0 1 101.4 62.6"
            fill="none"
            stroke={theme.colors.ink}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
          />
        </AnimatedG>

        {/* La pastille d'alerte, posée sur la coupure. */}
        <Circle cx={66} cy={30} r={17} fill={theme.colors.highlight} />
        <Rect x={63.6} y={21} width={4.8} height={12} rx={2.4} fill={theme.colors.onHighlight} />
        <Circle cx={66} cy={37.5} r={2.6} fill={theme.colors.onHighlight} />
      </Svg>
    </View>
  );
}

/**
 * **Quelque chose a cassé** — les états `error` et `not_found`.
 *
 * Un petit automate perplexe : tête pleine en encre, visage clair, yeux ambrés,
 * bouche rouge en zigzag — le seul rouge du dessin, posé exactement sur ce qui
 * ne va pas. Il penche légèrement, et son antenne oscille.
 *
 * Le choix du personnage n'est pas décoratif. Une erreur serveur n'est pas la
 * faute de l'utilisateur, et une icône d'avertissement le laisse pourtant
 * croire. Une machine qui ne comprend pas désigne le bon responsable.
 */
export function BrokenArt({ size = ART }: StateArtProps) {
  const theme = useTheme();
  const breath = useBreath(1900);

  const tilt = breath.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ width: '100%', height: '100%', transform: [{ rotate: tilt }] }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${ART} ${ART}`}>
          {/* Antenne, et sa boule ambrée. */}
          <Path
            d="M 66 34 C 66 22 78 24 78 16"
            fill="none"
            stroke={theme.colors.ink}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <AnimatedCircle
            cx={78}
            cy={breath.interpolate({ inputRange: [0, 1], outputRange: [15, 11] })}
            r={6}
            fill={theme.colors.highlight}
          />

          {/* Tête. */}
          <Rect
            x={30}
            y={34}
            width={72}
            height={54}
            rx={14}
            fill={theme.colors.ink}
          />
          {/* Visage : le seul plein clair, pour que les yeux portent. */}
          <Rect
            x={40}
            y={44}
            width={52}
            height={34}
            rx={9}
            fill={theme.colors.surface}
          />
          <Circle cx={54} cy={57} r={4.6} fill={theme.colors.highlight} />
          <Circle cx={78} cy={57} r={4.6} fill={theme.colors.highlight} />

          {/* Bouche en zigzag : le rouge, et rien que là. */}
          <Path
            d="M 52 69 l 6 -5 l 6 5 l 6 -5 l 6 5"
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Corps, à peine suggéré : c'est le visage qui parle. */}
          <Path
            d="M 44 88 v 12 a 10 10 0 0 0 10 10 h 24 a 10 10 0 0 0 10 -10 V 88"
            fill="none"
            stroke={theme.colors.ink}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * **Rien à afficher** — l'état `empty`.
 *
 * Un cercle en pointillé — le périmètre qu'on a fouillé — et son centre vide.
 * Aucun rouge, aucune alerte : un vide n'est pas une panne, et le peindre comme
 * telle apprend à l'utilisateur à se méfier de couleurs qui devraient
 * l'alarmer ailleurs.
 *
 * Le pointillé tourne très lentement, ce qui suffit à dire « on a bien
 * cherché » sans promettre que quelque chose est encore en route.
 */
export function EmptyArt({ size = ART }: StateArtProps) {
  const theme = useTheme();
  const breath = useBreath(4200);

  const spin = breath.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '24deg'] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{ position: 'absolute', width: '100%', height: '100%', transform: [{ rotate: spin }] }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${ART} ${ART}`}>
          <Circle
            cx={66}
            cy={66}
            r={48}
            fill="none"
            stroke={theme.colors.muted}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="10 14"
          />
        </Svg>
      </Animated.View>

      <Svg width="100%" height="100%" viewBox={`0 0 ${ART} ${ART}`}>
        <Circle cx={66} cy={66} r={27} fill="none" stroke={theme.colors.rule} strokeWidth={3} />
        <Circle cx={66} cy={66} r={7} fill={theme.colors.muted} />
      </Svg>
    </View>
  );
}
