import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { ALERT_LABELS, type AlertSeverity } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useDrivingStore, type LiveAlert } from '../stores/driving';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorScheme } from '../theme/tokens';
import { Text } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';
import { AlertGlyph } from './AlertGlyph';
import { ALERT_LIVE_MS, formatAlertAge } from './alertAge';
import { Measure } from './Measure';

/**
 * Trois lignes, pas une de plus.
 *
 * Ce n'est pas une liste, c'est un champ de vision. Une quatrième ligne ne
 * serait pas lue — elle prendrait la place qui fait que les trois premières le
 * sont. Le reste de la session part au serveur à l'arrêt, et se consulte
 * ailleurs, à l'arrêt.
 */
const VISIBLE = 3;

/** Gabarit d'une ligne. Fixe : rien ici ne doit pouvoir grandir. */
const ROW_HEIGHT = 64;

/** Épaisseur du bord gauche coloré — le signal de gravité de la ligne. */
const EDGE = 3;

/** Côté de la pastille carrée qui porte le pictogramme. */
const BADGE = 34;

/**
 * Creux du clignotement de l'alerte la plus récente, thème par thème.
 *
 * Sur le noir, s'effacer c'est s'éteindre : à 62 % la ligne recule sans jamais
 * cesser d'être lisible, et le battement se voit du coin de l'œil. Sur le
 * papier, s'effacer c'est se **délaver** — la ligne se rapproche du fond, et
 * une alerte critique perdrait du contraste une seconde sur deux, sur le seul
 * écran du produit qui doit tenir en plein soleil.
 *
 * Le creux y est donc moins profond. Le battement reste perceptible parce qu'il
 * est régulier, pas parce qu'il est fort.
 */
const BLINK_TROUGH: Record<ColorScheme, number> = { dark: 0.62, light: 0.78 };

/**
 * La pile d'alertes.
 *
 * Elle se lit de haut en bas, la plus récente en tête : c'est l'ordre du
 * pare-brise, et l'inverse d'un fil de discussion. Une alerte y vit deux
 * âges — d'abord un **avertissement**, coloré par sa gravité et surmonté d'un
 * clignotement doux quand elle vient d'arriver ; puis une **trace**, grise et
 * datée, qui ne réclame plus rien mais dit ce qui vient de se passer.
 *
 * La bascule se fait sur l'âge et non sur le rang : deux alertes critiques
 * arrivées coup sur coup restent toutes deux rouges, et une alerte isolée finit
 * grise même si elle est encore la plus récente. C'est ce qui rend la couleur
 * lisible — elle dit « maintenant », pas « en premier ».
 *
 * **Rien n'y est tapotable.** Le cahier de reprise l'impose : pendant la
 * conduite, seuls Pause et Stop reçoivent le doigt.
 */
export function AlertStack() {
  const theme = useTheme();
  const { t } = useI18n();
  const alerts = useDrivingStore((state) => state.alerts);

  /**
   * Une horloge locale à 1 Hz, et non l'`elapsedMs` du store.
   *
   * Le store ne compte que le temps roulé, pauses exclues. Une pause de dix
   * minutes y laisserait donc une alerte affichant « il y a 12 s », ce qui est
   * faux — le temps, lui, a passé. C'est bien l'heure murale qui date une
   * alerte.
   */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (alerts.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: theme.space.lg }}>
        {/*
          L'absence d'alerte est le meilleur moment du trajet, pas un vide à
          combler : on l'écrit comme un état, sans pictogramme d'attente ni
          silhouette grise.
        */}
        <Text variant="txt" tone="secondary">
          {t('driving.watching')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.space.sm }}>
      {alerts.slice(0, VISIBLE).map((alert, index) => (
        <AlertRow
          key={alert.id}
          alert={alert}
          live={now - alert.occurredAt < ALERT_LIVE_MS}
          // Seule la plus récente clignote : deux lignes qui pulsent ensemble
          // ne signalent plus rien, elles agitent l'écran.
          newest={index === 0}
          now={now}
        />
      ))}
    </View>
  );
}

