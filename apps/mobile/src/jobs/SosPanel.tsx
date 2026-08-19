import { useEffect, useRef } from 'react';
import { Animated, Image, View } from 'react-native';
import { PROBLEM_LABELS, VEHICLE_LABELS, type Job } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { ChamferView } from '../ui/ChamferView';
import { ChevronRightSmallIcon } from '../ui/icons';
import { PressableScale } from '../ui/PressableScale';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';
import { ListeningPulse } from './ListeningPulse';
import { firstToHandle, longestWaitStart, queueMix, type QueueSegment } from './queue';
import { urgencyColor, UrgencyTag } from './UrgencyTag';
import { WaitingClock } from './WaitingClock';

/** Côté de la vignette de panne dans l'aperçu. */
const THUMB = 48;

/**
 * Épaisseur de la jauge de composition, au bord bas du panneau.
 *
 * Deux points : c'est l'épaisseur d'un filet, pas d'une barre. À quatre, elle
 * se lisait comme un bandeau de couleur posé sous le panneau ; à deux, elle
 * n'est plus qu'une ligne qui a changé de teinte, ce qui est exactement son
 * propos.
 */
const GAUGE = 2;

export type SosPanelProps = {
  incoming: readonly Job[];
  /** Détection ouverte : le garage apparaît dans les recherches. */
  open: boolean;
  /** Ouvre la file SOS. */
  onOpenQueue: () => void;
  /** Ouvre « Mon garage » — la seule porte pour rouvrir la détection. */
  onOpenGarage: () => void;
};

/**
 * Le panneau qui commande le poste de travail.
 *
 * Il remplace les deux tuiles de service de la première version, et la raison
 * est une question de rang : SOS et Radar y occupaient la même surface alors
 * que l'un porte tout le travail du garage et que l'autre n'ouvre rien.
 *
 * Ce qui le met au premier plan n'est **ni le noir ni la taille**, mais deux
 * choses plus discrètes :
 *
 *  - **la largeur** — il touche les deux bords quand tout le reste de la page
 *    est en retrait de seize points ;
 *  - **la matière** — il est la seule surface pleine de l'écran. Les
 *    engagements sont des boîtes au trait posées sur le fond de page, le Radar
 *    n'a même pas de cadre. La hiérarchie se lit dans ce que les blocs *sont*,
 *    pas dans leur poids d'encre.
 *
 * Le rouge n'y est plus un aplat mais un tracé : le filet de section, le
 * contour chamfré du compteur, le chiffre lui-même. Il ne repasse à l'aplat
 * qu'à une condition, et elle est méritée — un danger déclaré dans la file.
 *
 * Trois états, trois dessins — jamais le même en grisé :
 *
 *  - **file pleine** → le relevé : compteur, attente la plus longue, et la
 *    demande à prendre en premier ;
 *  - **file vide, détection ouverte** → le cadran de veille, qui bat ;
 *  - **file vide, détection fermée** → le même cadran, ondes arrêtées, et il
 *    mène à « Mon garage » puisque c'est la seule chose à y faire.
 */
export function SosPanel({ incoming, open, onOpenQueue, onOpenGarage }: SosPanelProps) {
  if (incoming.length > 0) {
    return <QueueSlab incoming={incoming} onPress={onOpenQueue} />;
  }
  return <WatchStrip open={open} onPress={onOpenGarage} />;
}

/**
 * File pleine : le relevé.
 *
 * Une surface claire tenue par deux filets, et non plus une ardoise sombre.
 * Le noir plein donnait bien la hiérarchie, mais au prix d'une masse qui
 * écrasait la page entière et qui, la nuit, allumait un rectangle d'encre en
 * haut de l'écran. La même hiérarchie tient ici avec un filet d'un pixel,
 * quatre-vingts points de blanc et un seul chiffre — c'est moins de moyens
 * pour le même résultat, ce qui est la définition d'un dessin plus fin.
 */
