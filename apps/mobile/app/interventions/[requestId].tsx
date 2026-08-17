import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  nextJobAction,
  PROBLEM_LABELS,
  VEHICLE_LABELS,
  type Job,
} from '@geocras/shared';
import {
  useConfirmJobArrival,
  useDeclineJob,
  useGarageJobs,
  useJobAction,
} from '../../src/api/hooks';
import { useI18n } from '../../src/i18n/I18nProvider';
import type { TranslationKey } from '../../src/i18n/translations';
import { ActionBar, useActionBarInset } from '../../src/ui/ActionBar';
import { JobLocationMap } from '../../src/jobs/JobLocationMap';
import { JobPhotos } from '../../src/jobs/JobPhotos';
import { UrgencyTag, urgencyColor } from '../../src/jobs/UrgencyTag';
import { WaitingClock } from '../../src/jobs/WaitingClock';
import { useLocation } from '../../src/location/LocationProvider';
import { usePreferences } from '../../src/settings/preferences';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../../src/theme/tokens';
import { Callout } from '../../src/ui/Callout';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  PhoneIcon,
  ShieldLockIcon,
  TowTruckIcon,
  AlertIcon,
} from '../../src/ui/icons';
import { PlateTag } from '../../src/ui/PlateTag';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Text } from '../../src/ui/Text';

/**
 * Le dossier d'une demande, vu du garagiste.
 *
 * L'écran est construit autour d'une seule question — **est-ce que j'y vais ?** —
 * et l'ordre de lecture est celui dans lequel on y répond : l'état du véhicule
 * en image, l'urgence, la panne, la distance, puis seulement le demandeur et le
 * lieu. Tout ce qui ne sert pas à décider descend.
 *
 * La barre d'action ne défile pas. C'est la différence entre une fiche qu'on
 * consulte et un poste de travail : la décision doit être à portée de pouce
 * quelle que soit la position du doigt dans la page.
 *
 * L'écran ne charge rien pour lui-même — il lit la demande dans la file déjà en
 * cache, que la poussée socket tient à jour. Une requête dédiée aurait donné
 * deux sources de vérité pour la même demande, et deux moments où elles
 * divergent.
 */
