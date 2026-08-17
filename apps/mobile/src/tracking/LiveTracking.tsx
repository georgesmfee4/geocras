import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ApproachRoute, RequestDetail, RequestStatus, TrackingEta } from '@geocras/shared';
import { useConfirmArrival } from '../api/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useLocation } from '../location/LocationProvider';
import { usePreferences } from '../settings/preferences';
import type { ConnectionState } from '../stores/tracking';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ActionBar } from '../ui/ActionBar';
import { CheckIcon, ChevronLeftIcon, PhoneIcon } from '../ui/icons';
import { Text } from '../ui/Text';
import { LivePanel } from './LivePanel';
import { TrackingMap } from './TrackingMap';

/** Hauteur réservée au panneau pour le cadrage de la caméra. */
const PANEL_PADDING = 330;

export type LiveTrackingProps = {
  requestId: string;
  detail: RequestDetail | null;
  status: RequestStatus;
  toClient: TrackingEta | null;
  route: ApproachRoute | null;
  connection: ConnectionState;
  lastPacketAt: number | null;
  onBack: () => void;
};

/**
 * Le suivi en direct, côté client.
 *
 * Il remplace le bandeau de démonstration posé sous « bientôt disponible » :
 * la mécanique temps réel était branchée depuis le début, mais l'écran n'en
 * montrait rien — ni carte, ni dépanneur qui avance, ni moyen de dire qu'il
 * était arrivé. Le client voyait deux ETA sur fond noir et devait croire
 * l'app sur parole.
 *
 * Trois choses, dans l'ordre où on les cherche quand on attend au bord d'une
 * route : **où il est** (la carte), **quand il arrive** (le panneau), **quoi
 * faire** (la barre d'action).
 *
 * La confirmation d'arrivée est ici et nulle part ailleurs. Elle n'est pas une
 * formalité : la clôture — et donc les points de fidélité des deux parties —
 * exige les **deux** confirmations, et la contrainte SQL
 * `closed_requires_both_arrivals` l'impose au niveau de la base. Sans ce
 * bouton, aucune intervention ne pouvait se terminer.
 */
export function LiveTracking({
  requestId,
  detail,
  status,
  toClient,
  route,
  connection,
  lastPacketAt,
  onBack,
}: LiveTrackingProps) {
  const theme = useTheme();
  const { t, translateError } = useI18n();
  const { fix } = useLocation();

  const confirmArrival = useConfirmArrival(requestId);

  const [error, setError] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);

  const clientArrived = detail?.clientArrivedAt !== null && detail?.clientArrivedAt !== undefined;
  const mechanicPhone = detail?.mechanic?.phone ?? detail?.garage?.phone ?? null;

  /**
   * Le lieu de la panne, pas la position courante du téléphone.
   *
   * C'est là que le véhicule est tombé et là que le dépanneur se rend. Un
   * client qui a marché jusqu'à l'ombre d'un manguier ne doit pas voir le
   * trajet se recalculer vers le manguier.
   */
  const origin = detail?.origin ?? null;
  const mechanicPosition = toClient?.position ?? null;

  /**
   * La confirmation n'est ouverte qu'une fois le garagiste **en route**.
   *
   * C'est la règle du serveur (`confirmArrival` refuse avant `en_route`), et la
   * montrer ici évite de proposer un bouton qui répondrait par une erreur. Un
   * bouton grisé accompagné de sa raison vaut mieux qu'un bouton absent : il
   * annonce ce qui va devenir possible.
   */
  const canConfirm = status === 'en_route' || status === 'awaiting_confirmation';
  const waitingForMechanic = clientArrived && status === 'awaiting_confirmation';

  const onConfirm = useCallback(() => {
    Alert.alert(t('live.confirmTitle'), t('live.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('live.confirmAction'),
        onPress: () => {
          void (async () => {
            setError(null);
            try {
              /**
               * La position accompagne la confirmation : elle est journalisée
               * avec l'événement et sert au contrôle anti-fraude, qui compare
               * l'endroit déclaré à la trace réellement parcourue. `null` est
               * un cas normal — un GPS peut ne pas avoir fixé — et ne doit
               * jamais bloquer la clôture.
               */
              await confirmArrival.mutateAsync(fix ? { lat: fix.lat, lng: fix.lng } : null);
              if (usePreferences.getState().haptics) {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (cause) {
              setError(translateError(cause));
            }
          })();
        },
      },
    ]);
  }, [confirmArrival, fix, t, translateError]);

  if (!origin) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <TrackingMap
        origin={origin}
        accuracyM={fix?.accuracyM ?? null}
        mechanic={mechanicPosition}
        route={route?.geometry ?? []}
        paddingBottom={PANEL_PADDING}
        frozen={frozen}
        onUserGesture={() => setFrozen(true)}
      />

      {/* — Retour et titre, posés sur la carte — */}
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

          {/*
            Le recadrage n'apparaît qu'après un geste : un bouton permanent
            occuperait la carte pour une action sans effet tant qu'elle suit
            déjà le dépanneur.
          */}
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

        <LivePanel
          status={status}
          mechanic={detail?.mechanic ?? null}
          garageName={detail?.garage?.name ?? null}
          toClient={toClient}
          route={route}
          clientArrived={clientArrived}
          connection={connection}
          lastPacketAt={lastPacketAt}
        />

        {/*
          Deux actions, la même grammaire que côté garagiste : joindre à gauche,
          l'engagement à droite. Une fois le client confirmé, le bouton devient
          inerte et son libellé dit qui l'on attend — reproposer « confirmer »
          ferait croire que l'envoi n'est pas passé, alors que la route est
          idempotente et l'a déjà enregistré.
        */}
        <ActionBar
          busy={confirmArrival.isPending}
          secondary={{
            label: t('live.callMechanic'),
            icon: PhoneIcon,
            onPress: () => {
              if (mechanicPhone) void Linking.openURL(`tel:${mechanicPhone}`);
            },
            disabled: !mechanicPhone,
          }}
          primary={{
            label: waitingForMechanic ? t('live.confirmedWaiting') : t('live.confirmArrival'),
            icon: CheckIcon,
            onPress: onConfirm,
            disabled: !canConfirm || clientArrived,
          }}
        />
      </View>
    </View>
  );
}
