import { Image, Pressable, View } from 'react-native';
import {
  PROBLEM_LABELS,
  VEHICLE_LABELS,
  type Job,
} from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { BlinkingDot } from '../ui/BlinkingDot';
import { CameraIcon, ChevronRightSmallIcon, MapPinIcon, TowTruckIcon } from '../ui/icons';
import { ServiceModeTag } from '../ui/ServiceModeTag';
import { Text } from '../ui/Text';
import { UrgencyTag, urgencyColor } from './UrgencyTag';
import { WaitingClock } from './WaitingClock';

/** Côté de la vignette photo. */
const THUMB = 62;

export type JobRowProps = {
  job: Job;
  onPress: () => void;
};

/**
 * Une demande dans la liste.
 *
 * La ligne répond à **trois questions dans l'ordre où on se les pose** quand un
 * SOS tombe : quelle panne, à quelle distance, depuis combien de temps ça
 * attend. Tout le reste — le nom du client, le modèle du véhicule, la
 * description — appartient au détail : c'est ce qu'on lit une fois qu'on a
 * décidé d'ouvrir, pas ce qui fait décider.
 *
 * Deux partis pris tiennent la lisibilité en plein soleil :
 *
 *  - **le filet d'urgence à gauche**, plein hauteur. L'œil trie la liste par la
 *    couleur avant de lire un mot ;
 *  - **la vignette de la photo** quand il y en a une. Un pare-chocs enfoncé dit
 *    en une image ce qu'une description de deux lignes dit mal, et son absence
 *    n'ouvre aucun trou : la place n'est réservée que si la photo existe.
 */
export function JobRow({ job, onPress }: JobRowProps) {
  const theme = useTheme();
  const { t, locale, formatDistance } = useI18n();

  const accent = urgencyColor(job.urgency, theme.colors);
  const waiting = job.status === 'selected';
  const photo = job.photos[0];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${PROBLEM_LABELS[job.problemType][locale]}, ${formatDistance(
        job.distanceM,
      )}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        minHeight: MIN_TOUCH_TARGET,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 4, backgroundColor: accent }} />

      <View style={{ flex: 1, flexDirection: 'row', gap: theme.space.md, padding: theme.space.md }}>
        {photo ? (
          <View style={{ width: THUMB, height: THUMB, backgroundColor: theme.colors.background }}>
            <Image
              source={{ uri: photo }}
              style={{ width: THUMB, height: THUMB }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            {job.photos.length > 1 ? (
              <View
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 2,
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  backgroundColor: theme.colors.overlay,
                }}
              >
                <CameraIcon color={theme.colors.onFill} size={10} />
                <Text variant="numSm" style={{ color: theme.colors.onFill }}>
                  {job.photos.length}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <UrgencyTag urgency={job.urgency} />
            {/*
              Rien en `on_site` — cf. `ServiceModeTag`. La ligne garde donc
              exactement sa silhouette actuelle dans le cas courant, et ne
              gagne un signe que là où le plan du garagiste change.
            */}
            <ServiceModeTag mode={job.serviceMode} />
            <View style={{ flex: 1 }} />
            {waiting ? (
              <WaitingClock since={job.selectedAt ?? job.createdAt} variant="numSm" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
                <BlinkingDot size={6} color={theme.colors.success} />
                <Text variant="numSm" tone="muted">
                  {t(STATUS_HINTS[job.status] ?? 'jobs.stateOngoing')}
                </Text>
              </View>
            )}
          </View>

          <Text variant="h1b" numberOfLines={1}>
            {PROBLEM_LABELS[job.problemType][locale]}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <MapPinIcon color={theme.colors.inkSecondary} size={13} />
            <Text variant="num">{formatDistance(job.distanceM)}</Text>
            <Text variant="numSm" tone="muted">
              ·
            </Text>
            <Text variant="num" tone="secondary">
              {job.etaMin} min
            </Text>

            {job.immobilized ? (
              <TowTruckIcon color={theme.colors.inkSecondary} size={14} />
            ) : null}

            <View style={{ flex: 1 }} />

            <Text variant="txt" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {job.vehicleLabel ??
                job.client.vehicleLabel ??
                VEHICLE_LABELS[job.vehicleType][locale]}
            </Text>

            <ChevronRightSmallIcon color={theme.colors.muted} size={14} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Ce qu'il reste à faire, en deux mots, sur une demande déjà engagée.
 *
 * Le libellé d'état du contrat partagé (`REQUEST_STATUS_LABELS`) est écrit du
 * point de vue du **client** — « Garagiste en route » n'apprend rien à celui
 * qui conduit. Ici on nomme l'action attendue de son côté.
 */
const STATUS_HINTS: Partial<Record<Job['status'], TranslationKey>> = {
  accepted: 'jobs.stateToLeave',
  en_route: 'jobs.stateDriving',
  awaiting_confirmation: 'jobs.stateToConfirm',
};

