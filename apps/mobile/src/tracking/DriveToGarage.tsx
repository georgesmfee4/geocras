import { Marker } from '@maplibre/maplibre-react-native';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  ApproachRoute,
  LatLng,
  RequestDetail,
  RequestStatus,
  TrackingEta,
} from '@geocras/shared';
import { useConfirmArrival, useRequestAction } from '../api/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useLocation } from '../location/LocationProvider';
import { MapCanvas, type MapCanvasRef } from '../map/MapCanvas';
import { RouteLine } from '../map/RouteLine';
import { UserPuck } from '../map/UserPuck';
import { usePreferences } from '../settings/preferences';
import type { ConnectionState } from '../stores/tracking';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ActionBar } from '../ui/ActionBar';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon, PhoneIcon } from '../ui/icons';
import { Text } from '../ui/Text';
import { LivePanel } from './LivePanel';
import { ProximitySheet } from './ProximitySheet';
import { useProximity } from './useProximity';

/** Hauteur réservée au panneau pour le cadrage de la caméra. */
const PANEL_PADDING = 330;

/**
 * Échelle de conduite.
 *
 * Choisie pour rester **au-dessus des seuils d'apparition des rues** : les
 * voies secondaires entrent à 13, leurs noms à 12. Un cadrage qui descend sous
 * ces valeurs laisse un fond presque nu — c'est exactement ce que produisait
 * la version précédente, qui gardait les deux extrémités du trajet à l'écran et
 * tombait donc sous 13 dès cinq kilomètres.
 *
 * Un peu moins de quinze cents mètres de route devant soi sur un téléphone :
 * assez pour anticiper deux carrefours, assez serré pour lire les noms.
 */
const DRIVING_ZOOM = 15.5;

export type DriveToGarageProps = {
  requestId: string;
  detail: RequestDetail | null;
  status: RequestStatus;
  /** ETA serveur du **client** vers l'atelier. `null` avant le premier ping. */
  toGarage: TrackingEta | null;
  route: ApproachRoute | null;
  connection: ConnectionState;
  lastPacketAt: number | null;
  onBack: () => void;
};

/**
 * Le suivi en direct quand **c'est le client qui conduit**.
 *
 * Le miroir de `LiveTracking`, et un écran distinct plutôt qu'un jeu de
 * conditions dans celui-ci : les deux ne montrent pas la même chose, ne posent
 * pas les mêmes gestes, et ne s'adressent pas à quelqu'un dans le même état.
 * Sur `LiveTracking` on attend, assis au bord d'une route, et l'écran répond à
 * « où en est-il ? ». Ici on conduit, et il répond à « où je vais, et où j'en
 * suis ». Empiler les deux aurait produit un composant dont la moitié des
 * lignes commencent par un `if`.
 *
 * ---
 *
 * **Cet écran est le seul endroit d'où part la preuve d'un trajet client.**
 *
 * Deux choses s'y jouent, et aucune n'est visible :
 *
 *  1. le bouton « Je pars » écrit `en_route_at`, qui **ouvre la fenêtre de
 *     lecture de la trace** — `proveArrival` ignore tout point antérieur. Sans
 *     cet appui, un client peut faire tout le trajet sans qu'aucune preuve ne
 *     puisse jamais être établie ;
 *  2. tant que l'écran est monté, `useTracking` — branché par l'écran de suivi
 *     au-dessus — émet la position du téléphone. **C'est cette trace qui vaut
 *     preuve** dans ce mode, exactement comme celle du dépanneur dans l'autre.
 *
 * D'où un parti pris d'ergonomie qui est en réalité une décision technique :
 * « Je pars » n'ouvre **aucune boîte de confirmation**. Un geste de plus, c'est
 * un geste qu'on saute — et un trajet qu'on ne saura pas prouver. Le risque
 * inverse est nul : appuyer trop tôt élargit la fenêtre de lecture, ce qui ne
 * fausse rien.
 */
