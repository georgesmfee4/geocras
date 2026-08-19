import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../../src/api/client';
import { useGarageJobs, useMyGarage } from '../../../src/api/hooks';
import { forceProbe } from '../../../src/api/reachability';
import { useI18n } from '../../../src/i18n/I18nProvider';
import { CommitmentRow } from '../../../src/jobs/CommitmentRow';
import { DeskSkeleton } from '../../../src/jobs/DeskSkeleton';
import { SosPanel } from '../../../src/jobs/SosPanel';
import { useJobFeedStore } from '../../../src/realtime/useJobFeed';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { radius } from '../../../src/theme/tokens';
import { BlinkingDot } from '../../../src/ui/BlinkingDot';
import { Callout } from '../../../src/ui/Callout';
import {
  AlertIcon,
  ChevronRightSmallIcon,
  CrosshairIcon,
  ShieldCheckIcon,
} from '../../../src/ui/icons';
import { isTerminal, resolveLoadState } from '../../../src/ui/loadState';
import { PressableScale } from '../../../src/ui/PressableScale';
import { Reveal } from '../../../src/ui/Reveal';
import { SectionLabel } from '../../../src/ui/SectionLabel';
import { StateView } from '../../../src/ui/StateView';
import { Text } from '../../../src/ui/Text';

/**
 * Poste de travail du garagiste.
 *
 * L'écran répond à trois questions, **dans cet ordre**, et toute sa composition
 * n'est que ça :
 *
 *  1. *Est-ce que quelqu'un m'attend, là, maintenant ?* — le panneau SOS, à
 *     fond perdu, compteur chamfré et attente qui court. Il occupe le haut de
 *     l'écran et il est la seule chose qui touche les deux bords.
 *  2. *Qu'est-ce que j'ai promis ?* — les engagements en cours, en retrait,
 *     chacun portant le verbe de ce qu'il reste à faire.
 *  3. *Et ensuite ?* — le Radar, annoncé, rejeté en pied de page.
 *
 * La version précédente posait SOS et Radar dans deux tuiles de même taille.
 * Deux rectangles identiques ne hiérarchisent rien : ils obligent à lire pour
 * savoir lequel compte, au moment précis où un conducteur en panne attend une
 * réponse.
 *
 * Le rang se lit maintenant dans **la largeur et la matière**, pas dans le
 * poids d'encre : le panneau est la seule surface pleine et la seule à toucher
 * les bords, les engagements sont des boîtes au trait posées sur le fond de
 * page, le Radar n'a même pas de cadre. Trois états de matière, trois rangs, et
 * pas un aplat sombre pour les départager.
 *
 * Ce qui n'a pas bougé : l'écran ne tient aucun état de la file. Il lit le cache
 * que la poussée socket alimente depuis la barre d'onglets, où l'abonnement est
 * monté une fois pour toute l'app.
 */
