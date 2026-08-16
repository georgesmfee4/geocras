import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
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
import { ActionBar } from '../../../src/ui/ActionBar';
import { MapCanvas, type MapCanvasRef } from '../../../src/map/MapCanvas';
import { RouteLine } from '../../../src/map/RouteLine';
import { UserPuck } from '../../../src/map/UserPuck';
import { useLocation } from '../../../src/location/LocationProvider';
import { usePreferences } from '../../../src/settings/preferences';
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

  const mapRef = useRef<MapCanvasRef>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** L'utilisateur a déplacé la carte : on cesse de la recentrer sous ses doigts. */
  const [freeCamera, setFreeCamera] = useState(false);

  const job = useMemo(() => {
    const all = [...(jobs.data?.incoming ?? []), ...(jobs.data?.active ?? [])];
    return all.find((candidate) => candidate.id === requestId) ?? null;
  }, [jobs.data, requestId]);

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

  /** Cadrage initial sur les deux extrémités, puis suivi du véhicule. */
  useEffect(() => {
    if (!job || !origin || freeCamera) return;
    mapRef.current?.fitTo([origin.lng, origin.lat], [job.origin.lng, job.origin.lat]);
    // Volontairement sans `origin` en dépendance : le cadrage large est un
    // geste d'ouverture, pas un suivi. Le recadrer à chaque point ferait
    // respirer la carte en permanence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, freeCamera]);

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

  if (!job) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {jobs.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text variant="txt" tone="secondary">
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
        paddingBottom={260}
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
            <Text variant="h2" numberOfLines={1}>
              {job.client.fullName}
            </Text>
            <Text variant="txt" tone="secondary" numberOfLines={1}>
              {PROBLEM_LABELS[job.problemType][locale]}
            </Text>
          </View>

          {/*
            Recentrage : réapparaît seulement après un geste de l'utilisateur.
            Un bouton permanent occuperait la carte pour une action sans effet
            tant que la caméra suit déjà.
          */}
          {freeCamera && origin ? (
            <Pressable
              onPress={() => {
                setFreeCamera(false);
                mapRef.current?.fitTo(
                  [origin.lng, origin.lat],
                  [job.origin.lng, job.origin.lat],
                );
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
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.ink,
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.lg,
            paddingBottom: theme.space.lg,
            gap: theme.space.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.lg }}>
            <View style={{ gap: 2 }}>
              <Text variant="lbl" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {t('jobs.timeToArrive')}
              </Text>
              {/*
                Le chiffre le plus gros de l'app après le compteur de vitesse :
                c'est celui que le garagiste lit en conduisant, et celui qu'il
                annonce au téléphone.
              */}
              <Text variant="numXl" style={{ color: theme.colors.surface, fontSize: 44, lineHeight: 46 }}>
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
          Deux actions, même grammaire que sur la fiche : joindre à gauche,
          l'engagement à droite. Tant que le départ n'est pas déclaré, c'est
          « je pars » — le client voit alors son garagiste se mettre en route,
          et le suivi temps réel démarre de son côté.
        */}
        <ActionBar
          busy={busy}
          secondary={{
            label: t('jobs.callClient'),
            icon: PhoneIcon,
            onPress: () => {
              if (job.client.phone) void Linking.openURL(`tel:${job.client.phone}`);
            },
            disabled: !job.client.phone,
          }}
          primary={
            departed
              ? {
                  label: t('jobs.confirmArrival'),
                  icon: CheckIcon,
                  onPress: () =>
                    void run(() =>
                      confirmArrival.mutateAsync({
                        requestId: job.id,
                        position: fix ? { lat: fix.lat, lng: fix.lng } : null,
                      }),
                    ),
                }
              : {
                  label: t('jobs.enRoute'),
                  icon: CheckIcon,
                  onPress: () =>
                    void run(() => act.mutateAsync({ requestId: job.id, action: 'en_route' })),
                }
          }
        />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
      <Text variant="lbl" style={{ color: 'rgba(255,255,255,0.55)', width: 74 }}>
        {label}
      </Text>
      <Text variant="num" style={{ color: theme.colors.surface }}>
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