function QueueSlab({ incoming, onPress }: { incoming: readonly Job[]; onPress: () => void }) {
  const theme = useTheme();
  const { t, locale, formatDistance, formatDuration } = useI18n();
  const reducedMotion = useReducedMotion();

  const count = incoming.length;
  const oldest = longestWaitStart(incoming);
  const first = firstToHandle(incoming);
  const mix = queueMix(incoming);

  /**
   * Un danger dans la file, et le compteur passe à l'aplat.
   *
   * C'est la seule chose qui rallume du rouge plein sur cet écran, et elle est
   * gagnée : quelqu'un a déclaré un danger. Le reste du temps le compteur est
   * un contour, ce qui laisse à l'aplat sa valeur d'alarme — un rouge posé
   * partout ne prévient plus de rien.
   */
  const alarming = incoming.some((job) => job.urgency === 'danger');

  /**
   * Le compteur tressaille quand la file **grandit**.
   *
   * Un SOS arrive pendant que le garagiste regarde son écran : sans ce
   * mouvement, le seul indice serait un chiffre qui n'est plus le même, ce qui
   * ne se remarque pas. À la baisse, rien — une demande qu'on vient de prendre
   * n'a pas à réclamer l'attention une seconde fois.
   *
   * Six pour cent, et deux ressorts amortis : le battement se sent du coin de
   * l'œil sans qu'on ait l'impression que le bloc a sauté.
   */
  const pulse = useRef(new Animated.Value(1)).current;
  const previous = useRef(count);

  useEffect(() => {
    const grew = count > previous.current;
    previous.current = count;
    if (!grew || reducedMotion) return;

    const beat = Animated.sequence([
      Animated.spring(pulse, {
        toValue: 1.06,
        useNativeDriver: true,
        stiffness: 240,
        damping: 16,
        mass: 0.7,
      }),
      Animated.spring(pulse, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 180,
        damping: 22,
        mass: 0.8,
      }),
    ]);
    beat.start();
    return () => beat.stop();
  }, [count, pulse, reducedMotion]);

  const problem = first ? PROBLEM_LABELS[first.problemType][locale] : null;
  const vehicle = first
    ? (first.vehicleLabel ?? first.client.vehicleLabel ?? VEHICLE_LABELS[first.vehicleType][locale])
    : null;
  const photo = first?.photos[0];

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        first && problem
          ? `${count} ${t('jobs.queueLabel')}. ${t('jobs.firstToHandle')} : ${problem}, ${formatDistance(first.distanceM)}.`
          : `${count} ${t('jobs.queueLabel')}`
      }
    >
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: theme.colors.rule,
        }}
      >
        <View style={{ padding: theme.space.xl, gap: theme.space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <SectionLabel style={{ flexShrink: 1 }}>{t('jobs.queueLabel')}</SectionLabel>
            <View style={{ flex: 1 }} />
            <ChevronRightSmallIcon color={theme.colors.inkSecondary} size={16} />
          </View>

          {/*
            Le relevé : le compteur et l'attente, côte à côte et alignés sur
            leur ligne de base. Deux chiffres, deux intitulés de onze points —
            c'est la mise en page d'un cadran, et c'est ce qui remplace le gros
            bloc noir sans rien perdre de ce qu'il disait.
          */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.xl }}>
            {/*
              Le compteur est chamfré parce que c'est un badge chiffré : le
              cahier des charges réserve l'angle coupé aux badges et aux
              actions, et l'interdit sur les surfaces de contenu comme le
              panneau lui-même.
            */}
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <ChamferView
                fill={alarming ? theme.colors.primary : 'transparent'}
                borderColor={theme.colors.primary}
                borderWidth={alarming ? 0 : 1}
                contentStyle={{
                  minWidth: 62,
                  paddingHorizontal: theme.space.md,
                  paddingTop: theme.space.xs,
                  // Plus d'air en bas qu'en haut : l'angle coupé mange le coin
                  // inférieur droit, et un deuxième chiffre viendrait se ranger
                  // juste sous la coupe.
                  paddingBottom: theme.space.md,
                  alignItems: 'center',
                }}
              >
                <Text
                  variant="numLg"
                  style={{ color: alarming ? theme.colors.onHero : theme.colors.primary }}
                >
                  {count}
                </Text>
              </ChamferView>
            </Animated.View>

            {oldest ? (
              <View style={{ flex: 1, gap: theme.space.xs, paddingBottom: theme.space.xs }}>
                <Text variant="lblb" tone="secondary" numberOfLines={1}>
                  {t('jobs.oldestWaiting')}
                </Text>
                {/*
                  Le compteur tourne à la seconde et dans le temps du serveur —
                  c'est exactement le chiffre que le client regarde de son côté,
                  sur son écran d'attente. Deux horloges qui divergeraient d'une
                  seconde suffiraient à faire douter des deux.
                */}
                <WaitingClock since={oldest} variant="num" />
              </View>
            ) : null}
          </View>

          {first && problem ? (
            <View style={{ gap: theme.space.md }}>
              <View style={{ height: 1, backgroundColor: theme.colors.rule }} />

              {/*
                L'étiquette d'urgence est posée sur l'intitulé, pas sur la ligne
                d'aperçu. Deux raisons, et la seconde est la vraie : elle
                qualifie **la demande qu'on annonce**, donc son titre ; et sur un
                écran de trois cent vingt points, la mettre en tête de l'aperçu
                ne laissait plus quatre-vingts points au nom de la panne, qui est
                pourtant ce qu'on est venu lire.

                Pas de filet rouge devant : le panneau en a déjà un sur son
                intitulé, et deux dans le même bloc feraient lire deux sections
                là où il n'y en a qu'une.
              */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
                <Text variant="lblb" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {t('jobs.firstToHandle')}
                </Text>
                <View style={{ flex: 1 }} />
                <UrgencyTag urgency={first.urgency} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
                {/*
                  La photo de la panne quand il y en a une : un pare-chocs
                  enfoncé dit en une image ce qu'une description dit mal. Sa
                  place n'est pas réservée en son absence — un carré vide ferait
                  un trou dans l'aperçu.
                */}
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    style={{ width: THUMB, height: THUMB }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : null}

                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="h2b" numberOfLines={1}>
                    {problem}
                  </Text>
                  <Text variant="txt" tone="secondary" numberOfLines={1}>
                    {`${first.client.fullName} · ${vehicle}`}
                  </Text>
                </View>

                {/* La distance en encre, l'approche en gris : c'est sur le
                    premier des deux qu'on décide d'y aller, le second ne fait
                    que le préciser. */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="num">{formatDistance(first.distanceM)}</Text>
                  <Text variant="numSm" tone="secondary">
                    {formatDuration(first.etaMin)}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <QueueGauge mix={mix} />
      </View>
    </PressableScale>
  );
}

/**
 * De quoi la file est faite, au bord bas du panneau.
 *
 * Deux points de haut, sans piste ni graduation : les tranches se partagent
 * toute la largeur, donc leur proportion **est** le dessin. Trois demandes dont
 * un danger ne se lisent pas comme trois dangers, et le compteur seul ne fait
 * pas cette différence.
 *
 * Ce n'est pas un graphique de tableau de bord : ni axe, ni légende, ni
 * chiffre. Il vaut par le fait qu'on ne le lit pas — on le voit.
 */
function QueueGauge({ mix }: { mix: readonly QueueSegment[] }) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  if (mix.length === 0) return null;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${t('jobs.queueMix')} : ${mix
        .map((segment) => `${segment.count} ${urgencyWord(segment.urgency, locale)}`)
        .join(', ')}`}
      style={{ flexDirection: 'row', height: GAUGE }}
    >
      {mix.map((segment) => (
        <View
          key={segment.urgency}
          style={{
            flex: segment.count,
            backgroundColor: urgencyColor(segment.urgency, theme.colors),
          }}
        />
      ))}
    </View>
  );
}

/**
 * Le mot d'un niveau d'urgence, pour le seul lecteur d'écran.
 *
 * En minuscules, contrairement à `URGENCY_LABELS` du contrat partagé : ces
 * libellés-là sont écrits pour une étiquette, et une synthèse vocale lit une
 * capitale isolée lettre par lettre.
 */
function urgencyWord(urgency: Job['urgency'], locale: 'fr' | 'en'): string {
  const words = {
    danger: { fr: 'danger', en: 'danger' },
    blocking: { fr: 'bloquant', en: 'blocking' },
    can_wait: { fr: 'peut attendre', en: 'can wait' },
  } as const;
  return words[urgency][locale];
}

/**
 * File vide : le bandeau de veille.
 *
 * Volontairement calme, et surtout **court** : c'est l'état normal d'un garage
 * la plupart de la journée, pas un incident à annoncer. Il garde la largeur à
 * fond perdu du relevé pour que le passage d'un état à l'autre ne déplace pas
 * la page.
 *
 * La séparation verticale entre le cadran et le texte n'est pas décorative :
 * elle sépare l'appareil de ce qu'il dit, comme sur un instrument.
 */
function WatchStrip({ open, onPress }: { open: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: theme.colors.rule,
      }}
    >
      <View style={{ padding: theme.space.xl }}>
        <ListeningPulse color={open ? theme.colors.success : theme.colors.warning} still={!open} />
      </View>

      <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: theme.colors.rule }} />

      <View
        style={{
          flex: 1,
          gap: theme.space.xs,
          paddingVertical: theme.space.xl,
          paddingHorizontal: theme.space.lg,
        }}
      >
        <Text variant="h1b">{open ? t('jobs.calmTitle') : t('jobs.closedTitle')}</Text>
        <Text variant="txt" tone="secondary">
          {open ? t('jobs.calmLead') : t('jobs.calmClosedLead')}
        </Text>

        {!open ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.xs,
              paddingTop: theme.space.xs,
            }}
          >
            <Text variant="btnSm" tone="primary">
              {t('jobs.reopenDetection')}
            </Text>
            <ChevronRightSmallIcon color={theme.colors.primary} size={14} />
          </View>
        ) : null}
      </View>
    </View>
  );

  /*
    Ouvert, le bandeau n'est qu'un état : rien à toucher, et un appui qui
    n'ouvrirait rien apprendrait à ne plus essayer. Fermé, il devient la porte
    de « Mon garage », seul endroit où la détection se rouvre.
  */
  if (open) return body;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.995}
      accessibilityRole="button"
      accessibilityLabel={`${t('jobs.closedTitle')}. ${t('jobs.reopenDetection')}`}
    >
      {body}
    </PressableScale>
  );
}
