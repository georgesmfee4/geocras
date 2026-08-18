import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { usePreferences } from '../settings/preferences';
import { useTheme } from '../theme/ThemeProvider';
import { Switch } from '../ui/Switch';
import { Text } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';
import { CockpitHalo } from './CockpitHalo';
import { cockpitPalette } from './palette';

/**
 * Conversion du gabarit de référence.
 *
 * Les cotes de la maquette sont données depuis les bords d'un cadre de
 * 342 × 722 **chrome compris** : 52 points de barre d'état en haut, 82 de barre
 * d'onglets en bas. Il reste donc 588 points de scène entre les deux.
 *
 * Sur un vrai téléphone, ni le cadre ni le chrome n'ont ces valeurs : un
 * iPhone récent donne environ 681 points de scène, presque cent de plus. Poser
 * les cotes en points absolus revenait à empiler la composition en haut et à
 * laisser tout le surplus **sous le disque** — il flottait, la maquette non.
 *
 * L'axe vertical est donc exprimé en **fractions de la scène** : le rapport de
 * chaque bloc à la hauteur disponible est celui de la maquette, quelle que soit
 * la dalle. C'est la conversion demandée — les cotes ne sont pas recalculées,
 * elles sont rapportées au cadre réel.
 *
 * L'axe horizontal, lui, reste en points : une marge de 18 est une marge de 18,
 * elle ne s'étire pas avec la largeur de l'écran.
 */
const TEMPLATE_SCENE = 722 - 52 - 82;

/**
 * Une cote de la maquette, rapportée à la scène.
 *
 * La conversion est écrite plutôt que le résultat : un pourcentage posé en dur
 * se détache de la cote dont il vient dès qu'on touche à l'une des deux.
 */
const ratio = (offset: number): number => offset / TEMPLATE_SCENE;
const percent = (value: number): `${number}%` => `${Number((value * 100).toFixed(3))}%`;

/** `top: 88` dans la maquette, soit 36 sous la barre d'état. */
const TITLE_TOP = ratio(88 - 52);
/** `top: 296`. */
const DISC_TOP = ratio(296 - 52);
/** `bottom: 118`, barre d'onglets comprise. */
const SWITCHES_BOTTOM = ratio(118 - 82);

/**
 * Descente du bloc haut, en points.
 *
 * **Un écart assumé avec la maquette, et le seul.** Une fois la composition
 * rapportée à une vraie dalle, le titre et le disque tombaient encore un cran
 * trop haut ; vingt points les posent où le regard les attend. La valeur est un
 * réglage d'œil, pas une cote relevée — d'où la constante nommée plutôt qu'un
 * nombre glissé dans deux styles.
 *
 * Elle ne touche pas le bloc d'interrupteurs, qui est ancré au bas et déjà à sa
 * place : le descendre l'aurait collé à la barre d'onglets.
 */
const DESCENT = 20;

/**
 * Jeu minimal entre le bas du disque et le haut de la carte.
 *
 * La scène rétrécit avec la dalle, mais ni le disque ni les deux lignes ne
 * rétrécissent avec elle : sur un Android de 640 points — un format courant sur
 * le marché visé — il ne reste qu'une quinzaine de points entre les deux, et la
 * descente les mangerait. Elle est donc **rabotée à ce qui reste** plutôt
 * qu'appliquée de force : pleine partout où il y a la place, nulle là où il n'y
 * en a pas, jamais un disque à moitié caché derrière une carte.
 */
const MIN_GAP = 16;

/**
 * Diamètre du disque.
 *
 * La maquette le donne à 152. Il gagne seize points ici, à la demande : sur une
 * dalle réelle, plus large que le gabarit, la cible paraissait petite au milieu
 * de l'espace qui l'entoure. C'est le second et dernier écart avec la maquette,
 * et il ne change rien à ce que le disque **est** — même rouge, même rondeur,
 * même triangle.
 */
const DISC = 168;

/**
 * L'onde garde ses douze points de débord de part et d'autre, dérivés plutôt
 * que réécrits : un diamètre changé d'un côté sans l'autre décollerait l'onde
 * du bord du disque, et c'est ce raccord qui la fait lire comme une émission.
 */
const WAVE = DISC + 24;

/** Hauteur du bloc d'interrupteurs : deux lignes, un joint, deux filets. */
const ROW_HEIGHT = 54;
const CARD_HEIGHT = ROW_HEIGHT * 2 + 3;

