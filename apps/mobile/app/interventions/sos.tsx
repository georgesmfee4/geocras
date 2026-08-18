import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGarageJobs } from '../../src/api/hooks';
import { useI18n } from '../../src/i18n/I18nProvider';
import { JobRow } from '../../src/jobs/JobRow';
import { useJobFeedStore } from '../../src/realtime/useJobFeed';
import { useTheme } from '../../src/theme/ThemeProvider';
import { BlinkingDot } from '../../src/ui/BlinkingDot';
import { forceProbe } from '../../src/api/reachability';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { isTerminal, resolveLoadState } from '../../src/ui/loadState';
import { StateView } from '../../src/ui/StateView';
import { Text } from '../../src/ui/Text';

/**
 * Les demandes d'aide adressées au garage.
 *
 * Deux sections, jamais fondues en une : une demande **reçue** appelle une
 * décision et son compteur d'attente court ; une demande **en cours** est un
 * engagement déjà pris. Les mélanger ferait s'intercaler un nouveau SOS entre
 * les boutons de quelqu'un qui roule vers une panne.
 *
 * La liste ne tient aucun état : elle lit le cache que la poussée socket
 * alimente (`useJobFeed`, abonné une seule fois dans la barre d'onglets). Une
 * copie locale prendrait du retard sur le temps réel dès la première action.
 */
export default function SosListScreen() {
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

  /** L'état de la file de travail — voir `src/ui/loadState.ts`. */
  const jobsState = resolveLoadState({
    pending: jobs.isPending,
    fetching: jobs.isFetching,
    error: jobs.error,
    failureCount: jobs.failureCount,
    hasData: data != null,
  });
  const incoming = data?.incoming ?? [];
  const active = data?.active ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScreenHeader
        title={t('jobs.sosTitle')}
        action={
          connection === 'live' ? (
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
          )
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: theme.space.lg,
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
        {jobs.isLoading ? (
          <View style={{ paddingVertical: theme.space.xxxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : null}

        {/*
          L'encart rouge disait « Connexion impossible » sur une seule ligne,
          sans distinguer un serveur arrêté d'une erreur métier. Le dessin
          d'état le fait, et propose la seule action qui vaille selon le cas.
        */}
        {isTerminal(jobsState) ? (
          <StateView
            state={jobsState}
            actionLabel={t('state.retry')}
            onAction={() => {
              forceProbe();
              void jobs.refetch();
            }}
          />
        ) : null}

        {incoming.length > 0 ? (
          <View style={{ gap: theme.space.sm }}>
            <SectionLabel>{`${t('jobs.incoming')} · ${incoming.length}`}</SectionLabel>
            {incoming.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onPress={() => router.push(`/interventions/${job.id}` as never)}
              />
            ))}
          </View>
        ) : null}

        {active.length > 0 ? (
          <View style={{ gap: theme.space.sm }}>
            <SectionLabel>{t('jobs.active')}</SectionLabel>
            {active.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onPress={() => router.push(`/interventions/${job.id}` as never)}
              />
            ))}
          </View>
        ) : null}

        {data && incoming.length === 0 && active.length === 0 ? <EmptyQueue /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * File vide.
 *
 * Volontairement calme : c'est l'état normal d'un garage la plupart du temps,
 * pas un incident à signaler. La pastille qui bat répond à la seule question
 * que se pose un garagiste devant un écran sans demande — est-ce que ça écoute
 * vraiment, ou est-ce que c'est en panne ?
 */
function EmptyQueue() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.space.md,
        paddingVertical: theme.space.xxxl,
        paddingHorizontal: theme.space.lg,
      }}
    >
      <BlinkingDot size={10} color={theme.colors.success} />
      <Text variant="h1b" style={{ textAlign: 'center' }}>
        {t('jobs.emptyTitle')}
      </Text>
      <Text variant="txt" tone="secondary" style={{ textAlign: 'center' }}>
        {t('jobs.emptyLead')}
      </Text>
    </View>
  );
}
