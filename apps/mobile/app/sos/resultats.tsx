import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GARAGE_SORTS,
  PROBLEM_LABELS,
  type GarageSort,
  type GarageSummary,
} from '@geocras/shared';
import {
  useCancelRequest,
  useRequestCandidates,
  useRequestDetail,
  useSelectGarage,
} from '../../src/api/hooks';
import { env } from '../../src/config/env';
import { useI18n } from '../../src/i18n/I18nProvider';
import { GarageMarkers } from '../../src/map/GarageMarkers';
import { MapCanvas, type MapCanvasRef } from '../../src/map/MapCanvas';
import { RouteLine, straightLine } from '../../src/map/RouteLine';
import { UserPuck } from '../../src/map/UserPuck';
import { NoGarageFound } from '../../src/sos/NoGarageFound';
import { DeclinedNotice } from '../../src/sos/DeclinedNotice';
import { PinnedGarageNotice } from '../../src/sos/PinnedGarageNotice';
import {
  ResultsSheet,
  SHEET_PEEK_HEIGHT,
  type ResultsSheetRef,
} from '../../src/sos/ResultsSheet';
import { SosConfirmModal } from '../../src/sos/SosConfirmModal';
import { SosHeader } from '../../src/sos/SosHeader';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button } from '../../src/ui/Button';
import { Chip } from '../../src/ui/Chip';
import { CloseIcon } from '../../src/ui/icons';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Skeleton } from '../../src/ui/Skeleton';
import { Text } from '../../src/ui/Text';
import { MIN_TOUCH_TARGET } from '../../src/theme/tokens';

/**
 * Résultats de la recherche SOS.
 *
 * Deux façons d'y arriver, et l'écran ne fait pas la différence :
 *  - l'envoi du formulaire, qui vient de créer la demande ;
 *  - la reprise d'une demande `pending` depuis le bouton SOS.
 *
 * Dans les deux cas la source de vérité est la demande côté serveur, chargée
 * par `useRequestDetail`. Le classement de garages, lui, est soit déjà en
 * cache (créé dans le même aller-retour), soit refait — voir
 * `useRequestCandidates`.
 *
 * L'écran montre le **même classement de deux façons** : planté sur la carte,
 * et listé dans la feuille du bas. La carte répond à « où sont-ils ? », la
 * liste à « lequel je prends ? » — et personne ne choisit un garage en
 * comparant des écussons.
 */