/** L'onde est centrée sur le disque : elle déborde de la moitié de l'écart. */
const WAVE_INSET = (WAVE - DISC) / 2;

/** Cycle complet de l'onde, en millisecondes. */
const WAVE_MS = 2800;

export type IdleCockpitProps = { onStart: () => void };

/**
 * L'état de repos du mode conduite — « Prêt à conduire ? ».
 *
 * **Un seul composant, une seule structure, un seul jeu de positions.** Le
 * thème n'injecte que des couleurs, prises dans `cockpitPalette` et résolues
 * une fois en tête de fonction. Toute la géométrie vit dans le `StyleSheet` du
 * bas de fichier, où aucune valeur ne peut dépendre du thème — c'est ce qui
 * garantit qu'une régression de couleur ne devienne jamais une régression de
 * mise en page, et que les deux thèmes se superposent au pixel près.
 *
 * Trois pièges du mode clair sont traités à la racine plutôt que rattrapés :
 *
 *  1. Les rouges transparents sont **recalibrés par thème** au lieu d'être
 *     repris du sombre : `haloOpacity` baisse, l'ombre du disque passe du rouge
 *     vif à une encre grenat, l'onde monte légèrement.
 *  2. Le halo est un vrai **dégradé radial SVG** — voir `<CockpitHalo>`. Ni
 *     aplat, ni dégradé linéaire : la composition entière en dépend.
 *  3. La profondeur ne vient pas de la même chose des deux côtés. En sombre,
 *     c'est la lueur rouge ; en clair, une lueur rouge ferait une tache, et
 *     c'est une **seconde ombre neutre et courte** qui pose le disque sur le
 *     papier.
 *
 * Ce qui, lui, **ne bouge pas d'un thème à l'autre** : le disque rouge, son
 * triangle blanc, les deux filets du bandeau et la piste des interrupteurs
 * activés. Ce sont les ancres de la marque — on ne les « adapte » pas.
 */
