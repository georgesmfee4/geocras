import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';
import { useApproachRoute, useCancelRequest } from '../../src/api/hooks';
import { env } from '../../src/config/env';
import { useTracking } from '../../src/realtime/useTracking';
import { useTrackingStore } from '../../src/stores/tracking';
import { useI18n } from '../../src/i18n/I18nProvider';
import { usePreferences } from '../../src/settings/preferences';
import { useTheme } from '../../src/theme/ThemeProvider';
import { AwaitingGarage } from '../../src/sos/AwaitingGarage';
import { forgetSentAt, useSentAt } from '../../src/sos/sentAt';
import { LiveTracking } from '../../src/tracking/LiveTracking';
import { TrackingDone } from '../../src/tracking/TrackingDone';
import { Text } from '../../src/ui/Text';

/**
 * Écran de suivi, côté client.
 *
 * Il couvre **quatre moments qui n'ont rien à voir**, et c'est pour ça qu'il
 * délègue à quatre rendus plutôt que d'empiler des conditions :
 *
 *  - `selected` — la demande est partie, le garage n'a pas répondu. Rien ne
 *    bouge : ni trajet, ni ETA. C'est une attente, et elle a son écran
 *    (`AwaitingGarage`) plutôt qu'un suivi rempli de tirets ;
 *  - `pending` — le garage a refusé, la demande repart en recherche. On renvoie
 *    le client à la liste avec un mot d'explication ;
 *  - `accepted` → `awaiting_confirmation` — le dépanneur est engagé. Carte,
 *    position en direct, ETA recalculé sur le réseau routier, et surtout la
 *    **confirmation d'arrivée** ;
 *  - `closed` — c'est fini, et il faut le dire.
 */
