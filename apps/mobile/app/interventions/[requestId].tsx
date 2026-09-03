import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { JobDone } from '../../src/jobs/JobDone';
import { ServiceModeBand } from '../../src/ui/ServiceModeTag';
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

  /**
   * L'intervention vient d'être close **par notre propre confirmation**.
   *
   * Retenu ici parce que la file ne peut pas le dire : `closed` en est exclu,
   * donc la demande disparaît à la seconde où elle se termine. Sans ce
   * témoin, l'écran retombait sur son message d'absence et annonçait une
   * annulation du client là où le travail venait d'aboutir.
   *
   * La réponse du serveur est la seule source certaine : elle porte le statut
   * réellement atteint, et non une déduction sur ce qu'on croyait savoir.
   */
  const [justClosed, setJustClosed] = useState(false);

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

  /**
   * Accepter, et se retrouver **devant l'itinéraire**.
   *
   * L'acceptation laissait le garagiste sur la fiche qu'il venait de lire, avec
   * un bouton « Y aller » à presser pour obtenir la carte. Ce geste ne
   * décidait rien : quelqu'un qui vient d'accepter un dépannage a déjà décidé
   * d'y aller — c'est le sens du mot. Il ne servait qu'à faire réapparaître une
   * information qu'on aurait pu lui donner tout de suite.
   *
   * `push` et non `replace` : la fiche garde sa place dans la pile. Les photos
   * de la panne, la description du client et ses contraintes sont là-bas, et un
   * dépanneur y revient en cours de route — un retour doit les retrouver.
   */
  const onAccept = useCallback(() => {
    if (!job) return;
    void run(
      () => act.mutateAsync({ requestId: job.id, action: 'accept' }),
      () => {
        /*
          On n'ouvre l'itinéraire que si l'on part quelque part.

          En `at_garage` le garagiste ne bouge pas : lui pousser un écran de
          navigation vers le lieu de la panne l'enverrait chercher un client
          qui est déjà en train de venir. Il reste donc sur sa fiche, où la
          barre d'action lui dit qu'il attend — et où il retrouvera le bouton
          de confirmation quand le client sera là.
        */
        if (job.serviceMode === 'on_site') {
          router.push(`/interventions/route/${job.id}` as never);
        }
      },
    );
  }, [job, act, router, run]);

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
    void run(async () => {
      const updated = await confirmArrival.mutateAsync({
        requestId: job.id,
        position: fix ? { lat: fix.lat, lng: fix.lng } : null,
      });

      // Les deux parties ont confirmé : la demande est close et quitte la file.
      // On le sait par la réponse, avant même que la file ne se recharge.
      if (updated.status === 'closed') setJustClosed(true);
    });
  }, [job, confirmArrival, fix, run]);

  /**
   * Le dernier état connu du dossier.
   *
   * Une intervention close quitte la file : `job` retombe à `null` au moment
   * même où l'on veut nommer ce qui vient de se terminer. On retient donc la
   * dernière version vue — elle n'a pas à être fraîche, elle ne sert qu'à
   * rappeler de quelle panne et de quel client il s'agissait.
   */
  const lastJob = useRef<Job | null>(null);

  useEffect(() => {
    if (job) lastJob.current = job;
  }, [job]);

  const leaveToDesk = useCallback(() => {
    router.replace('/(drawer)/(tabs)/interventions' as never);
  }, [router]);

  /*
    L'ordre compte : la clôture se teste **avant** l'absence.

    Une demande close est justement une demande absente de la file. Tester
    l'absence d'abord ferait retomber toutes les fins d'intervention réussies
    dans le message d'erreur — c'est exactement le défaut qu'on corrige.
  */
  if (justClosed) {
    return <JobDone job={lastJob.current} onClose={leaveToDesk} />;
  }

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
            <AlertIcon color={theme.colors.onFill} size={16} />
            <Text variant="h2" style={{ color: theme.colors.onFill }}>
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

          {/*
            Qui se déplace, avant les chiffres.

            Placé ici et non plus bas parce qu'il **change la lecture du tableau
            de bord** : les mêmes 3,2 km sont une distance à parcourir dans un
            cas, la longueur du trajet que le client est en train de faire dans
            l'autre. Poser le bandeau après aurait laissé lire les chiffres une
            première fois de travers.
          */}
          <ServiceModeBand mode={job.serviceMode} />

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
          {...(action === 'confirm_arrival'
            ? {
                primary: {
                  label: t('jobs.confirmArrival'),
                  icon: CheckIcon,
                  onPress: onConfirmArrival,
                },
              }
            : action === 'en_route'
              ? {
                  primary: {
                    label: t('jobs.goThere'),
                    icon: ChevronRightIcon,
                    onPress: onNavigate,
                  },
                }
              : {
                  /*
                    Rien à faire : la barre porte une **attente**, pas un bouton
                    éteint. Le garagiste ne peut pas appuyer, donc rien ne doit
                    ressembler à un bouton — cf. `WaitingSlot`.

                    Deux attentes distinctes tombent ici, et les confondre sous
                    un même mot laisserait sans réponse la seule question qu'il
                    se pose : « et maintenant ? ». Son arrivée déjà confirmée,
                    on attend que le client en convienne. Sinon, c'est une
                    demande `at_garage` acceptée : on attend qu'il parte.
                  */
                  waiting: t(
                    job.garageArrivedAt !== null
                      ? 'jobs.awaitingClientShort'
                      : 'jobs.awaitingDeparture',
                  ),
                })}
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
      {/*
        La distance ne change pas de sens avec le mode — elle est symétrique —
        mais la durée, si : « approche » nomme un trajet que le garagiste ne
        fait pas en `at_garage`. Le chiffre reste le même, son intitulé dit de
        qui il parle.
      */}
      <Cell
        label={t(job.serviceMode === 'on_site' ? 'jobs.approach' : 'jobs.clientTrip')}
        value={`${job.etaMin} min`}
      />
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
      {/* 2,45:1 en Bebas 11 px sur fond clair : on remonte d'un cran. */}
      <Text variant="lblb" tone="secondary">
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