export function IdleCockpit({ onStart }: IdleCockpitProps) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();

  /** Résolue **une seule fois**. Rien d'autre dans ce fichier ne lit le thème. */
  const c = cockpitPalette[scheme];

  const soundAlerts = usePreferences((state) => state.drivingSound);
  const setSoundAlerts = usePreferences((state) => state.setDrivingSound);
  const blindSpot = usePreferences((state) => state.drivingBlindSpot);
  const setBlindSpot = usePreferences((state) => state.setDrivingBlindSpot);

  const wave = useRef(new Animated.Value(0)).current;

  /**
   * Hauteur réelle de la scène, mesurée une fois.
   *
   * Elle ne sert qu'à raboter la descente sur les dalles courtes — jamais à
   * placer quoi que ce soit. La valeur de départ est la descente pleine : sur
   * tout appareil qui a la place, la mesure confirme ce qui est déjà affiché et
   * rien ne bouge à la première frame.
   */
  const [sceneHeight, setSceneHeight] = useState(0);

  /**
   * Ce qui sépare le bas du disque du haut de la carte, une fois le jeu minimal
   * réservé. Positif : la descente peut être servie, en tout ou en partie.
   * Négatif : la composition est déjà trop serrée pour cette dalle, et le bloc
   * haut **remonte** d'autant — un disque qui touche la carte est un défaut,
   * un disque vingt points plus haut n'en est pas un.
   */
  const room =
    sceneHeight * (1 - SWITCHES_BOTTOM) -
    CARD_HEIGHT -
    (sceneHeight * DISC_TOP + DISC) -
    MIN_GAP;

  const descent = sceneHeight === 0 ? DESCENT : Math.max(-40, Math.min(DESCENT, room));

  /**
   * L'onde ne tourne que lorsque l'écran est vu.
   *
   * `useIsFocused` et non un simple montage : un onglet quitté reste monté, et
   * une boucle qui continue derrière un autre écran consomme une frame sur deux
   * pour un pixel que personne ne regarde.
   *
   * Seuls `transform` et `opacity` sont animés, sur le fil natif. Jamais
   * `shadowRadius`, `shadowOpacity`, `elevation` ni une couleur : chacun de ces
   * trois-là force un repeint complet à chaque frame.
   */
  useEffect(() => {
    if (reducedMotion || !isFocused) {
      wave.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: WAVE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [wave, reducedMotion, isFocused]);

  /**
   * Mouvement réduit : l'onde se fige à sa taille de repos, très effacée. Le
   * disque doit rester parfaitement lisible — on retire le mouvement, pas le
   * signe.
   */
  const waveMotion = reducedMotion
    ? { opacity: 0.12, transform: [{ scale: 1 }] }
    : {
        opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
        transform: [
          { scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.65, 2] }) },
        ],
      };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      {/* Sans lui, l'heure et la batterie du système disparaissent en clair. */}
      <StatusBar style={c.statusBarStyle} />

      <CockpitHalo cy={0.42} red={c.haloRed} opacity={c.haloOpacity} edge={c.haloEdge} />

      {/*
        Zone sûre **haute seulement**. Au repos, la barre d'onglets est à
        l'écran : elle occupe déjà le bas de la dalle et absorbe elle-même
        l'encoche du bas. Réclamer ce même retrait ici l'aurait compté deux
        fois, et le bloc d'interrupteurs serait remonté de trente points sur les
        appareils à encoche — sur eux seulement, ce qui est la façon la plus
        discrète de casser une composition.

        `bottom: 36` se mesure donc bien depuis le haut de la barre d'onglets,
        exactement comme les 118 de la maquette, barre comprise.
      */}
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/*
          La scène — et la raison d'être de cette vue, qui ne dessine rien.

          Les trois blocs sont placés en fractions de hauteur ; il leur faut
          donc un parent dont la hauteur soit **exactement** la place
          disponible. Posés directement dans le `<SafeAreaView>`, ils auraient
          résolu leurs pourcentages sur une boîte qui porte encore le retrait de
          l'encoche, et la composition aurait glissé d'une quarantaine de points
          sur les appareils qui en ont une — sur eux seulement.
        */}
        <View
          style={styles.stage}
          onLayout={(event) => setSceneHeight(event.nativeEvent.layout.height)}
        >
          <View style={[styles.titleBlock, { marginTop: descent }]}>
            <View style={styles.eyebrow}>
            <View style={[styles.eyebrowRule, { backgroundColor: c.rule }]} />
            <Text variant="lblb" style={[styles.eyebrowLabel, { color: c.eyebrow }]}>
              {t('driving.mode')}
            </Text>
            <View style={[styles.eyebrowRule, { backgroundColor: c.rule }]} />
          </View>

          <Text variant="h1b" style={[styles.title, { color: c.title }]}>
            {t('driving.ready')}
          </Text>

          <Text variant="txt" style={[styles.body, { color: c.body }]}>
            {t('driving.readyLead')}
          </Text>
        </View>

        <View style={[styles.discBlock, { marginTop: descent }]}>
          <View style={styles.discAnchor}>
            {/*
              L'onde est **derrière** le disque : elle est déclarée avant lui,
              et rien ne la remonte. Elle déborde du cadre en grandissant, ce
              qui est voulu — aucun parent ne la rogne.
            */}
            <Animated.View
              pointerEvents="none"
              style={[styles.wave, { backgroundColor: c.wave }, waveMotion]}
            />

            {/*
              Deux vues empilées pour deux ombres : React Native n'en pose
              qu'une par vue. La première porte la lueur rouge, la seconde le
              contact neutre du thème clair — neutralisé à zéro en sombre, où la
              lueur suffit. La structure, elle, est la même des deux côtés.
            */}
            <View
              style={[
                styles.discGlowLayer,
                {
                  shadowColor: c.discGlow,
                  shadowOpacity: c.discGlowOpacity,
                  shadowOffset: { width: 0, height: c.discGlowY },
                  shadowRadius: c.discGlowBlur,
                  elevation: c.discGlowElevation,
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  // `void` : un appareil sans moteur haptique rejette la
                  // promesse, et ce n'est pas une raison pour ne pas démarrer.
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  onStart();
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t('driving.start')}. ${t('driving.readyLead')}`}
                style={({ pressed }) => [
                  styles.disc,
                  {
                    shadowColor: c.discContact,
                    shadowOpacity: c.discContactOpacity,
                    shadowOffset: { width: 0, height: c.discContactY },
                    shadowRadius: c.discContactBlur,
                  },
                  pressed ? styles.discPressed : null,
                ]}
              >
                {/*
                  Le triangle est décalé vers la droite : son centre de gravité
                  tombe au tiers de sa base, et un triangle géométriquement
                  centré paraît collé au bord gauche du disque.
                */}
                {/*
                  Le triangle suit le disque : 32 × 26 sur 152, il passe à
                  35 × 29 sur 168. Le laisser à sa taille aurait fait grandir le
                  vide autour de lui, pas le bouton.
                */}
                <Svg width={35} height={29} viewBox="0 0 35 29" style={styles.play}>
                  <Polygon points="0,0 35,14.5 0,29" fill="#FFFFFF" />
                </Svg>

                <Text variant="btn" style={styles.discLabel}>
                  {t('driving.start')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.card, { borderColor: c.cardBorder }]}>
          <SettingRow
            label={t('driving.soundAlerts')}
            value={soundAlerts}
            onChange={setSoundAlerts}
            background={c.card}
            labelColor={c.rowLabel}
          />
          <View style={[styles.separator, { backgroundColor: c.cardSeparator }]} />
          <SettingRow
            label={t('driving.blindSpot')}
            value={blindSpot}
            onChange={setBlindSpot}
            background={c.card}
            labelColor={c.rowLabel}
          />
          </View>
        </View>
      {/* fin de la scène */}
      </SafeAreaView>
    </View>
  );
}

/**
 * Une ligne d'interrupteur.
 *
 * Toute la ligne bascule le réglage : viser une piste de 42 points au pouce est
 * une exigence inutile quand cinquante-quatre points de haut peuvent recevoir
 * le doigt. L'appui se signale par l'opacité et non par un fond — un fond
 * demanderait une couleur de plus, qui n'est pas à la maquette.
 */
function SettingRow({
  label,
  value,
  onChange,
  background,
  labelColor,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  background: string;
  labelColor: string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, { backgroundColor: background }, pressed ? styles.rowPressed : null]}
    >
      <Text
        variant="h2b"
        style={[styles.rowLabel, { color: labelColor }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>

      {/* L'interrupteur ne capte pas le geste : la ligne l'a déjà pris. */}
      <View pointerEvents="none">
        <Switch value={value} onValueChange={onChange} />
      </View>
    </Pressable>
  );
}

/**
 * Toute la géométrie de l'écran, et rien d'autre.
 *
 * Aucune valeur ici ne dépend du thème — c'est la garantie mécanique du test de
 * superposition. Les seules couleurs admises sont celles qui **ne changent
 * jamais de thème** : le rouge de la marque et le blanc posé dessus.
 */
const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },

  /**
   * La scène : exactement la place disponible entre l'encoche et la barre
   * d'onglets, sans rembourrage propre. C'est la hauteur sur laquelle les trois
   * blocs résolvent leurs fractions — d'où l'interdiction d'y poser quoi que ce
   * soit qui la réduise.
   */
  stage: { flex: 1 },

  titleBlock: {
    position: 'absolute',
    top: percent(TITLE_TOP),
    left: 0,
    right: 0,
    paddingHorizontal: 34,
    alignItems: 'center',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  eyebrowRule: { width: 14, height: 2 },
  eyebrowLabel: { fontSize: 10, lineHeight: 12, letterSpacing: 1.8 },

  title: { fontSize: 25.1, lineHeight: 30, textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 13, lineHeight: 21, textAlign: 'center' },

  discBlock: { position: 'absolute', top: percent(DISC_TOP), left: 0, right: 0, alignItems: 'center' },
  discAnchor: { width: DISC, height: DISC },

  wave: {
    position: 'absolute',
    top: -WAVE_INSET,
    left: -WAVE_INSET,
    width: WAVE,
    height: WAVE,
    borderRadius: WAVE / 2,
  },

  // Les deux couches du disque portent le même aplat : empilées, elles ne font
  // qu'un objet, et chacune peut porter son ombre.
  discGlowLayer: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: '#E53935',
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discPressed: { opacity: 0.88 },
  play: { marginLeft: 9, marginBottom: 9 },
  discLabel: { fontSize: 15.3, lineHeight: 18, letterSpacing: 2.1, textAlign: 'center', color: '#FFFFFF' },

  card: {
    position: 'absolute',
    bottom: percent(SWITCHES_BOTTOM),
    left: 18,
    right: 18,
    // Toujours un point d'épaisseur, dans les deux thèmes : seule la couleur
    // change. Un filet qui n'existerait qu'en clair décalerait le contenu d'un
    // point d'un thème à l'autre.
    borderWidth: 1,
  },
  row: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  rowPressed: { opacity: 0.75 },
  rowLabel: { flex: 1, fontSize: 13, lineHeight: 16 },
  separator: { height: 1 },
});
