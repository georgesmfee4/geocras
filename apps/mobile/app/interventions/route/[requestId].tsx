import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  arrivalClock,
  formatRouteDuration,
  haversineMeters,
  PROBLEM_LABELS,
  ROUTE_REFRESH,
  type Job,
  type LatLng,
} from '@geocras/shared';
import {
  useConfirmJobArrival,
  useGarageJobs,
  useJobAction,
  useJobRoute,
} from '../../../src/api/hooks';
import { useI18n } from '../../../src/i18n/I18nProvider';
import { JobDone } from '../../../src/jobs/JobDone';
import { ActionBar, useActionBarInset } from '../../../src/ui/ActionBar';
import { MapCanvas, type MapCanvasRef } from '../../../src/map/MapCanvas';
import { RouteLine } from '../../../src/map/RouteLine';
import { UserPuck } from '../../../src/map/UserPuck';
import { useLocation } from '../../../src/location/LocationProvider';
import { useTracking } from '../../../src/realtime/useTracking';
import { usePreferences } from '../../../src/settings/preferences';
import { useTrackingStore } from '../../../src/stores/tracking';
import { ProximitySheet } from '../../../src/tracking/ProximitySheet';
import { useProximity } from '../../../src/tracking/useProximity';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../../../src/theme/tokens';
import { Marker } from '@maplibre/maplibre-react-native';
import {
  AlertIcon,
  CheckIcon,
  ChevronLeftIcon,
  CrosshairIcon,
  PhoneIcon,
} from '../../../src/ui/icons';
import { Text } from '../../../src/ui/Text';

/**
 * « Y aller » — l'itinéraire du garagiste vers la panne.
 *
 * Tout l'écran est construit autour d'une contrainte du cahier des charges : le
 * trajet est **tracé dans l'app**, jamais délégué à une application de
 * navigation tierce. Ouvrir un lien sortant aurait été plus simple, et aurait
 * fait sortir le garagiste du produit au moment exact où le client suit sa
 * progression.
 *
 * Le départ est la **position réelle** de celui qui répond, pas l'adresse du
 * garage. C'est la différence entre une durée juste et une durée décorative :
 * un dépanneur est rarement à son atelier quand un SOS tombe.
 *
 * Le recalcul suit deux garde-fous cumulés — un déplacement minimal **et** un
 * intervalle minimal (`ROUTE_REFRESH`). Un véhicule arrêté dans un
 * embouteillage ne relance rien : le trajet ne change pas, et chaque appel se
 * paie en données mobiles.
 */