export default function JobDetailScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { t, locale, translateError } = useI18n();
  const { fix } = useLocation();

  const jobs = useGarageJobs();
  const act = useJobAction();
  const confirmArrival = useConfirmJobArrival();
  const decline = useDeclineJob();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const barInset = useActionBarInset();

  const job = useMemo(() => {
    const all = [...(jobs.data?.incoming ?? []), ...(jobs.data?.active ?? [])];
    return all.find((candidate) => candidate.id === requestId) ?? null;
  }, [jobs.data, requestId]);

  const buzz = useCallback((type: Haptics.NotificationFeedbackType) => {
    if (usePreferences.getState().haptics) void Haptics.notificationAsync(type);
  }, []);

  const run = useCallback(
    async (work: () => Promise<unknown>, onDone?: () => void) => {
      setError(null);
      setBusy(true);
      try {
        await work();
        buzz(Haptics.NotificationFeedbackType.Success);
        onDone?.();
      } catch (cause) {
        setError(translateError(cause));
        buzz(Haptics.NotificationFeedbackType.Error);
      } finally {
        setBusy(false);
      }
    },
    [buzz, translateError],
  );

  const onAccept = useCallback(() => {
    if (!job) return;
    void run(() => act.mutateAsync({ requestId: job.id, action: 'accept' }));
  }, [job, act, run]);

  /**
   * Refus.
   *
   * La confirmation ne demande pas « êtes-vous sûr ? » — elle **dit ce qui va
   * se passer** : le client est prévenu et repart vers un autre garage. C'est
   * la seule chose que le garagiste a besoin de savoir pour trancher, et elle
   * lève au passage la crainte légitime d'abandonner quelqu'un en panne.
   */
  const onDecline = useCallback(() => {
    if (!job) return;

    Alert.alert(t('jobs.declineTitle'), t('jobs.declineBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('jobs.decline'),
        style: 'destructive',
        onPress: () => {
          void run(
            () => decline.mutateAsync({ requestId: job.id, reason: t('jobs.declineReason') }),
            () => router.back(),
          );
        },
      },
    ]);
  }, [job, decline, router, run, t]);

  const onCall = useCallback(() => {
    if (job?.client.phone) void Linking.openURL(`tel:${job.client.phone}`);
  }, [job]);

  const onNavigate = useCallback(() => {
    if (job) router.push(`/interventions/route/${job.id}` as never);
  }, [job, router]);

  const onConfirmArrival = useCallback(() => {
    if (!job) return;
    void run(() =>
      confirmArrival.mutateAsync({
        requestId: job.id,
        position: fix ? { lat: fix.lat, lng: fix.lng } : null,
      }),
    );
  }, [job, confirmArrival, fix, run]);

  if (!job) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <BackButton />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.md }}>
          {jobs.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            /*
              La demande a quitté la file pendant qu'on la regardait : le client
              l'a annulée, ou un autre appareil du garage l'a traitée. On le dit
              — un écran vide laisserait croire à une panne de chargement.
            */
            <Text variant="txt" tone="secondary" style={{ textAlign: 'center', paddingHorizontal: theme.space.xxxl }}>
              {t('jobs.gone')}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const accepted = job.acceptedAt !== null;
  const action = nextJobAction(job);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: barInset + theme.space.xl }}>
        {/* — Bandeau photo, pleine largeur, sous la barre d'état — */}
        <JobPhotos photos={job.photos} label={PROBLEM_LABELS[job.problemType][locale]} />
        <BackButton floating />

        {/*
          Bandeau d'urgence pleine largeur, et seulement pour le danger.

          Le poser sur les trois niveaux en ferait un ornement permanent qu'on
          cesse de voir — donc précisément l'inverse d'une alerte.
        */}
        {job.urgency === 'danger' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.sm,
              backgroundColor: theme.colors.primary,
              paddingHorizontal: theme.space.lg,
              paddingVertical: theme.space.sm,
            }}
          >
            <AlertIcon color={theme.colors.surface} size={16} />
            <Text variant="h2" style={{ color: theme.colors.surface }}>
              {t('jobs.dangerBanner')}
            </Text>
          </View>
        ) : null}

        <View style={{ padding: theme.space.lg, gap: theme.space.xl }}>
          {/* — Ce dont il s'agit — */}
          <View style={{ gap: theme.space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              {job.urgency !== 'danger' ? <UrgencyTag urgency={job.urgency} /> : null}
              <Text variant="numSm" tone="muted">
                {t(STATE_LABELS[job.status] ?? 'jobs.stateOngoing')}
              </Text>
            </View>

            <Text variant="d1b">{PROBLEM_LABELS[job.problemType][locale]}</Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.md,
                flexWrap: 'wrap',
              }}
            >
              <Text variant="txt" tone="secondary">
                {job.vehicleLabel ??
                  job.client.vehicleLabel ??
                  VEHICLE_LABELS[job.vehicleType][locale]}
              </Text>
              {job.client.plate ? <PlateTag plate={job.client.plate} /> : null}
            </View>
          </View>

          {/* — Les trois chiffres qui décident — */}
          <Metrics job={job} />

          {job.description ? (
            <View style={{ gap: theme.space.sm }}>
              <SectionLabel>{t('jobs.words')}</SectionLabel>
              {/*
                Les mots du client, cités. Le filet à gauche marque que ce n'est
                pas le produit qui parle — un garagiste doit pouvoir faire la
                part entre une donnée et un témoignage.
              */}
              <View
                style={{
                  borderLeftWidth: 2,
                  borderLeftColor: theme.colors.rule,
                  paddingLeft: theme.space.md,
                }}
              >
                <Text variant="body">« {job.description} »</Text>
              </View>
            </View>
          ) : null}

          {job.immobilized || job.vulnerablePassengers ? (
            <View style={{ gap: theme.space.sm }}>
              <SectionLabel>{t('jobs.constraints')}</SectionLabel>
              <View style={{ gap: theme.space.sm }}>
                {job.immobilized ? (
                  <Constraint
                    icon={TowTruckIcon}
                    title={t('jobs.immobilized')}
                    lead={t('jobs.immobilizedLead')}
                    tone={theme.colors.ink}
                  />
                ) : null}
                {job.vulnerablePassengers ? (
                  <Constraint
                    icon={AlertIcon}
                    title={t('jobs.vulnerable')}
                    lead={t('jobs.vulnerableLead')}
                    tone={theme.colors.primary}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {/* — Le demandeur — */}
          <View style={{ gap: theme.space.sm }}>
            <SectionLabel>{t('jobs.requester')}</SectionLabel>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.md,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.rule,
                padding: theme.space.md,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: theme.colors.primaryTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="h1b" tone="primary">
                  {job.client.initials}
                </Text>
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h2b" numberOfLines={1}>
                  {job.client.fullName}
                </Text>
                {job.client.phone ? (
                  <Text variant="mono" tone="secondary">
                    {job.client.phone}
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
                    <ShieldLockIcon color={theme.colors.muted} size={13} />
                    <Text variant="txt" tone="muted">
                      {t('jobs.phoneHidden')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* — Où — */}
          <View style={{ gap: theme.space.sm }}>
            <SectionLabel>{t('jobs.where')}</SectionLabel>
            <JobLocationMap origin={job.origin} precise={job.originPrecise} />
          </View>

          {error ? (
            <Callout tone="danger" title={t('common.error')}>
              {error}
            </Callout>
          ) : null}
        </View>
      </ScrollView>

      {/*
        La paire d'actions change de nature à l'acceptation, et c'est le pivot
        de tout l'écran : avant, on arbitre ; après, on intervient. Les deux
        boutons occupent la même place et gardent la même grammaire — l'action
        d'engagement toujours à droite, en rouge — pour que le geste appris
        avant l'acceptation reste juste après.
      */}
      {accepted ? (
        <ActionBar
          busy={busy}
          secondary={{
            label: t('jobs.callClient'),
            icon: PhoneIcon,
            onPress: onCall,
            disabled: !job.client.phone,
          }}
          primary={
            action === 'confirm_arrival'
              ? { label: t('jobs.confirmArrival'), icon: CheckIcon, onPress: onConfirmArrival }
              : { label: t('jobs.goThere'), icon: ChevronRightIcon, onPress: onNavigate }
          }
        />
      ) : (
        <ActionBar
          busy={busy}
          secondary={{ label: t('jobs.decline'), icon: CloseIcon, onPress: onDecline }}
          primary={{ label: t('jobs.accept'), icon: CheckIcon, onPress: onAccept }}
        />
      )}
    </View>
  );
}

/**
 * Distance, durée d'approche, attente — les trois chiffres sur lesquels un
 * garagiste décide.
 *
 * Alignés en colonnes séparées par des filets, tous en mono à chiffres
 * tabulaires : c'est un tableau de bord, et un tableau de bord dont les
 * chiffres dansent d'une seconde à l'autre ne se lit pas d'un coup d'œil.
 */
function Metrics({ job }: { job: Job }) {
  const theme = useTheme();
  const { t, formatDistance } = useI18n();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        borderLeftWidth: 3,
        borderLeftColor: urgencyColor(job.urgency, theme.colors),
      }}
    >
      <Cell label={t('jobs.distance')} value={formatDistance(job.distanceM)} />
      <Divider />
      <Cell label={t('jobs.approach')} value={`${job.etaMin} min`} />
      <Divider />
      <Cell
        label={t('jobs.waiting')}
        node={<WaitingClock since={job.selectedAt ?? job.createdAt} variant="num" />}
      />
    </View>
  );
}

function Cell({
  label,
  value,
  node,
}: {
  label: string;
  value?: string;
  node?: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, padding: theme.space.md, gap: theme.space.xs }}>
      <Text variant="lblb" tone="muted">
        {label}
      </Text>
      {node ?? <Text variant="num">{value}</Text>}
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={{ width: 1, backgroundColor: theme.colors.rule }} />;
}

