import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/I18nProvider';
import { usePreferences } from '../settings/preferences';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';

export type ProximitySheetProps = {
  /** Distance mesurée entre les deux parties, en mètres. */
  distanceM: number | null;
  /** Le nom de celui qu'on cherche du regard. */
  otherName: string | null;
  /** Ce que la situation a de particulier, en une phrase. */
  lead: string;
  /** La question, en gros — c'est elle qu'on lit. */
  question: string;
  /** Libellé de la confirmation : « Oui, j'y suis », « Oui, il est là ». */
  confirmLabel: string;
  onConfirm: () => void;
  /** `null` quand le numéro de l'autre partie n'est pas connu. */
  onCall: (() => void) | null;
  onDismiss: () => void;
  busy?: boolean;
};

/**
 * La feuille du dernier mètre.
 *
 * Elle **prend la place de la barre d'action** au lieu de s'ajouter à elle :
 * deux actions cèdent la place à deux actions, on n'a jamais les quatre. Et
 * elle s'insère **dans le flux**, sous le panneau, qui reste donc entièrement
 * lisible — un client veut toujours savoir où en est son dépanneur, même quand
 * il est à cinquante mètres, et c'est même le moment où il y tient le plus.
 *
 * Elle existe pour supprimer une recherche, pas pour ajouter une étape. La
 * situation qu'elle traite est toujours la même des deux côtés : deux personnes
 * sur le même bout de route qui se cherchent, pendant que l'une des deux fait
 * défiler son écran pour retrouver un bouton « je suis arrivé ». La question
 * est posée d'elle-même, au moment où elle se pose vraiment, et la réponse
 * tient en un geste.
 *
 * « Pas encore » n'est pas un bouton d'annulation : c'est la réponse honnête à
 * une question fermée. L'app ne peut pas savoir si deux personnes se voient —
 * elle sait seulement quand la question vaut la peine d'être posée.
 */
export function ProximitySheet({
  distanceM,
  otherName,
  lead,
  question,
  confirmLabel,
  onConfirm,
  onCall,
  onDismiss,
  busy = false,
}: ProximitySheetProps) {
  const theme = useTheme();
  const { t, formatDistance } = useI18n();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const enter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  /**
   * Entrée, et un cran de vibration avec elle.
   *
   * Le téléphone du garagiste est sur un tableau de bord, celui du client dans
   * une poche pendant qu'il surveille sa voiture : ni l'un ni l'autre ne
   * regarde l'écran à la seconde où la feuille monte. Sans le retour tactile,
   * la question attendrait que quelqu'un pense à rouvrir l'app — c'est-à-dire
   * exactement le délai qu'on cherche à supprimer.
   */
  useEffect(() => {
    if (usePreferences.getState().haptics) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (reducedMotion) {
      enter.setValue(1);
      return;
    }

    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();

    // Montée jouée une seule fois : la feuille est démontée quand la proximité
    // se perd, donc un nouveau montage rejoue naturellement l'entrée.
  }, []);

  return (
    /*
      Dans le flux, et non en position absolue comme la barre d'action qu'elle
      remplace — c'est la seule chose qui garantisse que le panneau au-dessus
      reste entièrement lisible.

      `ActionBar` se pose en absolu et recouvre donc le bas de ce qui la
      précède ; elle est assez basse pour que ça passe. Cette feuille fait le
      double de haut : posée de la même façon, elle mangerait le temps de route
      et la distance au moment précis où l'on en a le plus besoin. En restant
      dans le flux, elle **pousse** le conteneur vers le haut au lieu de le
      couvrir.
    */
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
        ],
      }}
    >
      <View
        style={{
          backgroundColor: theme.colors.surface,
          // Les feuilles du bas sont le seul endroit du produit où le rayon
          // dépasse deux points — et seulement en haut : le bas est collé au
          // bord de l'écran.
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          borderTopWidth: 1,
          borderColor: theme.colors.rule,
          paddingHorizontal: theme.space.lg,
          paddingTop: theme.space.lg,
          paddingBottom: Math.max(insets.bottom, theme.space.md),
          gap: theme.space.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <SectionLabel style={{ flexShrink: 1 }}>{t('proximity.label')}</SectionLabel>
          <View style={{ flex: 1 }} />

          {otherName ? (
            <Text variant="txt" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {otherName}
            </Text>
          ) : null}

          {/*
            La distance en mono, et telle qu'elle est mesurée — pas « moins de
            120 m ». Elle bouge sous les yeux à mesure qu'on approche, et c'est
            elle qui rend la question crédible : un chiffre qui descend dit
            qu'on cherche au bon endroit.
          */}
          {distanceM !== null ? <Text variant="num">{formatDistance(distanceM)}</Text> : null}
        </View>

        <View style={{ gap: theme.space.xs }}>
          <Text variant="h1b">{question}</Text>
          <Text variant="txt" tone="secondary">
            {lead}
          </Text>
        </View>

        {/*
          Même grammaire que la barre d'action qu'elle remplace : joindre à
          gauche, l'engagement à droite, en rouge et chamfré. C'est la même paire
          de gestes, elle ne doit pas changer de place sous le pouce parce qu'on
          a changé de conteneur.

          Les proportions sont un cran plus égales que celles de la barre —
          1 : 1,3 au lieu de 1 : 1,45 — et l'écart entre les deux boutons est
          resserré. Raison de gabarit : les libellés sont en Bebas 17 avec deux
          points d'interlettrage, et sur un écran de trois cent vingt points la
          répartition de la barre laissait « Appeler » à une poignée de points de
          la troncature. Un bouton d'appel qui affiche « Appele… » au moment où
          quelqu'un cherche son dépanneur du regard n'est pas un défaut
          cosmétique.
        */}
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <Button
            label={t('proximity.call')}
            variant="outline"
            onPress={() => onCall?.()}
            disabled={onCall === null}
            chamfer="subtle"
            style={{ flex: 1 }}
          />
          <Button
            label={confirmLabel}
            variant="primary"
            onPress={onConfirm}
            loading={busy}
            chamfer="subtle"
            style={{ flex: 1.3 }}
          />
        </View>

        {/*
          Sortie discrète, et volontairement sans cadre : ce n'est pas une
          troisième action au même rang que les deux autres — la règle du
          produit est « deux actions, jamais trois » — mais la réponse négative
          à une question fermée.
        */}
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({
            alignSelf: 'center',
            paddingVertical: theme.space.sm,
            paddingHorizontal: theme.space.lg,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text variant="btnSm" tone="secondary">
            {t('proximity.dismiss')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