export function DriveToGarage({
  requestId,
  detail,
  status,
  toGarage,
  route,
  connection,
  lastPacketAt,
  onBack,
}: DriveToGarageProps) {
  const theme = useTheme();
  const { t, translateError } = useI18n();
  const { fix } = useLocation();

  const declareEnRoute = useRequestAction(requestId, 'enRoute');
  const confirmArrival = useConfirmArrival(requestId);

  const [error, setError] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);

  const clientArrived = detail?.clientArrivedAt !== null && detail?.clientArrivedAt !== undefined;
  const garagePhone = detail?.mechanic?.phone ?? detail?.garage?.phone ?? null;

  /** L'atelier : le point fixe vers lequel tout converge dans ce mode. */
  const destination: LatLng | null = detail?.garage
    ? { lat: detail.garage.lat, lng: detail.garage.lng }
    : null;

  /**
   * Ma position sur la carte.
   *
   * Le fix local d'abord, l'ETA serveur ensuite. C'est l'inverse de la règle
   * habituelle du suivi — où le serveur fait autorité pour que les deux parties
   * lisent le même chiffre — et l'exception se justifie : il ne s'agit pas ici
   * d'un chiffre partagé mais du **dessin de ma propre pastille**. Elle doit
   * suivre le volant, pas le débit du réseau. Les distances et les durées
   * affichées, elles, restent celles du serveur.
   */
  const me: LatLng | null = fix ? { lat: fix.lat, lng: fix.lng } : (toGarage?.position ?? null);

  const departed = status === 'en_route' || status === 'awaiting_confirmation';
  const waitingForGarage = clientArrived && status === 'awaiting_confirmation';

  const proximity = useProximity(toGarage, departed && !clientArrived);

  const buzz = useCallback((type: Haptics.NotificationFeedbackType) => {
    if (usePreferences.getState().haptics) void Haptics.notificationAsync(type);
  }, []);

  const onCallGarage = useCallback(() => {
    if (garagePhone) void Linking.openURL(`tel:${garagePhone}`);
  }, [garagePhone]);

  const onLeave = useCallback(() => {
    void (async () => {
      setError(null);
      try {
        await declareEnRoute.mutateAsync();
        buzz(Haptics.NotificationFeedbackType.Success);
      } catch (cause) {
        setError(translateError(cause));
      }
    })();
  }, [declareEnRoute, buzz, translateError]);

  const sendArrival = useCallback(() => {
    void (async () => {
      setError(null);
      try {
        /**
         * La position accompagne la confirmation : elle est journalisée avec
         * l'événement et sert au contrôle anti-fraude, qui compare l'endroit
         * déclaré à la trace réellement parcourue. `null` est un cas normal —
         * un GPS peut ne pas avoir fixé — et ne doit jamais bloquer la clôture.
         */
        await confirmArrival.mutateAsync(fix ? { lat: fix.lat, lng: fix.lng } : null);
        buzz(Haptics.NotificationFeedbackType.Success);
      } catch (cause) {
        setError(translateError(cause));
      }
    })();
  }, [confirmArrival, fix, buzz, translateError]);

  /**
   * L'arrivée depuis la barre d'action passe par une alerte, celle de la
   * feuille de proximité non.
   *
   * Même arbitrage que côté dépanneur : la barre est atteignable à tout moment,
   * y compris par erreur, et elle engage la clôture. La feuille, elle, **est**
   * déjà la question — « vous y êtes ? ». Y répondre oui puis confirmer qu'on a
   * bien voulu répondre oui est le clic de trop qu'elle existe pour supprimer.
   */
  const onConfirm = useCallback(() => {
    Alert.alert(t('live.confirmTitleMe'), t('live.confirmBodyMe'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('live.confirmActionMe'), onPress: sendArrival },
    ]);
  }, [t, sendArrival]);

  if (!destination) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GarageMap
        destination={destination}
        me={me}
        accuracyM={fix?.accuracyM ?? null}
        route={route?.geometry ?? []}
        paddingBottom={PANEL_PADDING}
        frozen={frozen}
        onUserGesture={() => setFrozen(true)}
      />

      {/* — Retour et recadrage, posés sur la carte — */}
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
            onPress={onBack}
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

          {frozen ? (
            <Pressable
              onPress={() => setFrozen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('jobs.recenter')}
              style={({ pressed }) => ({
                minHeight: MIN_TOUCH_TARGET,
                paddingHorizontal: theme.space.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.rule,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text variant="lblb">{t('jobs.recenter')}</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      {/* — Panneau et actions — */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        {error ? (
          <View style={{ backgroundColor: theme.colors.primary, padding: theme.space.md }}>
            <Text variant="txt" tone="inverse">
              {error}
            </Text>
          </View>
        ) : null}

        {/*
          Le même panneau que dans l'autre sens, nourri de l'autre ETA.

          Il ne calcule rien : on lui passe `toGarage` là où le suivi classique
          lui passe `toClient`, et le mode ne lui sert qu'à choisir ses mots. Un
          second panneau aurait dupliqué la fraîcheur, le rail de progression et
          l'aveu d'estimation approximative — trois choses qu'on ne veut pas
          voir diverger d'un mode à l'autre.
        */}
        <LivePanel
          status={status}
          mode="at_garage"
          mechanic={detail?.mechanic ?? null}
          garageName={detail?.garage?.name ?? null}
          toClient={toGarage}
          route={route}
          clientArrived={clientArrived}
          connection={connection}
          lastPacketAt={lastPacketAt}
        />

        {proximity.near ? (
          <ProximitySheet
            distanceM={proximity.distanceM}
            otherName={detail?.garage?.name ?? detail?.mechanic?.fullName ?? null}
            lead={t('proximity.atGarageLead')}
            question={t('proximity.atGarageQuestion')}
            confirmLabel={t('proximity.atGarageConfirm')}
            onConfirm={sendArrival}
            onCall={garagePhone ? onCallGarage : null}
            onDismiss={proximity.dismiss}
            busy={confirmArrival.isPending}
          />
        ) : (
          /*
            Une seule action d'engagement à la fois, et elle suit le parcours :
            partir, puis arriver. Afficher les deux ferait choisir entre deux
            boutons rouges à quelqu'un qui tient un volant.
          */
          <ActionBar
            busy={declareEnRoute.isPending || confirmArrival.isPending}
            secondary={{
              label: t('live.callGarage'),
              icon: PhoneIcon,
              onPress: onCallGarage,
              disabled: !garagePhone,
            }}
            primary={
              departed
                ? {
                    label: waitingForGarage
                      ? t('live.confirmedWaitingGarage')
                      : t('live.confirmArrivedMe'),
                    icon: CheckIcon,
                    onPress: onConfirm,
                    disabled: clientArrived,
                  }
                : {
                    label: t('live.leave'),
                    icon: ChevronRightIcon,
                    onPress: onLeave,
                  }
            }
          />
        )}
      </View>
    </View>
  );
}

/**
 * La carte du trajet vers l'atelier.
 *
 * L'inverse exact de `TrackingMap` dans sa composition, et c'est pour ça
 * qu'elle est ici plutôt que branchée dessus par un drapeau : là-bas le point
 * fixe est ma panne et l'objet mobile est le dépanneur ; ici le point fixe est
 * l'atelier et l'objet mobile, c'est moi. La pastille utilisateur change donc
 * de camp — elle suit ma position au lieu de marquer mon véhicule immobile.
 *
 * **Les deux caméras diffèrent pour la même raison.** `TrackingMap` s'adresse à
 * quelqu'un d'arrêté qui regarde un autre approcher : garder les deux points à
 * l'écran est exactement ce qu'il veut, et le dézoom que cela impose ne le gêne
 * pas. Ici on conduit. Ce qui compte est la rue devant soi, pas la vue
 * d'ensemble — et vouloir les deux extrémités à l'écran ferait tomber le zoom
 * sous le seuil où les rues sont dessinées. Voir l'effet de cadrage plus bas.
 *
 * L'atelier porte un **jeton circulaire à épingle**, et non l'écusson
 * pentagonal numéroté des résultats de recherche. Ce n'est pas un oubli :
 * `GarageMarker` exige un `rank` qui vient du serveur, et le serveur le retire
 * délibérément du garage retenu (`garageSummarySchema.omit({ rank })`). Il n'y
 * a plus de classement une fois le choix fait — en inventer un ici reviendrait
 * exactement à dériver un rang d'un index de tableau, ce que le cahier des
 * charges interdit.
 */
function GarageMap({
  destination,
  me,
  accuracyM,
  route,
  paddingBottom,
  frozen,
  onUserGesture,
}: {
  destination: LatLng;
  me: LatLng | null;
  accuracyM: number | null;
  route: readonly [number, number][];
  paddingBottom: number;
  frozen: boolean;
  onUserGesture: () => void;
}) {
  const theme = useTheme();
  const mapRef = useRef<MapCanvasRef>(null);

  /** Le premier cadrage a eu lieu : les suivants ne font plus que glisser. */
  const centred = useRef(false);

  /**
   * Une vue de conduite, et non un cadrage du trajet entier.
   *
   * **C'est la correction, et elle vaut d'être expliquée.** La version
   * précédente rejouait `fitTo` sur les deux extrémités à chaque point GPS.
   * Deux défauts en découlaient, et le second est celui qui se voyait :
   *
   *  - la caméra se rejouait toutes les secondes, donc la carte **respirait
   *    sous quelqu'un qui conduit** — l'écran de navigation du garagiste
   *    s'interdit précisément cela ;
   *  - surtout, garder l'atelier à l'écran impose de dézoomer d'autant que le
   *    trajet est long. Sous un panneau de 330 points, la bande utile est
   *    étroite : au-delà de quelques kilomètres le zoom tombait sous 13, et
   *    **les rues disparaissaient purement et simplement** — voies secondaires
   *    et noms ont leurs seuils à 13 et 14. On conduisait sur un fond nu.
   *
   * Le trajet entier n'a pas à tenir à l'écran : la distance et la durée sont
   * dans le panneau, le tracé indique la direction, et la carte est
   * manipulable — un pincement montre l'ensemble quand on le veut.
   *
   * On centre donc une fois à l'échelle de la rue, puis on **glisse** avec le
   * véhicule : `follow` conserve le zoom et étale son mouvement sur
   * l'intervalle entre deux points, ce qui donne un défilement continu au lieu
   * d'une saccade par relevé.
   */
  useEffect(() => {
    if (frozen) {
      // Le doigt a pris la carte. On la lui laisse — et le prochain recadrage
      // repartira d'une échelle de rue plutôt que du zoom où elle a été
      // laissée.
      centred.current = false;
      return;
    }

    if (!me) {
      mapRef.current?.recenter([destination.lng, destination.lat], DRIVING_ZOOM);
      return;
    }

    if (!centred.current) {
      centred.current = true;
      mapRef.current?.recenter([me.lng, me.lat], DRIVING_ZOOM);
      return;
    }

    mapRef.current?.follow([me.lng, me.lat]);
    // On se cale sur les coordonnées elles-mêmes, les objets étant reconstruits
    // à chaque rendu par l'appelant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, me?.lat, me?.lng, destination.lat, destination.lng]);

  return (
    <MapCanvas ref={mapRef} paddingBottom={paddingBottom} onUserGesture={onUserGesture}>
      {me ? <UserPuck position={me} accuracyM={accuracyM} /> : null}

      {route.length > 1 ? <RouteLine coordinates={route} /> : null}

      <Marker id="garage" lngLat={[destination.lng, destination.lat]} anchor="center">
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: theme.colors.primary,
            borderWidth: 3,
            borderColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MapPinIcon color={theme.colors.onFill} size={20} />
        </View>
      </Marker>
    </MapCanvas>
  );
}