export default function JobRouteScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { t, locale, formatDistance, translateError } = useI18n();
  const { fix } = useLocation();

  const jobs = useGarageJobs();
  const act = useJobAction();
  const confirmArrival = useConfirmJobArrival();

  /**
   * Le suivi bidirectionnel, monté **ici** — et c'est une correction, pas un
   * ajout décoratif.
   *
   * `useTracking` fait trois choses : rejoindre la room de la demande, écouter
   * les ETA calculés par le serveur, et **émettre sa propre position**. Il
   * n'était monté que sur l'écran du client. Autrement dit : personne ne
   * publiait jamais la position du garagiste. Le client suivait donc une
   * dépanneuse immobile, son trajet d'approche repartait indéfiniment de
   * l'adresse de l'atelier (`fromLive: false`), et la distance entre les deux
   * parties — celle qui commande toute la reconnaissance sur place — restait
   * nulle côté serveur.
   *
   * L'écran d'itinéraire est le bon endroit : c'est celui qui est ouvert
   * pendant qu'on roule. L'émission est déjà throttlée et conditionnée au
   * déplacement réel, elle ne coûte rien à l'arrêt.
   */
  useTracking(requestId ?? null);
  const toClient = useTrackingStore((state) => state.toClient);

  const mapRef = useRef<MapCanvasRef>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * L'intervention vient d'être close par notre propre confirmation.
   *
   * Même témoin que sur la fiche, et pour la même raison : la file exclut
   * `closed`, donc la demande disparaît à la seconde où elle aboutit. La
   * réponse du serveur est la seule source certaine de ce qui s'est passé.
   */
  const [justClosed, setJustClosed] = useState(false);
  /** L'utilisateur a déplacé la carte : on cesse de la recentrer sous ses doigts. */
  const [freeCamera, setFreeCamera] = useState(false);

  /**
   * Hauteur réelle du cadran, mesurée à l'écran.
   *
   * C'est le rembourrage bas de la caméra : sans lui, le cadrage centre le
   * trajet sur la moitié géométrique de l'écran, donc pour partie **derrière**
   * le cadran. La valeur initiale est une estimation raisonnable pour le
   * premier cadrage, qui a lieu avant la première passe de mise en page ; le
   * cadrage suivant, celui qui englobe le tracé, se fait sur la mesure.
   *
   * Elle ne peut pas être une constante : le bandeau d'estimation approximative
   * et la ligne « recherche de votre position » apparaissent et disparaissent,
   * et le cadran gagne ou perd vingt points selon l'appareil et sa barre
   * système.
   */
  const [dockHeight, setDockHeight] = useState(260);
  const barInset = useActionBarInset();

  const onDockLayout = useCallback((event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.height);
    // Comparaison avant écriture : `onLayout` se rappelle à chaque passe, et
    // reposer la même valeur relancerait un rendu pour rien.
    setDockHeight((current) => (current === measured ? current : measured));
  }, []);

  const job = useMemo(() => {
    const all = [...(jobs.data?.incoming ?? []), ...(jobs.data?.active ?? [])];
    return all.find((candidate) => candidate.id === requestId) ?? null;
  }, [jobs.data, requestId]);

  /**
   * Le dernier état connu du dossier.
   *
   * Une intervention close quitte la file : `job` retombe à `null` au moment
   * même où l'on veut nommer ce qui vient de se terminer. On garde donc la
   * dernière version vue, qui n'a pas à être fraîche — elle ne sert qu'à
   * rappeler de quelle panne et de quel client il s'agissait.
   */
  const lastJob = useRef<Job | null>(null);

  useEffect(() => {
    if (job) lastJob.current = job;
  }, [job]);

  /**
   * Position de départ **stabilisée**.
   *
   * On ne passe pas `fix` brut au calcul : il change toutes les cinq secondes,
   * y compris à l'arrêt où le GPS oscille de quelques mètres. On ne retient un
   * nouveau départ que lorsque le véhicule a réellement avancé, ou que le
   * dernier calcul a vieilli — les deux seuils du contrat.
   */
  const origin = useStableOrigin(fix ? { lat: fix.lat, lng: fix.lng } : null);
  const route = useJobRoute(requestId ?? '', origin);
  const leg = route.data ?? null;

  /** Le tracé routier, ou `null` tant que le serveur n'en a pas rendu un. */
  const routePoints = leg && leg.geometry.length > 1 ? leg.geometry : null;

  /**
   * Ce qui a déjà été cadré, et avec quoi.
   *
   * Déclaré avant `frameRoute` parce que c'est lui qui l'écrit : le repère est
   * posé par le geste de cadrage, quelle que soit son origine. Le bouton de
   * recentrage marque donc l'écran comme cadré au même titre que l'ouverture,
   * et l'effet ci-dessous n'a plus de raison de repasser derrière lui.
   */
  const framed = useRef<{ key: string; withRoute: boolean } | null>(null);

  /**
   * Amène le trajet entier à l'écran.
   *
   * Sur la géométrie quand elle est là, sur les deux extrémités sinon : un
   * itinéraire qui contourne un quartier sort du rectangle formé par son départ
   * et son arrivée, et se ferait couper au tiers si on ne cadrait que celles-ci.
   */
  const frameRoute = useCallback(() => {
    if (!job || !origin) return;

    framed.current = {
      // La destination fait partie de la clé : elle change une fois, au passage
      // de la maille de confidentialité à la position exacte, et ce déplacement
      // de cinq cents mètres mérite un nouveau cadrage.
      key: `${job.id}:${job.origin.lat},${job.origin.lng}`,
      withRoute: routePoints !== null,
    };

    const start: [number, number] = [origin.lng, origin.lat];
    const destination: [number, number] = [job.origin.lng, job.origin.lat];

    mapRef.current?.frame(
      routePoints ? [start, ...routePoints, destination] : [start, destination],
    );
  }, [job, origin, routePoints]);

  /**
   * Cadrage d'ouverture.
   *
   * **Le point délicat est le déclenchement, pas le cadrage.** La version
   * précédente excluait `origin` de ses dépendances pour ne pas recadrer à
   * chaque point GPS — l'intention était juste, la conséquence non : au premier
   * passage `origin` vaut encore `null`, puisque `useStableOrigin` ne le
   * renseigne que dans son propre effet. L'effet sortait donc sans rien faire et
   * ne repassait jamais. La caméra restait sur la vue initiale, le tracé était
   * peint hors champ, et il fallait pousser la carte à la main pour faire
   * apparaître le bouton de recentrage — le seul chemin qui appelait encore
   * `fitTo`.
   *
   * On sépare donc les deux questions au lieu de les confondre dans une liste de
   * dépendances : l'effet **écoute tout** ce dont il a besoin, et c'est un
   * repère explicite qui garantit qu'il ne cadre qu'une fois.
   *
   * Ce repère a deux crans, parce qu'il y a deux cadrages légitimes : dès que la
   * position est connue on cadre sur les extrémités, pour que quelque chose de
   * juste s'affiche tout de suite ; puis une seule fois de plus, quand le tracé
   * arrive, pour l'englober réellement. Ensuite plus rien ne bouge — la carte ne
   * doit pas respirer sous quelqu'un qui conduit.
   */
  useEffect(() => {
    if (!job || !origin || freeCamera) return;

    const done = framed.current;
    const key = `${job.id}:${job.origin.lat},${job.origin.lng}`;

    // Déjà cadré pour ce trajet, et soit le tracé y était déjà, soit il n'y a
    // toujours rien de neuf à englober.
    if (done?.key === key && (done.withRoute || routePoints === null)) return;

    frameRoute();
  }, [job, origin, routePoints, freeCamera, frameRoute]);

  const buzz = useCallback((type: Haptics.NotificationFeedbackType) => {
    if (usePreferences.getState().haptics) void Haptics.notificationAsync(type);
  }, []);

  const run = useCallback(
    async (work: () => Promise<unknown>) => {
      setError(null);
      setBusy(true);
      try {
        await work();
        buzz(Haptics.NotificationFeedbackType.Success);
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
   * Reconnaissance sur place.
   *
   * Ouverte tant que **ce côté-ci** n'a pas confirmé son arrivée, et seulement
   * sur une demande engagée. Une fois la confirmation passée, la question n'a
   * plus lieu d'être : la reposer laisserait croire que l'envoi n'est pas passé,
   * alors que la route est idempotente et l'a déjà enregistré.
   */
  const canArrive =
    job !== null &&
    job.garageArrivedAt === null &&
    (job.status === 'accepted' ||
      job.status === 'en_route' ||
      job.status === 'awaiting_confirmation');

  const proximity = useProximity(toClient, canArrive);

  const onCallClient = useCallback(() => {
    if (job?.client.phone) void Linking.openURL(`tel:${job.client.phone}`);
  }, [job]);

  /**
   * « Oui, j'y suis » — un geste, et l'intervention avance d'autant de crans
   * qu'il le faut.
   *
   * Le serveur refuse une arrivée tant que le départ n'a pas été déclaré. Or la
   * panne est parfois à deux rues de l'atelier : le garagiste accepte, arrive,
   * et se voit demander d'appuyer sur « Je pars » pour avoir le droit de dire
   * qu'il est arrivé. Les deux gestes se confondent dans ce cas, on les
   * enchaîne.
   *
   * L'ordre compte et n'est pas négociable : `en_route` fait basculer l'écran du
   * client sur le suivi en direct, et c'est ce passage-là qui rend l'arrivée
   * confirmable de son côté. L'inverser ferait échouer la seconde requête.
   */
  const onProximityConfirm = useCallback(() => {
    if (!job) return;
    const position = fix ? { lat: fix.lat, lng: fix.lng } : null;

    void run(async () => {
      if (job.enRouteAt === null) {
        await act.mutateAsync({ requestId: job.id, action: 'en_route' });
      }
      const updated = await confirmArrival.mutateAsync({ requestId: job.id, position });
      if (updated.status === 'closed') setJustClosed(true);
    });
  }, [job, fix, run, act, confirmArrival]);

  /*
    La clôture avant l'absence — même raison que sur la fiche : une demande
    close **est** une demande absente de la file, et la tester en second ferait
    passer chaque fin d'intervention réussie pour une disparition.
  */
  if (justClosed) {
    return (
      <JobDone
        job={lastJob.current}
        onClose={() => router.replace('/(drawer)/(tabs)/interventions' as never)}
      />
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {jobs.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text variant="txt" tone="secondary" style={{ textAlign: 'center', paddingHorizontal: 32 }}>
              {t('jobs.gone')}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const departed = job.enRouteAt !== null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <MapCanvas
        ref={mapRef}
        /*
          `dockHeight` ne mesure que ce qui est **dans le flux** du cadran. La
          barre d'action, elle, se pose en absolu et ne compte donc pas dans
          cette hauteur : il faut l'ajouter à la main. La feuille de proximité,
          qui est dans le flux, est déjà comprise dans la mesure — d'où le zéro
          dans ce cas, et non un second ajout qui réserverait deux fois la même
          place.
        */
        paddingBottom={dockHeight + (proximity.near ? 0 : barInset)}
        onUserGesture={() => setFreeCamera(true)}
      >
        {origin ? <UserPuck position={origin} accuracyM={fix?.accuracyM ?? null} /> : null}

        {/*
          Le tracé n'est peint que s'il vient du réseau routier. En repli, la
          géométrie est vide côté serveur — et c'est voulu : une ligne droite
          qui traverse les bâtiments se lit comme un bug du tracé, alors que
          l'absence de tracé, accompagnée du bandeau d'estimation, dit ce qui
          s'est réellement passé.
        */}
        {leg && leg.geometry.length > 1 ? <RouteLine coordinates={leg.geometry} /> : null}

        <Marker
          id="job-destination"
          lngLat={[job.origin.lng, job.origin.lat]}
          anchor="center"
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: theme.colors.primary,
              borderWidth: 3,
              borderColor: theme.colors.surface,
            }}
          />
        </Marker>
      </MapCanvas>

      {/* — Retour, posé sur la carte — */}
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            margin: theme.space.sm,
            gap: theme.space.sm,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={10}
            style={({ pressed }) => ({
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.rule,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <ChevronLeftIcon color={theme.colors.ink} />
          </Pressable>

          <View
            style={{
              flex: 1,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.rule,
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.sm,
            }}
          >
            <Text variant="h2b" numberOfLines={1}>
              {job.client.fullName}
            </Text>
            <Text variant="txt" tone="secondary" numberOfLines={1}>
              {PROBLEM_LABELS[job.problemType][locale]}
            </Text>
          </View>

          {/*
            Recentrage, offert **en permanence** dès qu'il y a un trajet à
            cadrer.

            Il n'apparaissait auparavant qu'après un geste de l'utilisateur,
            au motif qu'un bouton permanent serait sans effet tant que la caméra
            suit déjà. Sauf que la caméra ne suit pas : elle cadre à l'ouverture
            et ne bouge plus. Un dépanneur qui roule cinq kilomètres sans avoir
            touché l'écran sortait donc du cadre sans aucun moyen d'y revenir —
            l'inverse exact de ce que le bouton devait éviter.
          */}
          {origin ? (
            <Pressable
              onPress={() => {
                setFreeCamera(false);
                frameRoute();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('jobs.recenter')}
              style={({ pressed }) => ({
                width: MIN_TOUCH_TARGET,
                height: MIN_TOUCH_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.rule,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <CrosshairIcon color={theme.colors.ink} size={20} />
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      {/* — Le cadran — */}
      <View
        onLayout={onDockLayout}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <View
          style={{
            // Sombre dans les deux thèmes — cf. le jeton `panel`.
            backgroundColor: theme.colors.panel,
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.lg,
            paddingBottom: theme.space.lg,
            gap: theme.space.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.lg }}>
            <View style={{ gap: 2 }}>
              <Text variant="lblb" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {t('jobs.timeToArrive')}
              </Text>
              {/*
                Le chiffre le plus gros de l'app après le compteur de vitesse :
                c'est celui que le garagiste lit en conduisant, et celui qu'il
                annonce au téléphone.
              */}
              <Text variant="numXl" style={{ color: theme.colors.onFill, fontSize: 44, lineHeight: 46 }}>
                {leg ? formatRouteDuration(leg.durationS, locale) : '—'}
              </Text>
            </View>

            <View style={{ flex: 1, gap: theme.space.sm, paddingBottom: 4 }}>
              <Metric
                label={t('jobs.distance')}
                value={leg ? formatDistance(leg.distanceM) : '—'}
              />
              <Metric
                label={t('jobs.arrivalAt')}
                value={leg ? arrivalClock(leg.durationS) : '—'}
              />
            </View>
          </View>

          {/*
            Franchise sur la qualité du calcul.

            Un garagiste qui annonce « 8 min » sur la foi d'une ligne droite
            arrive à quinze et passe pour quelqu'un qui a menti. Le bandeau dit
            que l'estimation n'est pas routière — c'est l'app qui porte
            l'imprécision, pas lui.
          */}
          {leg && !leg.precise ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              <AlertIcon color={theme.colors.highlight} size={14} />
              <Text variant="txt" style={{ color: theme.colors.highlight, flex: 1 }}>
                {t('jobs.roughEstimate')}
              </Text>
            </View>
          ) : null}

          {!origin ? (
            <Text variant="txt" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t('jobs.waitingGps')}
            </Text>
          ) : null}

          {error ? (
            <Text variant="txt" style={{ color: theme.colors.primary }}>
              {error}
            </Text>
          ) : null}
        </View>

        {/*
          À portée de vue, la feuille de reconnaissance **remplace** la barre
          d'action : deux actions cèdent la place à deux actions, et il n'y a
          jamais les deux à la fois.

          Le cadran d'itinéraire, lui, ne bouge pas : le garagiste garde son
          temps de route et sa distance sous les yeux jusqu'au dernier mètre. La
          feuille s'insère au-dessous, dans le flux — c'est le conteneur qui
          grandit vers le haut, pas le cadran qui se fait recouvrir.
        */}
        {proximity.near ? (
          <ProximitySheet
            distanceM={proximity.distanceM}
            otherName={job.client.fullName}
            lead={t('proximity.garageLead')}
            question={t('proximity.question')}
            confirmLabel={t('proximity.confirm')}
            onConfirm={onProximityConfirm}
            onCall={job.client.phone ? onCallClient : null}
            onDismiss={proximity.dismiss}
            busy={busy}
          />
        ) : (
          /*
            Deux actions, même grammaire que sur la fiche : joindre à gauche,
            l'engagement à droite. Tant que le départ n'est pas déclaré, c'est
            « je pars » — le client voit alors son garagiste se mettre en route,
            et le suivi temps réel démarre de son côté.
          */
          <ActionBar
            busy={busy}
            secondary={{
              label: t('jobs.callClient'),
              icon: PhoneIcon,
              onPress: onCallClient,
              disabled: !job.client.phone,
            }}
            primary={
              departed
                ? {
                    label: t('jobs.confirmArrival'),
                    icon: CheckIcon,
                    onPress: () =>
                      void run(async () => {
                        const updated = await confirmArrival.mutateAsync({
                          requestId: job.id,
                          position: fix ? { lat: fix.lat, lng: fix.lng } : null,
                        });
                        if (updated.status === 'closed') setJustClosed(true);
                      }),
                  }
                : {
                    label: t('jobs.enRoute'),
                    icon: CheckIcon,
                    onPress: () =>
                      void run(() => act.mutateAsync({ requestId: job.id, action: 'en_route' })),
                  }
            }
          />
        )}
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
      <Text variant="lblb" style={{ color: 'rgba(255,255,255,0.55)', width: 74 }}>
        {label}
      </Text>
      <Text variant="num" style={{ color: theme.colors.onFill }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Départ retenu pour le calcul d'itinéraire.
 *
 * Le GPS republie une position toutes les cinq secondes, y compris à l'arrêt où
 * il oscille de quelques mètres. Passer ce flux tel quel au routage
 * relancerait un calcul par tick — pour un tracé identique, sur le forfait de
 * quelqu'un qui conduit.
 *
 * On ne change de départ que si l'un des deux seuils est franchi : un
 * déplacement réel, ou l'ancienneté du dernier calcul. Le second existe pour
 * que la durée ne se fige pas indéfiniment dans un embouteillage — le trajet ne
 * change pas, mais l'heure d'arrivée, elle, avance.
 */
function useStableOrigin(fix: LatLng | null): LatLng | null {
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const decidedAt = useRef(0);

  useEffect(() => {
    if (!fix) return;

    const now = Date.now();
    const moved = origin ? haversineMeters(origin, fix) : Infinity;
    const aged = now - decidedAt.current;

    if (
      origin === null ||
      (moved >= ROUTE_REFRESH.minMoveMeters && aged >= ROUTE_REFRESH.minIntervalMs) ||
      aged >= ROUTE_REFRESH.staleAfterMs
    ) {
      decidedAt.current = now;
      setOrigin(fix);
    }
    // Dépendance sur les coordonnées et non sur l'objet : l'appelant en
    // construit un neuf à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix?.lat, fix?.lng]);

  return origin;
}