export default function InterventionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();

  const jobs = useGarageJobs();
  /**
   * Le garage du compte, seulement pour situer l'atelier sous son nom.
   *
   * Aucune requête de plus : la barre d'onglets interroge déjà cette clé pour
   * décider d'afficher l'onglet, et cet écran n'existe que lorsqu'elle a
   * répondu. On lit le même cache.
   */
  const garage = useMyGarage();
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

  const incoming = data?.incoming ?? [];
  const active = data?.active ?? [];
  const live = connection === 'live';
  const open = data?.garage.isActive ?? false;

  const missingGarage = jobs.error instanceof ApiError && jobs.error.code === 'GARAGE_NOT_FOUND';
  const loading = jobsState === 'loading' || jobsState === 'retrying';

  const openGarage = useCallback(() => router.push('/compte/garage' as never), [router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <Masthead
        name={data?.garage.name ?? garage.data?.garage?.name ?? null}
        certified={data?.garage.certified ?? false}
        place={placeLabel(garage.data?.garage)}
        live={live}
        open={open}
        known={data != null}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: theme.space.xl,
          paddingBottom: theme.space.xxxl,
          // Vingt-quatre points entre les sections plutôt que vingt : c'est
          // l'espace qui sépare les blocs, il doit rester nettement plus large
          // que les huit points qui séparent deux lignes d'une même liste.
          gap: theme.space.xxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surface}
          />
        }
      >
        {/*
          Un garage absent du compte n'est pas une panne : c'est un état du
          dossier, qui appelle une explication et non un dessin d'erreur. Il
          garde donc son encart. Tout le reste — serveur injoignable, 5xx —
          passe par le dessin d'état commun.
        */}
        {missingGarage ? (
          <View style={{ paddingHorizontal: theme.space.lg }}>
            <Callout tone="danger" title={t('common.error')}>
              {t('jobs.noGarage')}
            </Callout>
          </View>
        ) : isTerminal(jobsState) ? (
          <View style={{ paddingHorizontal: theme.space.lg }}>
            <StateView
              state={jobsState}
              actionLabel={t('state.retry')}
              onAction={() => {
                forceProbe();
                void jobs.refetch();
              }}
            />
          </View>
        ) : null}

        {loading ? <DeskSkeleton /> : null}

        {data ? (
          <>
            {/*
              Détection fermée **alors qu'il reste des demandes** : le seul cas
              que le bandeau de veille ne peut pas porter, puisque le panneau
              occupe sa place. Il faut quand même le dire — ces demandes-là sont
              les dernières qui arriveront.
            */}
            {!open && incoming.length > 0 ? <ClosedNotice onPress={openGarage} /> : null}

            <Reveal>
              <SosPanel
                incoming={incoming}
                open={open}
                onOpenQueue={() => router.push('/interventions/sos' as never)}
                onOpenGarage={openGarage}
              />
            </Reveal>

            {active.length > 0 ? (
              <Reveal delay={70}>
                <View style={{ paddingHorizontal: theme.space.lg, gap: theme.space.sm }}>
                  <View style={{ gap: theme.space.xs }}>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}
                    >
                      <SectionLabel>{t('jobs.commitments')}</SectionLabel>
                      {/* Le décompte reste en mono : c'est une donnée mesurée,
                          pas un morceau de l'intitulé. */}
                      <Text variant="numSm" tone="muted">
                        {active.length}
                      </Text>
                    </View>
                    <Text variant="txt" tone="secondary">
                      {t('jobs.commitmentsLead')}
                    </Text>
                  </View>

                  {active.map((job) => (
                    <CommitmentRow
                      key={job.id}
                      job={job}
                      onPress={() => router.push(`/interventions/${job.id}` as never)}
                    />
                  ))}
                </View>
              </Reveal>
            ) : null}

            <Reveal delay={140}>
              <RadarNote />
            </Reveal>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * L'enseigne sous laquelle on répond.
 *
 * Fixe, hors du défilement, et sans chevron de retour : cet onglet est une
 * racine, il n'a rien derrière lui. Trois niveaux, du plus permanent au plus
 * volatil — le rôle de l'écran, le nom de l'atelier, puis son état de service.
 *
 * La ligne du bas est un cadran de machine plutôt qu'une phrase : détection
 * ouverte ou fermée d'un côté, quartier de l'autre. Ce sont les deux choses
 * qu'un garagiste vérifie du coin de l'œil sans jamais les lire vraiment.
 */
function Masthead({
  name,
  certified,
  place,
  live,
  open,
  known,
}: {
  name: string | null;
  certified: boolean;
  place: string | null;
  live: boolean;
  open: boolean;
  /** La file a répondu : avant, l'état de service n'est pas connu. */
  known: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={{
        paddingHorizontal: theme.space.lg,
        paddingTop: theme.space.md,
        paddingBottom: theme.space.lg,
        gap: theme.space.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.rule,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <SectionLabel>{t('jobs.deskLabel')}</SectionLabel>
        <View style={{ flex: 1 }} />

        {/*
          L'état de la liaison, pas celui du garage. Il répond à la question
          qu'on se pose devant un écran qui ne bouge pas depuis vingt minutes :
          est-ce qu'il n'arrive rien, ou est-ce que je n'entends plus ?
        */}
        {live ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
            <BlinkingDot size={7} color={theme.colors.success} />
            <Text variant="numSm" tone="muted">
              {t('jobs.listening')}
            </Text>
          </View>
        ) : (
          <Text variant="numSm" tone="muted">
            {t('jobs.deskUnstable')}
          </Text>
        )}
      </View>

      {/*
        Le nom de l'atelier en H1 et non en display : à trente-sept points de
        Bebas, il pesait plus lourd que le chiffre du panneau SOS juste
        au-dessous — c'est-à-dire que l'enseigne passait devant la nouvelle. Il
        reste le plus grand texte de l'écran, ce qui suffit à dire qu'on est
        chez soi.
      */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Text variant="h1b" numberOfLines={1} style={{ flexShrink: 1 }}>
          {name ?? '—'}
        </Text>
        {certified ? <ShieldCheckIcon color={theme.colors.success} size={16} /> : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        {known ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: radius.pill,
                backgroundColor: open ? theme.colors.success : theme.colors.warning,
              }}
            />
            <Text
              variant="btnSm"
              style={{ color: open ? theme.colors.success : theme.colors.warning }}
            >
              {open ? t('jobs.detectionOpen') : t('jobs.closedTitle')}
            </Text>
          </View>
        ) : null}

        {place ? (
          <Text variant="txt" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {place}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Détection fermée, dites en une ligne actionnable.
 *
 * L'encart d'origine expliquait où rouvrir — « depuis Mon garage » — sans y
 * mener. Écrire l'adresse d'une porte plutôt que de l'ouvrir fait payer trois
 * touchers au garagiste qui vient de comprendre que son garage est invisible.
 */
function ClosedNotice({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${t('jobs.closedTitle')}. ${t('jobs.reopenDetection')}`}
      style={{ paddingHorizontal: theme.space.lg }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: theme.space.md,
          alignItems: 'center',
          backgroundColor: theme.colors.highlightTint,
          borderLeftWidth: 2,
          borderLeftColor: theme.colors.warning,
          padding: theme.space.md,
        }}
      >
        <AlertIcon color={theme.colors.ink} size={17} />

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h2b">{t('jobs.closedTitle')}</Text>
          <Text variant="txt" tone="secondary">
            {t('jobs.closedBody')}
          </Text>
        </View>

        <ChevronRightSmallIcon color={theme.colors.inkSecondary} size={15} />
      </View>
    </PressableScale>
  );
}

/**
 * Le Radar, annoncé et pas plus.
 *
 * Il occupait une tuile de la taille du SOS. Une surveillance qui n'existe pas
 * encore ne peut pas peser autant que la file du jour : elle descend en pied de
 * page, sans fond, sans cadre et sans rien à toucher. Une tuile grisée qui
 * réagit au doigt coûterait plus cher en confiance qu'elle ne rapporte en
 * promesse.
 */
function RadarNote() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={{ paddingHorizontal: theme.space.lg, gap: theme.space.md }}>
      <SectionLabel>{t('jobs.soon')}</SectionLabel>

      <View
        style={{
          flexDirection: 'row',
          gap: theme.space.md,
          alignItems: 'flex-start',
          borderTopWidth: 1,
          borderTopColor: theme.colors.rule,
          paddingTop: theme.space.md,
        }}
      >
        <CrosshairIcon color={theme.colors.muted} size={20} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h2b" tone="secondary">
            {t('jobs.radarTile')}
          </Text>
          <Text variant="txt" tone="muted">
            {t('jobs.radarLead')}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Où se trouve l'atelier, en une ligne.
 *
 * Le quartier d'abord, la ville ensuite, et la ville seule quand le quartier
 * manque : « Bastos, Yaoundé » situe un garage pour quelqu'un d'ici, « Yaoundé »
 * tout court ne dit presque rien mais ne ment pas. L'adresse complète n'a rien
 * à faire ici — le garagiste sait où il travaille, cette ligne ne sert qu'à
 * confirmer qu'il regarde le bon atelier.
 */
function placeLabel(garage: { quarter: string | null; city: string } | null | undefined): string | null {
  if (!garage) return null;
  return garage.quarter ? `${garage.quarter}, ${garage.city}` : garage.city;
}
