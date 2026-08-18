import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Logo } from './Logo';
import { useReducedMotion } from './useReducedMotion';

/** Diamètre du halo, en multiples du côté de la marque. */
const HALO_RATIO = 2.05;

/** Diamètre du second anneau, en fraction du halo. */
const INNER_RATIO = 0.74;

/**
 * Marque animée des écrans d'authentification.
 *
 * La cible du logo n'est pas un ornement : c'est une position relevée sur une
 * carte, le sujet même du produit. Elle se comporte donc ici comme une visée,
 * et tout ce qu'elle fait répond à un état réel du formulaire — rien ne bouge
 * pour décorer :
 *
 * - **elle se resserre** à mesure que les champs se remplissent : les deux
 *   anneaux se rapprochent de la marque et gagnent en densité, `progress`
 *   passant de 0 à 1 ;
 * - **elle se verrouille** quand le formulaire devient envoyable : une onde
 *   part, la marque a un bref ressaut. C'est le moment précis où le bouton
 *   s'active, dit une seconde fois et ailleurs qu'au bas de l'écran ;
 * - **elle balaie** pendant que la requête est en vol, comme une acquisition —
 *   le même geste que les ondes du splash, et pour la même raison : on ne
 *   connaît pas l'avancement réel, une barre qui se remplirait mentirait ;
 * - **elle sursaute** à chaque échec, une fois, sur l'axe horizontal.
 *
 * Tout passe par le pilote natif : opacité et transformations uniquement,
 * aucune propriété de mise en page n'est animée. Le formulaire reste donc
 * fluide pendant la frappe, y compris sur les téléphones d'entrée de gamme qui
 * sont le parc réel du produit.
 *
 * Sous « réduire les animations », il ne reste que le resserrement — c'est le
 * seul mouvement qui porte une information (« il manque encore quelque
 * chose »), et il est instantané. Les boucles et la secousse disparaissent.
 */
export type AuthMarkProps = {
  /** Côté de la marque, en points. Le halo s'en déduit. */
  size: number;
  /** Avancement du formulaire, de 0 à 1. */
  progress: number;
  /** Requête en vol. */
  busy?: boolean;
  /** Nombre d'échecs depuis l'ouverture — chaque incrément secoue la marque. */
  failures?: number;
};

export function AuthMark({ size, progress, busy = false, failures = 0 }: AuthMarkProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  const halo = Math.round(size * HALO_RATIO);
  const inner = Math.round(halo * INNER_RATIO);

  const entrance = useRef(new Animated.Value(0)).current;
  const aim = useRef(new Animated.Value(progress)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const lock = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const locked = progress >= 1;

  useEffect(() => {
    const anim = Animated.timing(entrance, {
      toValue: 1,
      duration: reduced ? 0 : 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [entrance, reduced]);

  useEffect(() => {
    // Le resserrement suit la frappe : court, sans rebond. Un ressort ici
    // ferait osciller les anneaux à chaque caractère du mot de passe.
    const anim = Animated.timing(aim, {
      toValue: progress,
      duration: reduced ? 0 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [aim, progress, reduced]);

  useEffect(() => {
    if (!locked || reduced) return;

    const anim = Animated.parallel([
      Animated.sequence([
        Animated.timing(lock, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lock, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(wave, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    anim.start(() => wave.setValue(0));
    return () => anim.stop();
  }, [locked, reduced, lock, wave]);

  useEffect(() => {
    if (!busy || reduced) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Retour instantané : l'onde repart du centre, elle ne revient pas en
        // arrière. Une boucle aller-retour ferait respirer, pas balayer.
        Animated.timing(wave, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => {
      loop.stop();
      wave.setValue(0);
    };
  }, [busy, reduced, wave]);

  useEffect(() => {
    // Zéro à l'ouverture : rien ne secoue au montage, seul un échec réel le
    // fait. La dépendance est le compteur et non le message, pour que deux
    // refus identiques d'affilée se voient tous les deux.
    if (failures === 0 || reduced) return;

    const beat = (toValue: number, duration: number) =>
      Animated.timing(shake, {
        toValue,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });

    const anim = Animated.sequence([beat(-1, 60), beat(1, 80), beat(-0.5, 70), beat(0, 90)]);
    anim.start();
    return () => anim.stop();
  }, [failures, reduced, shake]);

  /**
   * La marque elle-même est mémoïsée.
   *
   * `progress` change à **chaque caractère tapé**, et ce composant se rend donc
   * autant de fois. Sans ça, les deux SVG du logo — le chamfer et la cible —
   * seraient reconstruits à chaque frappe du mot de passe pour un résultat
   * strictement identique. Les enveloppes animées, elles, ne coûtent rien : ce
   * sont des transformations posées sur le fil natif.
   */
  const mark = useMemo(() => <Logo variant="dark" size={size} />, [size]);

  /** Anneau : un trait d'un point, tout le reste est vide. */
  const ring = {
    position: 'absolute' as const,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  };

  return (
    <View
      style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          ring,
          {
            width: halo,
            height: halo,
            borderRadius: halo / 2,
            opacity: aim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.5] }),
            transform: [{ scale: aim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) }],
          },
        ]}
      />

      <Animated.View
        style={[
          ring,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            opacity: aim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.3] }),
            transform: [{ scale: aim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }],
          },
        ]}
      />

      {/*
        L'onde. Elle part au ras de la marque et s'éteint avant le bord du
        halo : l'opacité monte d'un coup puis retombe sur toute la course, ce
        qui donne un front net et une traîne — l'inverse d'un cercle qui
        grandit en fondu.
      */}
      <Animated.View
        style={[
          ring,
          {
            width: halo,
            height: halo,
            borderRadius: halo / 2,
            opacity: wave.interpolate({
              inputRange: [0, 0.14, 1],
              outputRange: [0, 0.45, 0],
            }),
            transform: [
              { scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.52, 1.2] }) },
            ],
          },
        ]}
      />

      {/*
        Deux enveloppes et non une : l'entrée et la réaction ne se composent pas
        dans la même liste de transformations sans se marcher dessus — une
        secousse pendant l'apparition remettrait l'échelle d'entrée à plat.
      */}
      <Animated.View
        style={{
          opacity: entrance,
          transform: [
            { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        }}
      >
        <Animated.View
          style={{
            transform: [
              { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) },
              { scale: lock.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
            ],
          }}
        >
          {mark}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
