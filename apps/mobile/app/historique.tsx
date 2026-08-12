import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isRequestOngoing, PROBLEM_LABELS, REQUEST_STATUS_LABELS } from '@geocras/shared';
import { useMyRequestPages } from '../src/api/hooks';
import { cameroonDateParts } from '../src/time/clock';
import { useAuth } from '../src/auth/AuthProvider';
import { RequestCard, RAIL_WIDTH, statusColor, type HistoryRequest } from '../src/history/RequestCard';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/theme/ThemeProvider';
import { BlinkingDot } from '../src/ui/BlinkingDot';
import { Button } from '../src/ui/Button';
import { ChamferView } from '../src/ui/ChamferView';
import { ChevronRightSmallIcon } from '../src/ui/icons';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { SectionLabel } from '../src/ui/SectionLabel';
import { Skeleton } from '../src/ui/Skeleton';
import { Text } from '../src/ui/Text';

/** Identifiant de groupe — « 2026-8 », en heure du Cameroun comme le libellé. */
function monthKeyOf(iso: string): string {
  const parts = cameroonDateParts(iso);
  return parts ? `${parts.year}-${parts.month}` : 'inconnu';
}

type Row =
  | { kind: 'month'; key: string; label: string }
  | { kind: 'request'; key: string; request: HistoryRequest; first: boolean; last: boolean };

/**
 * Historique des demandes.
 *
 * Trois besoins amènent ici, et l'écran les traite dans cet ordre :
 *
 *  1. **retrouver la demande en cours** — quelqu'un a fermé l'app pendant que
 *     le garagiste roulait vers lui. Elle est donc extraite de la liste et
 *     posée en tête, avec un seul bouton ;
 *  2. **retrouver un garage** — « celui qui est venu le mois dernier » ;
 *  3. **noter** ce qu'on n'a pas noté, ce qui rapporte des points.
 *
 * La liste est groupée par mois et cousue d'un fil du temps vertical. Le
 * groupement n'est pas décoratif : sans lui, quinze lignes de dates se lisent
 * comme un journal système. Avec, l'œil saute d'un mois à l'autre.
 *
 * Une seule liste virtualisée porte tout — carte du moment, intitulés de mois,
 * lignes, chargement de la suite. Empiler un `ScrollView` et une `FlatList`
 * aurait cassé le défilement et le recyclage sur les longs historiques.
 */
export default function HistoriqueScreen() {
  const theme = useTheme();
  const { t, plural, formatMonthLabel } = useI18n();
  const router = useRouter();
  const { user, status } = useAuth();

  const history = useMyRequestPages(user !== null);

  const pages = history.data?.pages ?? [];
  const all = pages.flatMap((page) => page.results);
  const total = pages[0]?.total ?? 0;

  /**
   * La demande vivante, s'il y en a une.
   *
   * L'index unique `requests_one_active_per_client_idx` garantit qu'il n'y en a
   * jamais deux : on prend donc la première trouvée sans avoir à trancher.
   */
  const ongoing = all.find((request) => isRequestOngoing(request.status)) ?? null;

  const rows = useMemo<Row[]>(() => {
    const past = all.filter((request) => request.id !== ongoing?.id);
    const output: Row[] = [];
    let currentMonth: string | null = null;

    past.forEach((request, index) => {
      const month = monthKeyOf(request.createdAt);
      if (month !== currentMonth) {
        currentMonth = month;
        output.push({
          kind: 'month',
          key: `m-${month}`,
          label: formatMonthLabel(request.createdAt),
        });
      }

      const nextRequest = past[index + 1];
      output.push({
        kind: 'request',
        key: request.id,
        request,
        // « Premier » et « dernier » se comptent dans le mois, pas dans la
        // liste : c'est là que le fil doit s'ouvrir et se refermer.
        first: output[output.length - 1]?.kind === 'month',
        last: nextRequest === undefined || monthKeyOf(nextRequest.createdAt) !== month,
      });
    });

    return output;
  }, [all, ongoing?.id, formatMonthLabel]);

  const openRequest = (request: HistoryRequest): (() => void) | null => {
    if (isRequestOngoing(request.status)) {
      return () => router.push(`/suivi/${request.id}` as never);
    }
    // Une demande close renvoie au garage : c'est de lui qu'on veut le numéro,
    // les horaires ou la note. Une demande annulée sans garage ne mène nulle
    // part — la ligne cesse alors d'être cliquable plutôt que d'ouvrir un écran
    // vide.
    if (request.garageId) {
      return () => router.push(`/garage/${request.garageId}` as never);
    }
    return null;
  };

  const rateRequest = (request: HistoryRequest): (() => void) | null => {
    if (request.status !== 'closed' || request.reviewed || !request.garageId) return null;
    // `review=1` ouvre la feuille de note dès l'arrivée sur la fiche : sans ce
    // paramètre, on renverrait l'utilisateur chercher lui-même le bouton qu'il
    // vient de demander.
    return () => router.push(`/garage/${request.garageId}?review=1` as never);
  };

  const listEmpty = !history.isPending && all.length === 0;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ScreenHeader
        title={t('history.title')}
        action={
          total > 0 ? (
            <Text variant="numSm" tone="muted">
              {total} {t(plural(total) === 'one' ? 'history.requestsOne' : 'history.requestsMany')}
            </Text>
          ) : null
        }
      />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{
          paddingBottom: theme.space.xxxl,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching && !history.isFetchingNextPage}
            onRefresh={() => void history.refetch()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) {
            void history.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.space.lg, paddingTop: theme.space.lg }}>
            {ongoing ? (
              <OngoingCard request={ongoing} onPress={() => router.push(`/suivi/${ongoing.id}` as never)} />
            ) : null}

            {history.isPending ? (
              <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.md }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="100%" height={72} />
                <Skeleton width="100%" height={72} />
                <Skeleton width="100%" height={72} />
              </View>
            ) : null}

            {history.isError ? (
              <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.md }}>
                <Text variant="h2" tone="primary">
                  {t('history.failed')}
                </Text>
                <Button
                  label={t('common.retry')}
                  variant="outline"
                  onPress={() => void history.refetch()}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          listEmpty && !history.isError ? (
            <EmptyHistory
              signedIn={user !== null && status !== 'loading'}
              onOpenMap={() => router.replace('/(drawer)/(tabs)/carte' as never)}
            />
          ) : null
        }
        renderItem={({ item }) =>
          item.kind === 'month' ? (
            <View
              style={{
                paddingLeft: RAIL_WIDTH,
                paddingRight: theme.space.xl,
                paddingTop: theme.space.xl,
                paddingBottom: theme.space.sm,
              }}
            >
              <SectionLabel>{item.label}</SectionLabel>
            </View>
          ) : (
            <RequestCard
              request={item.request}
              first={item.first}
              last={item.last}
              onPress={openRequest(item.request)}
              onRate={rateRequest(item.request)}
            />
          )
        }
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.lg }}>
              <Skeleton width="100%" height={72} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