/**
 * Contrainte matérielle : ce qui change ce qu'on emporte.
 *
 * Titre **et** conséquence, pas seulement une étiquette. « Ne roule plus » se
 * comprend ; « prévoir le plateau ou la barre de remorquage » se prépare.
 */
function Constraint({
  icon: Icon,
  title,
  lead,
  tone,
}: {
  icon: (props: { color: string; size?: number }) => React.ReactNode;
  title: string;
  lead: string;
  tone: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.space.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        padding: theme.space.md,
      }}
    >
      <View style={{ paddingTop: 2 }}>{Icon({ color: tone, size: 18 })}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h2b" style={{ color: tone }}>
          {title}
        </Text>
        <Text variant="txt" tone="secondary">
          {lead}
        </Text>
      </View>
    </View>
  );
}

/**
 * Retour.
 *
 * En variante flottante au-dessus du bandeau photo : un en-tête plein
 * découperait l'image d'une bande de fond, et cette image est la première chose
 * qui informe. La pastille sombre garantit le contraste quelle que soit la
 * photo dessous — un chevron nu disparaît sur un capot clair.
 */
function BackButton({ floating = false }: { floating?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();

  const button = (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={t('common.close')}
      hitSlop={10}
      style={({ pressed }) => ({
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        margin: theme.space.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: floating ? theme.colors.overlay : 'transparent',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <ChevronLeftIcon color={floating ? theme.colors.surface : theme.colors.ink} />
    </Pressable>
  );

  if (!floating) return <SafeAreaView edges={['top']}>{button}</SafeAreaView>;

  return (
    <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0 }}>
      {button}
    </SafeAreaView>
  );
}

/** Ce qu'il reste à faire, du point de vue du garagiste. */
const STATE_LABELS: Partial<Record<Job['status'], TranslationKey>> = {
  selected: 'jobs.stateToAnswer',
  accepted: 'jobs.stateToLeave',
  en_route: 'jobs.stateDriving',
  awaiting_confirmation: 'jobs.stateToConfirm',
};
