import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';
import { useCancelRequest } from '../../src/api/hooks';
import { env } from '../../src/config/env';
import { useTracking } from '../../src/realtime/useTracking';
import { dataAgeSeconds, useTrackingStore } from '../../src/stores/tracking';
import { useI18n } from '../../src/i18n/I18nProvider';
import { usePreferences } from '../../src/settings/preferences';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ComingSoon } from '../../src/screens/ComingSoon';
import { AwaitingGarage } from '../../src/sos/AwaitingGarage';
import { forgetSentAt, useSentAt } from '../../src/sos/sentAt';
import { Text } from '../../src/ui/Text';

/**
 * Écran de suivi.
 *
 * Il couvre **deux moments qui n'ont rien à voir** et qu'un seul écran
 * mélangeait jusqu'ici :
 *
 *  - `selected` — la demande est partie, le garage ne l'a pas encore acceptée.
 *    Rien ne bouge, il n'y a ni trajet ni ETA : c'est une attente, et elle a
 *    son propre écran (`AwaitingGarage`) plutôt qu'un bandeau de suivi rempli
 *    de tirets.
 *  - à partir de `accepted` — le garagiste est engagé, le suivi temps réel a
 *    quelque chose à montrer.
 *
 * Le rendu du trajet (tracé trois couches, véhicule qui avance) attend
 * MapLibre, mais la mécanique temps réel est déjà branchée et observable :
 * état de connexion, bascule en mode dégradé, et surtout la **fraîcheur
 * réelle** de la donnée.
 */
export default function SuiviScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { t, translateError } = useI18n();

  const { detail, connection } = useTracking(requestId ?? null);
  const storeStatus = useTrackingStore((state) => state.status);
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
        <Text variant="small" tone="secondary">
          {t('awaiting.loading')}
        </Text>
      </View>
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
            <Text variant="small" tone="inverse">
              {error}
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  return <TrackingBand />;
}

/**
 * Bandeau de suivi — squelette câblé, en attendant le rendu cartographique de
 * la maquette 04.
 */
function TrackingBand() {
  const theme = useTheme();
  const { t } = useI18n();

  const connection = useTrackingStore((state) => state.connection);
  const toClient = useTrackingStore((state) => state.toClient);
  const toGarage = useTrackingStore((state) => state.toGarage);
  const lastPacketAt = useTrackingStore((state) => state.lastPacketAt);

  const age = dataAgeSeconds(lastPacketAt);

  return (
    <ComingSoon title={t('soon.trackingTitle')} lead={t('soon.trackingLead')}>
      <View
        style={{
          backgroundColor: theme.colors.ink,
          padding: theme.space.lg,
          gap: theme.space.md,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="bodyStrong" style={{ color: '#FFFFFF' }}>
            {connection === 'live' ? t('tracking.enRoute') : t('tracking.degraded')}
          </Text>
          {/* Le compteur reflète l'âge réel du dernier paquet reçu. Afficher
              « MAJ 3s » sur une donnée qui en a quarante serait mentir sur la
              seule chose que cet indicateur mesure. */}
          <Text variant="monoSmall" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {t('tracking.updated')} {age === null ? '—' : `${age}s`}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.space.xl }}>
          <View style={{ flex: 1 }}>
            <Text variant="sectionLabel" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t('tracking.toYou')}
            </Text>
            <Text variant="title" style={{ color: '#FFFFFF' }}>
              {toClient?.etaMin === null || toClient === null ? '—' : `${toClient.etaMin} min`}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text variant="sectionLabel" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t('tracking.toGarage')}
            </Text>
            <Text variant="title" tone="primary">
              {toGarage?.etaMin === null || toGarage === null ? '—' : `${toGarage.etaMin} min`}
            </Text>
          </View>
        </View>
      </View>
    </ComingSoon>
  );
}