/**
 * La demande du moment, en tête d'écran.
 *
 * Elle sort du fil du temps et prend une carte à elle : c'est la seule ligne de
 * cet écran sur laquelle on peut encore agir, et quelqu'un dont le véhicule est
 * immobilisé ne doit pas avoir à la chercher dans une liste où elle
 * ressemblerait à toutes les autres.
 *
 * La pastille clignote parce que la donnée est vivante — c'est le sens que la
 * pastille a partout ailleurs dans le produit, et il faut qu'elle le garde.
 */
function OngoingCard({ request, onPress }: { request: HistoryRequest; onPress: () => void }) {
  const theme = useTheme();
  const { t, locale, formatAge } = useI18n();

  return (
    <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.md }}>
      <SectionLabel>{t('history.ongoing')}</SectionLabel>

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.rule,
          borderLeftWidth: 3,
          borderLeftColor: statusColor(request.status, theme.colors),
          padding: theme.space.lg,
          gap: theme.space.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <BlinkingDot size={8} color={statusColor(request.status, theme.colors)} />
          <Text variant="h2" style={{ flex: 1 }} numberOfLines={1}>
            {REQUEST_STATUS_LABELS[request.status][locale]}
          </Text>
          {/* Ancienneté en mono : c'est une mesure, et elle se lit d'un coup. */}
          <Text variant="numSm" tone="muted">
            {formatAge(request.createdAt)}
          </Text>
        </View>

        <View style={{ gap: 2 }}>
          <Text variant="txt">{PROBLEM_LABELS[request.problemType][locale]}</Text>
          {request.garageName ? (
            <Text variant="txt" tone="secondary" numberOfLines={1}>
              {request.garageName}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t('history.resume')}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <ChamferView
            fill={theme.colors.primary}
            style={{ minHeight: 48 }}
            contentStyle={{
              minHeight: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: theme.space.lg,
              paddingRight: theme.space.xxl,
            }}
          >
            <Text variant="h2" tone="inverse">
              {t('history.resume')}
            </Text>
            <ChevronRightSmallIcon color="#FFFFFF" size={16} />
          </ChamferView>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Historique vide.
 *
 * Il dit **ce que la page contiendra**, pas « aucune donnée ». Un utilisateur
 * qui n'a jamais eu de panne est dans le meilleur des cas ; l'écran ne doit pas
 * lui donner l'impression d'un manque, seulement lui apprendre à quoi sert
 * l'entrée qu'il vient d'ouvrir.
 */
function EmptyHistory({ signedIn, onOpenMap }: { signedIn: boolean; onOpenMap: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.space.xxl,
        gap: theme.space.md,
      }}
    >
      {/*
        Un fil du temps sans nœud : le dessin de la page, vidé. Il dit la même
        chose que le texte, avec la grammaire de l'écran.
      */}
      <View style={{ width: 1, height: 46, backgroundColor: theme.colors.rule }} />

      <Text variant="h1" style={{ textAlign: 'center' }}>
        {t('history.emptyTitle')}
      </Text>

      <Text variant="txt" tone="secondary" style={{ textAlign: 'center' }}>
        {signedIn ? t('history.emptyLead') : t('drawer.guestLead')}
      </Text>

      <Button label={t('history.emptyAction')} variant="outline" onPress={onOpenMap} />
    </View>
  );
}