function AlertRow({
  alert,
  live,
  newest,
  now,
}: {
  alert: LiveAlert;
  live: boolean;
  newest: boolean;
  now: number;
}) {
  const theme = useTheme();
  const { locale, formatDistance } = useI18n();
  const reducedMotion = useReducedMotion();

  const scheme = theme.scheme;
  const blinking = live && newest && !reducedMotion;
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!blinking) {
      blink.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: BLINK_TROUGH[scheme],
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink, blinking, scheme]);

  /**
   * La gravité donne la couleur, l'âge décide si elle s'applique encore.
   *
   * `info` prend l'encre secondaire et non une troisième teinte : le rouge et
   * l'ambre valent parce qu'ils sont rares. Une alerte qui n'appelle aucune
   * manœuvre n'a pas à teindre la ligne.
   */
  const accentBySeverity: Record<AlertSeverity, string> = {
    critical: theme.colors.primary,
    warning: theme.colors.warning,
    info: theme.colors.inkSecondary,
  };

  const tintBySeverity: Record<AlertSeverity, string> = {
    critical: theme.colors.primaryTint,
    warning: theme.colors.highlightTint,
    info: theme.colors.surface,
  };

  /**
   * L'encre du pictogramme suit **l'aplat sur lequel il est peint**, pas le
   * thème.
   *
   * Le rouge et l'ambre sont identiques en clair comme en sombre : ce qui se
   * pose dessus doit l'être aussi, sans quoi le pictogramme s'inverserait d'un
   * thème à l'autre sur un fond qui, lui, n'a pas bougé. D'où du blanc écrit en
   * dur sur le rouge — comme partout ailleurs dans l'app sur l'aplat primaire —
   * et `onHighlight`, la seule encre sombre des deux thèmes, sur l'ambre.
   *
   * `info` est le seul cas où l'aplat suit le thème (`inkSecondary` est sombre
   * en clair et clair en sombre) : son encre le suit donc aussi, et `surface`
   * est exactement le jeton qui bascule avec lui.
   */
  const glyphBySeverity: Record<AlertSeverity, string> = {
    critical: '#FFFFFF',
    warning: theme.colors.onHighlight,
    info: theme.colors.surface,
  };

  const accent = live ? accentBySeverity[alert.severity] : theme.colors.rule;
  const background = live && newest ? tintBySeverity[alert.severity] : theme.colors.surface;

  const labels = ALERT_LABELS[alert.type][locale];

  /**
   * À droite, la distance tant que l'alerte vaut ; l'ancienneté une fois
   * qu'elle ne vaut plus.
   *
   * Les deux ne répondent pas à la même question. « 120 m » répond à « dans
   * combien de temps », et n'a de sens que devant soi. Passé l'événement, la
   * seule question qui reste est « c'était quand », et la distance d'alors
   * devient un chiffre qu'on lirait comme une consigne.
   */
  const secondary = live ? labels.subtitle : formatAlertAge(now - alert.occurredAt, locale);

  return (
    <Animated.View
      /*
        Une alerte passée s'efface par le **ton**, pas par l'opacité.

        La reprise demandait « opacité réduite », et c'était juste sur le noir :
        une ligne à 55 % y reste parfaitement lisible. Sur le papier, la même
        recette la fait disparaître — le gris discret y est déjà bas, et le
        voile achève ce qui restait de contraste, sur le seul écran du produit
        qui doit tenir en plein soleil.

        Le retrait est donc porté par ce qui ne coûte rien en lisibilité : bord
        gauche gris, pastille évidée au lieu de pleine, encre secondaire, et
        l'ancienneté à la place de la distance. Quatre signaux au lieu d'un
        voile — et une ligne qu'on peut encore lire quand on cherche ce qui
        vient de se passer.
      */
      style={{ opacity: blinking ? blink : 1 }}
      // Une alerte est **une** annonce : titre, précision, et la distance si
      // elle en a une. Découpée en trois arrêts, elle arriverait à l'oreille
      // dans le désordre — et une alerte lue en retard ne sert à rien.
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        live && alert.distanceM !== null
          ? `${labels.title}. ${secondary}. ${formatDistance(alert.distanceM)}`
          : `${labels.title}. ${secondary}`
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: ROW_HEIGHT,
          marginHorizontal: theme.space.lg,
          backgroundColor: background,
          // Le bord gauche est un **bord**, pas un liseré décoratif : il porte
          // toute la gravité de la ligne, et c'est la première chose qu'on voit
          // en balayant la pile du regard.
          borderLeftWidth: EDGE,
          borderLeftColor: accent,
          paddingLeft: theme.space.md,
          paddingRight: theme.space.lg,
          gap: theme.space.md,
        }}
      >
        {/*
          Pastille carrée : pleine tant que l'alerte vaut, en contour une fois
          qu'elle est passée. Carrée et non chamfrée — l'angle coupé appartient
          aux boutons d'action et aux badges de fidélité, pas à un état.
        */}
        <View
          style={{
            width: BADGE,
            height: BADGE,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: live ? accent : 'transparent',
            borderWidth: live ? 0 : 1,
            borderColor: theme.colors.rule,
          }}
        >
          <AlertGlyph
            type={alert.type}
            color={live ? glyphBySeverity[alert.severity] : theme.colors.muted}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            variant="h2b"
            tone={live ? 'ink' : 'secondary'}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {labels.title}
          </Text>
          <Text
            variant="txt"
            tone={live ? 'secondary' : 'muted'}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {secondary}
          </Text>
        </View>

        {live && alert.distanceM !== null ? (
          <Measure formatted={formatDistance(alert.distanceM)} variant="num" color={accent} />
        ) : null}
      </View>
    </Animated.View>
  );
}
