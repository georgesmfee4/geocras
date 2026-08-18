import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PROBLEM_LABELS, type Job } from '@geocras/shared';
import { ApiError } from '../../../src/api/client';
import { useGarageJobs } from '../../../src/api/hooks';
import { useI18n } from '../../../src/i18n/I18nProvider';
import { ServiceTile } from '../../../src/jobs/ServiceTile';
import { urgencyColor } from '../../../src/jobs/UrgencyTag';
import { WaitingClock } from '../../../src/jobs/WaitingClock';
import { useJobFeedStore } from '../../../src/realtime/useJobFeed';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../../../src/theme/tokens';
import { BlinkingDot } from '../../../src/ui/BlinkingDot';
import { forceProbe } from '../../../src/api/reachability';
import { Callout } from '../../../src/ui/Callout';
import {
  AlertIcon,
  ChevronRightSmallIcon,
  CrosshairIcon,
  ShieldCheckIcon,
} from '../../../src/ui/icons';
import { SectionLabel } from '../../../src/ui/SectionLabel';
import { isTerminal, resolveLoadState } from '../../../src/ui/loadState';
import { StateView } from '../../../src/ui/StateView';
import { Text } from '../../../src/ui/Text';

/**
 * Poste de travail du garagiste.
 *
 * L'onglet n'est pas une liste de demandes : c'est le **point d'entrée de deux
 * métiers différents**, et c'est ce qui a changé par rapport à la première
 * version.
 *
 *  - **SOS** — répondre à ce qui arrive. Flux entrant, décision immédiate,
 *    compteur qui tourne du côté d'un client en panne.
 *  - **Radar** — surveiller ce qui pourrait arriver. Un autre rythme, une autre
 *    intention.
 *
 * Les fondre dans un même défilement de cartes revenait à mettre sur le même
 * plan une urgence et une veille. Deux tuiles, dont une seule est allumée,
 * disent en un regard où est le travail.
 *
 * Sous les tuiles, les interventions **déjà engagées** : elles ne sont pas un
 * troisième service mais la mémoire courte du garagiste — ce qu'il a promis et
 * n'a pas fini. Les cacher derrière la tuile SOS l'aurait obligé à entrer pour
 * vérifier qu'il n'oublie personne.
 */
export default function InterventionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();

  const jobs = useGarageJobs();
  const connection = useJobFeedStore((state) => state.connection);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void jobs.refetch().finally(() => setRefreshing(false));
  }, [jobs]);

  const data = jobs.data;

  /** L'état du poste garagiste — voir `src/ui/loadState.ts`. */
  const jobsState = resolveLoadState({
    pending: jobs.isPending,
    fetching: jobs.isFetching,
    error: jobs.error,
    failureCount: jobs.failureCount,
    hasData: data != null,
  });
  const waiting = data?.incoming.length ?? 0;
  const active = data?.active ?? [];
  const live = connection === 'live';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      {/*
        En-tête d'identité, pas de navigation : cet onglet est une racine, il
        n'a rien derrière lui. D'où l'absence de chevron retour, et le nom du
        garage en display — le garagiste doit voir *sous quelle enseigne* il
        répond, surtout le jour où un compte gérera deux ateliers.
      */}
      <View
        style={{
          paddingHorizontal: theme.space.lg,
          paddingTop: theme.space.md,
          paddingBottom: theme.space.lg,
          gap: theme.space.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <SectionLabel>{t('jobs.deskLabel')}</SectionLabel>
          <View style={{ flex: 1 }} />

          {live ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
              <BlinkingDot size={7} color={theme.colors.success} />
              <Text variant="numSm" tone="muted">
                {t('jobs.listening')}
              </Text>
            </View>
          ) : (
            <Text variant="numSm" tone="muted">
              {t('tracking.degraded')}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <Text variant="d1b" numberOfLines={1} style={{ flexShrink: 1 }}>
            {data?.garage.name ?? '—'}
          </Text>
          {data?.garage.certified ? (
            <ShieldCheckIcon color={theme.colors.success} size={17} />
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: theme.space.xxxl,
          gap: theme.space.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/*
          Un garage absent du compte n'est pas une panne : c'est un état du
          dossier, qui appelle une explication et non un dessin d'erreur. Il
          garde donc son encart. Tout le reste — serveur injoignable, 5xx —
          passe par le dessin d'état commun.
        */}
        {jobs.error instanceof ApiError && jobs.error.code === 'GARAGE_NOT_FOUND' ? (
          <Callout tone="danger" title={t('common.error')}>
            {t('jobs.noGarage')}
          </Callout>
        ) : isTerminal(jobsState) ? (
          <StateView
            state={jobsState}
            actionLabel={t('state.retry')}
            onAction={() => {
              forceProbe();
              void jobs.refetch();
            }}
          />
        ) : null}

        {data && !data.garage.isActive ? (
          <Callout title={t('jobs.closedTitle')}>{t('jobs.closedBody')}</Callout>
        ) : null}

        <View style={{ gap: theme.space.md }}>
          <ServiceTile
            title={t('jobs.sosTile')}
            lead={waiting > 0 ? t('jobs.sosTileWaiting') : t('jobs.sosTileIdle')}
            icon={AlertIcon}
            count={waiting}
            live={live}
            onPress={() => router.push('/interventions/sos' as never)}
          />

          {/*
            Radar : annoncé, pas encore ouvert.

            Aucune action, aucun compteur inventé, et le mot « bientôt » écrit
            dessus. Une tuile qui réagirait au toucher pour ouvrir un écran vide
            coûterait plus cher en confiance qu'elle ne rapporte en promesse.
          */}
          <ServiceTile
            title={t('jobs.radarTile')}
            lead={t('jobs.radarTileLead')}
            icon={CrosshairIcon}
            badge={t('jobs.soon')}
          />
        </View>

        {active.length > 0 ? (
          <View style={{ gap: theme.space.sm }}>
            <SectionLabel>{t('jobs.active')}</SectionLabel>

            {active.map((job) => (
              <ActiveRow
                key={job.id}
                job={job}
                onPress={() => router.push(`/interventions/${job.id}` as never)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Rappel d'un engagement en cours.
 *
 * Volontairement plus maigre qu'une ligne de la liste SOS : ici on ne décide
 * rien, on se souvient. La panne, le client, et depuis combien de temps —
 * l'action, elle, est au bout du chevron.
 */
function ActiveRow({ job, onPress }: { job: Job; onPress: () => void }) {
  const theme = useTheme();
  const { locale } = useI18n();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${PROBLEM_LABELS[job.problemType][locale]} — ${job.client.fullName}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        minHeight: MIN_TOUCH_TARGET,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        borderLeftWidth: 3,
        borderLeftColor: urgencyColor(job.urgency, theme.colors),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h2b" numberOfLines={1}>
          {PROBLEM_LABELS[job.problemType][locale]}
        </Text>
        <Text variant="txt" tone="secondary" numberOfLines={1}>
          {job.client.fullName}
        </Text>
      </View>

      <WaitingClock since={job.selectedAt ?? job.createdAt} variant="numSm" />
      <ChevronRightSmallIcon color={theme.colors.muted} size={15} />
    </Pressable>
  );
}