export default function SuiviScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { t, translateError } = useI18n();

  const { detail, connection } = useTracking(requestId ?? null);
  const storeStatus = useTrackingStore((state) => state.status);
  const toClient = useTrackingStore((state) => state.toClient);
  const lastPacketAt = useTrackingStore((state) => state.lastPacketAt);
  const cancelRequest = useCancelRequest(requestId ?? '');

  const [error, setError] = useState<string | null>(null);

  /**
   * Instant d'envoi du SOS à ce garage.
   *
   * Deux sources, dans cet ordre : `selectedAt`, écrit par le serveur au
   * moment de la transition — c'est la date que voient les deux parties — puis
   * celle que l'app a retenue en appuyant sur « Envoyer », qui la connaît sans
   * attendre le rechargement de la demande et survit à un redémarrage.
   *
   * **Jamais `createdAt`.** L'ouverture du formulaire de panne peut précéder le
   * choix du garage de vingt minutes de comparaison ; les compter comme du
   * temps d'attente est exactement le défaut qu'on corrige ici.
   */
  const rememberedSentAt = useSentAt(requestId ?? null);

  /**
   * Le statut du store prime sur celui de la requête HTTP : il est alimenté
   * par le socket, donc en avance d'un aller-retour sur le cache de Query.
   * C'est lui qui fait basculer l'écran d'attente vers le suivi à la seconde
   * où le garage accepte.
   */
  const status = storeStatus ?? detail?.status ?? null;

  const engaged =
    status === 'accepted' || status === 'en_route' || status === 'awaiting_confirmation';

  /**
   * Trajet routier du dépanneur.
   *
   * Demandé seulement une fois le garagiste engagé, et **reclé sur sa
   * position** : la position arrive par socket à chaque ping, le tracé n'est
   * redemandé que lorsqu'elle a changé de rue. Voir `useApproachRoute`.
   */
  const approach = useApproachRoute(requestId ?? null, toClient?.position ?? null, engaged);

  /**
   * L'acceptation est la seule bonne nouvelle de cet écran, et elle arrive
   * pendant qu'on regarde ailleurs — un téléphone posé sur le capot. Une
   * vibration la signale ; l'écran, lui, change tout seul.
   */
  const wasAwaiting = useRef(false);

  useEffect(() => {
    if (status === 'selected') {
      wasAwaiting.current = true;
      return;
    }

    // Statut encore inconnu : surtout ne rien conclure. C'est l'état du
    // premier rendu, et effacer le repère d'envoi ici reviendrait à le perdre
    // juste avant d'en avoir besoin.
    if (status === null || status === 'pending') return;

    if (wasAwaiting.current && status === 'accepted') {
      // Réglage d'appareil : un téléphone posé sur un tableau de bord vibre
      // bruyamment, et certains coupent la vibration pour de bon.
      if (usePreferences.getState().haptics) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    wasAwaiting.current = false;

    // La demande n'attend plus : le repère local a fait son temps, et rien ne
    // justifie de le laisser traîner dans le stockage de l'appareil.
    if (requestId) forgetSentAt(requestId);
  }, [status, requestId]);

  /**
   * L'arrivée du dépanneur, signalée au corps.
   *
   * Le client ne regarde pas son écran en continu — c'est même tout l'intérêt
   * d'un suivi. Le passage à `awaiting_confirmation` est le moment où on a
   * besoin de lui : une vibration l'appelle, sinon la confirmation attend que
   * quelqu'un pense à rouvrir l'app.
   */
  const wasEnRoute = useRef(false);

  useEffect(() => {
    if (status === 'en_route') {
      wasEnRoute.current = true;
      return;
    }
    if (wasEnRoute.current && status === 'awaiting_confirmation') {
      if (usePreferences.getState().haptics) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
    if (status !== 'awaiting_confirmation') wasEnRoute.current = false;
  }, [status]);

  /**
   * Le garage a refusé : la demande est retombée en `pending`.
   *
   * C'est le seul retour en arrière de la machine à états, et il ne doit pas
   * laisser le client sur un écran de suivi qui ne suit plus rien. On le
   * ramène là où il choisissait — sa demande est intacte, seul le garage a
   * disparu — et `declined` fait afficher le mot d'explication sur place.
   *
   * `replace` et non `push` : l'écran de suivi de cette demande-là n'a plus de
   * sens, et le laisser dans la pile ferait revenir dessus au premier retour.
   */
  useEffect(() => {
    if (status !== 'pending' || !requestId) return;
    router.replace(`/sos/resultats?requestId=${requestId}&declined=1` as never);
  }, [status, requestId, router]);

  const askCancel = useCallback(() => {
    if (!requestId) return;

    Alert.alert(t('results.cancelConfirmTitle'), t('awaiting.cancelConfirmLead'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('results.cancelRequest'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await cancelRequest.mutateAsync('annulation pendant l’attente du garage');
              // On quitte l'écran avant que le nouveau statut n'arrive : c'est
              // ici, et pas dans l'effet de nettoyage, que ce repère-là se
              // referme.
              forgetSentAt(requestId);
              if (usePreferences.getState().haptics) {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              router.replace('/(drawer)/(tabs)/carte');
            } catch (cause) {
              setError(translateError(cause));
            }
          })();
        },
      },
    ]);
  }, [requestId, cancelRequest, router, t, translateError]);

  const leave = useCallback(() => {
    router.replace('/(drawer)/(tabs)/carte');
  }, [router]);

  // Premier chargement : on ne sait pas encore dans quel état est la demande.
  // Montrer le radar d'attente ici ferait clignoter l'écran quand on rouvre
  // une intervention déjà en route.
  if (status === null && detail === null) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.md,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
        <Text variant="txt" tone="secondary">
          {t('awaiting.loading')}
        </Text>
      </View>
    );
  }

  if (status === 'closed') {
    return (
      <TrackingDone
        detail={detail}
        /*
          La note n'est proposée que si le garage est connu : sur une demande
          rouverte depuis un autre appareil, le détail peut ne pas être encore
          arrivé, et un bouton qui mène nulle part vaut moins que pas de bouton.
        */
        onRate={
          detail?.garage
            ? () => router.replace(`/garage/${detail.garage!.id}?review=1` as never)
            : null
        }
        onClose={leave}
      />
    );
  }

  if (engaged) {
    return (
      <LiveTracking
        requestId={requestId ?? ''}
        detail={detail}
        status={status}
        toClient={toClient}
        route={approach.data ?? null}
        connection={connection}
        lastPacketAt={lastPacketAt}
        onBack={leave}
      />
    );
  }

  if (status === 'selected') {
    return (
      <>
        <AwaitingGarage
          garage={detail?.garage ?? null}
          sentAt={detail?.selectedAt ?? rememberedSentAt}
          connection={connection}
          cancelling={cancelRequest.isPending}
          onCancel={askCancel}
          onCallSupport={() => void Linking.openURL(`tel:${env.supportPhone}`)}
        />

        {error ? (
          <View
            style={{
              position: 'absolute',
              left: theme.space.lg,
              right: theme.space.lg,
              bottom: theme.space.xl,
              backgroundColor: theme.colors.primary,
              padding: theme.space.md,
            }}
          >
            <Text variant="txt" tone="inverse">
              {error}
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  /**
   * `cancelled`, ou un état qu'on n'attendait pas ici.
   *
   * On ne laisse pas un écran vide : la demande est close d'une façon ou d'une
   * autre, et le seul geste utile est de repartir de la carte.
   */
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.md,
        padding: theme.space.xl,
      }}
    >
      <Text variant="h1b" style={{ textAlign: 'center' }}>
        {t('live.overTitle')}
      </Text>
      <Text variant="txt" tone="secondary" style={{ textAlign: 'center' }}>
        {t('live.overLead')}
      </Text>
    </View>
  );
}