export default function ResultatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, locale, translateError, formatDistance, formatDuration } = useI18n();
  const { requestId, garage: garageParam, declined } = useLocalSearchParams<{
    requestId?: string;
    garage?: string;
    declined?: string;
  }>();

  /**
   * Garage demandé depuis sa fiche, s’il y en a un.
   *
   * Normalisé une fois pour toutes : un paramètre vide — une URL tronquée,
   * un lien recomposé à la main — doit se comporter comme une absence, pas
   * comme un garage introuvable qu’on annoncerait à tort comme incompatible
   * avec la panne.
   */
  const pinnedId = garageParam && garageParam.trim().length > 0 ? garageParam : null;

  /**
   * On arrive ici parce qu'un garage vient de refuser la demande.
   *
   * Sans ce mot, le retour à la liste est incompréhensible : le client était
   * sur son écran d'attente, et il se retrouve à choisir de nouveau sans
   * savoir pourquoi. Le message est refermable — une fois lu, il n'apporte
   * plus rien et occupe la place des garages.
   */
  const [declineNoticeShown, setDeclineNoticeShown] = useState(declined === '1');

  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapCanvasRef>(null);
  const sheetRef = useRef<ResultsSheetRef>(null);

  const [sort, setSort] = useState<GarageSort>('distance');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Garage dont l'itinéraire est tracé sur la carte. */
  const [routeGarage, setRouteGarage] = useState<GarageSummary | null>(null);
  /** Garage en attente de confirmation d'envoi. Ouvre la modale. */
  const [confirming, setConfirming] = useState<GarageSummary | null>(null);
  /**
   * Rappel du garage demandé depuis sa fiche.
   *
   * Il se ferme, l’épinglage non : masquer l’explication ne doit pas
   * réorganiser la liste sous les yeux de celui qui vient de la lire.
   */
  const [pinnedNoticeShown, setPinnedNoticeShown] = useState(true);
  /** Hauteur occupée par la feuille, mesurée par elle et non devinée ici. */
  const [sheetHeight, setSheetHeight] = useState(SHEET_PEEK_HEIGHT);

  const request = useRequestDetail(requestId ?? null);
  const candidates = useRequestCandidates(request.data);
  const selectGarage = useSelectGarage(requestId ?? '');
  const cancelRequest = useCancelRequest(requestId ?? '');

  /**
   * Abandon de la demande.
   *
   * Indispensable, et pas seulement confortable : une demande `pending`
   * bloque toute nouvelle création (`requests_one_active_per_client_idx`).
   * Sans sortie depuis cet écran, quelqu'un dont la recherche ne donne rien
   * reste coincé — il ne peut ni continuer ici, ni relancer un SOS ailleurs.
   *
   * Confirmation avant d'agir : c'est irréversible, et le bouton se trouve à
   * côté de « Appeler l'assistance » sur un écran qu'on manipule sous stress.
   *
   * Les deux réponses sont **nommées par ce qu'elles font**. « Annuler » face à
   * « Annuler la demande » — l'ancienne paire — obligeait à lire deux fois pour
   * distinguer le renoncement au renoncement, sur le seul écran de l'app où
   * l'on est en panne au bord d'une route.
   */
  const askCancel = useCallback(() => {
    if (!requestId) return;

    Alert.alert(t('results.cancelConfirmTitle'), t('results.cancelConfirmLead'), [
      { text: t('results.keepSearching'), style: 'cancel' },
      {
        text: t('results.cancelRequest'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await cancelRequest.mutateAsync('abandon depuis les résultats');
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/(drawer)/(tabs)/carte');
            } catch (cause) {
              setError(translateError(cause));
            }
          })();
        },
      },
    ]);
  }, [requestId, cancelRequest, router, t, translateError]);

  /**
   * Sortir de cet écran, c'est renoncer à la demande.
   *
   * L'écran n'a pas d'état intermédiaire à sauvegarder : la demande est déjà
   * créée côté serveur et attend qu'on lui désigne un garage. Repartir en
   * arrière sans rien faire la laisserait ouverte indéfiniment — et une
   * demande ouverte interdit d'en lancer une autre. Le retour vaut donc
   * abandon, et il se confirme.
   *
   * Sans `requestId` il n'y a rien à annuler : on laisse simplement sortir,
   * plutôt que d'afficher une confirmation qui ne porte sur rien ou, pire, de
   * bloquer le retour.
   */
  const askLeave = useCallback(() => {
    if (!requestId) {
      router.back();
      return;
    }
    askCancel();
  }, [requestId, router, askCancel]);

  /**
   * Touche retour d'Android, matérielle ou gestuelle.
   *
   * `useFocusEffect` et non `useEffect` : la pile garde cet écran monté quand
   * on ouvre la fiche d'un garage par-dessus. Sans le lien au focus, notre
   * gestionnaire resterait actif sous l'écran de détail et y intercepterait le
   * retour — on proposerait d'annuler le SOS à quelqu'un qui voulait juste
   * refermer une fiche.
   *
   * `true` retenu : on empêche la pile de dépiler pour que la confirmation ait
   * le dernier mot. Le geste de retour d'iOS, lui, ne s'intercepte pas — il est
   * désactivé sur cet écran (`gestureEnabled: false`), comme sur le suivi.
   */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        askLeave();
        return true;
      });

      return () => subscription.remove();
    }, [askLeave]),
  );

  /**
   * Le tri est appliqué **ici**, pas par un nouvel appel serveur.
   *
   * La maquette exige que changer de tri renumérote les marqueurs
   * « immédiatement et visiblement » : un aller-retour réseau à chaque puce
   * rendrait ça saccadé sur une 3G. Les vingt garages sont déjà en mémoire, et
   * `rank` est recalculé sur le classement affiché — c'est le seul endroit de
   * l'app où le rang est dérivé côté client, précisément parce qu'il ne
   * désigne plus un classement serveur mais l'ordre montré à l'écran.
   *
   * La feuille du bas lit cette même liste : la ligne n° 3 et l'écusson n° 3
   * ne peuvent pas désigner deux garages différents.
   */
  const results = useMemo(() => {
    const rows = [...(candidates.data?.results ?? [])];

    rows.sort((a, b) => {
      if (sort === 'certified' && a.certified !== b.certified) return a.certified ? -1 : 1;
      if (sort === 'rating' && a.rating !== b.rating) return b.rating - a.rating;
      return a.distanceM - b.distanceM;
    });

    /**
     * Le garage ouvert depuis sa fiche passe devant, quel que soit le tri.
     *
     * C’est une demande explicite de l’utilisateur — il est arrivé ici en
     * cliquant « Demander une assistance » sur ce garage-là — et elle prime
     * sur un classement automatique. Le rappel jaune juste au-dessus de la
     * ligne dit pourquoi, sans quoi l’épinglage passerait pour un tri cassé.
     *
     * Le reste de la liste garde exactement l’ordre du tri actif : on déplace
     * une ligne, on ne re-classe rien.
     */
    const pinnedIndex = pinnedId ? rows.findIndex((garage) => garage.id === pinnedId) : -1;
    if (pinnedIndex > 0) {
      const [pinned] = rows.splice(pinnedIndex, 1);
      if (pinned) rows.unshift(pinned);
    }

    return rows.map((garage, index) => ({ ...garage, rank: index + 1 }));
  }, [candidates.data, sort, pinnedId]);

  const origin = request.data?.origin ?? null;
  const problemType = request.data?.problemType ?? null;
  const loading = request.isLoading || candidates.isLoading;
  const showSheet = !loading && results.length > 0;

  /**
   * Le garage demandé est-il seulement dans la liste ?
   *
   * La recherche SOS ne retient que les garages capables de traiter la panne
   * déclarée. Quelqu’un qui ouvre la fiche d’un spécialiste carrosserie puis
   * déclare une batterie à plat ne le retrouvera pas ici — et c’est correct.
   * Le silence, lui, ne le serait pas : on le dit, et le message ne pointe
   * alors aucune ligne.
   */
  const pinnedFound = pinnedId !== null && results.some((garage) => garage.id === pinnedId);
  const pinnedMissing = pinnedId !== null && !loading && !pinnedFound;

  /** Sélection : depuis un écusson comme depuis une ligne, c'est la même. */
  const selectGarageOnMap = useCallback((garage: GarageSummary) => {
    void Haptics.selectionAsync();
    setSelectedId(garage.id);
    mapRef.current?.focus([garage.lng, garage.lat]);
  }, []);

  /**
   * Tracé de l'itinéraire, **sans engager la demande**.
   *
   * C'est la différence avec la version précédente de cet écran, où le bouton
   * « Itinéraire » retenait le garage côté serveur : regarder par où l'on
   * passe et confier sa panne à quelqu'un sont deux décisions distinctes, et
   * la seconde est irréversible. Seul « Envoyer le SOS » engage désormais.
   *
   * Conformément au cahier des charges, le trajet est tracé **dans l'app** —
   * jamais un lien sortant vers une application de navigation.
   */
  const showRoute = useCallback(
    (garage: GarageSummary) => {
      if (!origin) return;
      void Haptics.selectionAsync();

      setSelectedId(garage.id);
      setRouteGarage(garage);
      // La feuille redescend : on vient de demander à voir la carte.
      sheetRef.current?.collapse();
      mapRef.current?.fitTo([origin.lng, origin.lat], [garage.lng, garage.lat]);
    },
    [origin],
  );

  /**
   * Envoi du SOS au garage retenu.
   *
   * C'est **cette action** qui engage la demande : `POST /requests/:id/select`
   * fait passer le statut de `pending` à `selected` et notifie le garage. Elle
   * n'est jamais déclenchée directement par la liste — la modale de
   * confirmation s'interpose, parce qu'on ne revient pas dessus.
   */
  const sendSos = useCallback(
    async (garage: GarageSummary) => {
      if (!requestId) return;
      setError(null);

      try {
        await selectGarage.mutateAsync(garage.id);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setConfirming(null);
        router.replace(`/suivi/${requestId}`);
      } catch (cause) {
        setError(translateError(cause));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [requestId, selectGarage, router, translateError],
  );

  /**
   * Cadrage d'ouverture sur le lieu de la panne et les garages proposés.
   *
   * Sans lui la caméra restait sur `INITIAL_VIEW` — le centre de Yaoundé —
   * pendant que les résultats étaient à Ebolowa : l'en-tête annonçait
   * « 2 résultats » au-dessus d'une carte qui n'en montrait aucun.
   *
   * On cadre la **boîte englobante** de l'origine et de tous les résultats,
   * plutôt que de centrer sur l'un d'eux : le point de panne et le garage
   * retenu doivent tenir ensemble à l'écran, c'est la comparaison qui compte
   * ici, pas la position isolée.
   */
  const didFrame = useRef(false);

  useEffect(() => {
    // On attend la fin du chargement : cadrer pendant que `results` est encore
    // vide reviendrait à centrer sur la seule origine, et le drapeau `didFrame`
    // empêcherait ensuite tout recadrage quand les garages arrivent.
    if (didFrame.current || !origin || loading) return;
    didFrame.current = true;

    if (results.length === 0) {
      mapRef.current?.recenter([origin.lng, origin.lat], 14);
      return;
    }

    const lats = [origin.lat, ...results.map((garage) => garage.lat)];
    const lngs = [origin.lng, ...results.map((garage) => garage.lng)];

    mapRef.current?.fitTo(
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    );
  }, [origin, results, loading]);

  /**
   * Un tri qui renumérote invalide le tracé affiché.
   *
   * Le garage, lui, n'a pas bougé — mais son rang, si. On retire donc
   * l'itinéraire plutôt que de laisser une ligne rouge pointer vers un
   * écusson qui a changé de numéro entre-temps.
   */
  useEffect(() => {
    setRouteGarage(null);
  }, [sort]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <MapCanvas
        ref={mapRef}
        paddingTop={190}
        paddingBottom={showSheet ? sheetHeight : 120}
        onPress={() => setSelectedId(null)}
      >
        {origin ? <UserPuck position={origin} accuracyM={null} /> : null}

        {/* Tracé provisoire : un segment droit, en attendant OSRM. Le bandeau
            au-dessus de la feuille le dit noir sur blanc — une ligne qui
            traverse les bâtiments se remarque immédiatement, autant l'assumer
            plutôt que de la faire passer pour un itinéraire calculé. */}
        {origin && routeGarage ? (
          <RouteLine coordinates={straightLine(origin, routeGarage)} />
        ) : null}

        <GarageMarkers garages={results} onSelect={selectGarageOnMap} selectedId={selectedId} />
      </MapCanvas>

      <SafeAreaView edges={['top']} style={styles.chrome} pointerEvents="box-none">
        <View style={{ paddingTop: theme.space.sm }}>
          <SosHeader
            title={t('results.title')}
            onBack={askLeave}
            backLabel={t('sos.back')}
          />
        </View>

        <View style={{ paddingHorizontal: theme.space.lg, gap: theme.space.md }}>
          {/* Compteur + rappel de la panne : on doit pouvoir vérifier d'un
              coup d'œil que la recherche porte sur le bon problème. */}
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: theme.colors.surface,
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.sm,
            }}
          >
            {loading ? (
              <Skeleton width={128} height={16} />
            ) : (
              <>
                <Text variant="num">{results.length}</Text>
                <Text variant="txt" tone="secondary">
                  {t(results.length === 1 ? 'results.countOne' : 'results.count')}
                </Text>
                {problemType ? (
                  <Text variant="txt" tone="muted" numberOfLines={1}>
                    · {PROBLEM_LABELS[problemType][locale]}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.space.md, paddingRight: theme.space.lg }}
          >
            {GARAGE_SORTS.map((option) => (
              <Chip
                key={option}
                label={t(SORT_LABELS[option])}
                active={sort === option}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSort(option);
                }}
              />
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/*
        Panneaux du bas.

        Ils se posent **juste au-dessus de la feuille** : un bandeau glissé
        dessous serait invisible. La hauteur est plafonnée au cran bas — feuille
        déployée, ils passent dessous plutôt que de monter jusque dans les
        puces de tri, où ils recouvriraient les commandes de l'écran.

        Sans feuille — recherche en cours, aucun résultat — ils reprennent le
        bas de l'écran, `insets` compris : sinon le bouton « Annuler » se pose
        sur les touches de navigation d'Android, où un appui déclenche le
        retour système au lieu de l'action.
      */}
      <View
        style={[
          styles.bottom,
          {
            bottom: showSheet ? Math.min(sheetHeight, SHEET_PEEK_HEIGHT + insets.bottom) : 0,
            paddingBottom: showSheet ? theme.space.md : theme.space.xxl + insets.bottom,
          },
        ]}
        pointerEvents="box-none"
      >
        {error ? (
          <View style={{ backgroundColor: theme.colors.primary, padding: theme.space.md }}>
            <Text variant="txt" tone="inverse">
              {error}
            </Text>
          </View>
        ) : null}

        {declineNoticeShown ? (
          <DeclinedNotice onDismiss={() => setDeclineNoticeShown(false)} />
        ) : null}

        {pinnedMissing && pinnedNoticeShown ? (
          <PinnedGarageNotice
            pointing={false}
            onDismiss={() => setPinnedNoticeShown(false)}
          />
        ) : null}

        {routeGarage ? (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.rule,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: theme.space.md,
              padding: theme.space.md,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <SectionLabel>{t('results.routeShown')}</SectionLabel>
              <Text variant="h2" numberOfLines={1}>
                {routeGarage.name}
              </Text>
              <Text variant="mono">
                {formatDistance(routeGarage.distanceM)} · {formatDuration(routeGarage.etaMin)}
              </Text>
              <Text variant="caption" tone="muted">
                {t('results.routeStraight')}
              </Text>
            </View>

            <Pressable
              onPress={() => setRouteGarage(null)}
              accessibilityRole="button"
              accessibilityLabel={t('results.routeHide')}
              hitSlop={10}
              style={{
                width: MIN_TOUCH_TARGET,
                height: MIN_TOUCH_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -theme.space.sm,
                marginRight: -theme.space.sm,
              }}
            >
              <CloseIcon color={theme.colors.inkSecondary} size={18} />
            </Pressable>
          </View>
        ) : null}

        {/* Pendant la recherche : on dit ce qui se passe, et on laisse sortir.
            Une recherche qui traîne sur un réseau lent ne doit pas retenir
            quelqu'un qui a changé d'avis. */}
        {loading ? (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.rule,
              padding: theme.space.lg,
              gap: theme.space.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text variant="h2" style={{ flex: 1 }}>
                {t('results.searching')}
              </Text>
            </View>
            <Skeleton width="100%" height={12} />
            <Skeleton width="72%" height={12} />
            <Button
              label={t('results.cancelRequest')}
              variant="outline"
              fullWidth
              loading={cancelRequest.isPending}
              onPress={askCancel}
            />
          </View>
        ) : null}

        {!loading && results.length === 0 ? (
          <NoGarageFound
            fallbackDistanceM={candidates.data?.fallback?.distanceM ?? null}
            fallbackName={candidates.data?.fallback?.name ?? null}
            onCallSupport={() => void Linking.openURL(`tel:${env.supportPhone}`)}
            onCancel={askCancel}
            cancelling={cancelRequest.isPending}
          />
        ) : null}
      </View>

      {showSheet ? (
        <ResultsSheet
          ref={sheetRef}
          garages={results}
          sortLabel={t(SORT_LABELS[sort])}
          selectedId={selectedId}
          routedId={routeGarage?.id ?? null}
          pinnedId={pinnedFound ? pinnedId : null}
          showPinnedNotice={pinnedNoticeShown}
          onDismissPinnedNotice={() => setPinnedNoticeShown(false)}
          safeAreaBottom={insets.bottom}
          onSelect={selectGarageOnMap}
          onDetails={(garage) => router.push(`/garage/${garage.id}`)}
          onRoute={showRoute}
          onSos={(garage) => {
            void Haptics.selectionAsync();
            setError(null);
            setConfirming(garage);
          }}
          onHeightChange={setSheetHeight}
        />
      ) : null}

      <SosConfirmModal
        garage={confirming}
        problemLabel={problemType ? PROBLEM_LABELS[problemType][locale] : null}
        clientPhone={request.data?.client?.phone ?? null}
        submitting={selectGarage.isPending}
        error={error}
        safeAreaBottom={insets.bottom}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={(garage) => void sendSos(garage)}
      />
    </View>
  );
}

const SORT_LABELS: Record<GarageSort, 'results.sortDistance' | 'results.sortRating' | 'results.sortCertified'> = {
  distance: 'results.sortDistance',
  rating: 'results.sortRating',
  certified: 'results.sortCertified',
};

const styles = StyleSheet.create({
  chrome: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 0, gap: 12 },
});
