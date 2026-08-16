import { View } from 'react-native';
import {
  arrivalClock,
  formatRouteDuration,
  STOPPED_SPEED_KMH,
  type ApproachRoute,
  type RequestDetail,
  type RequestStatus,
  type TrackingEta,
} from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { dataAgeSeconds, type ConnectionState } from '../stores/tracking';
import { useTheme } from '../theme/ThemeProvider';
import { BlinkingDot } from '../ui/BlinkingDot';
import { AlertIcon, ShieldCheckIcon } from '../ui/icons';
import { Text } from '../ui/Text';
import { TrackingProgress } from './TrackingProgress';

export type LivePanelProps = {
  status: RequestStatus;
  mechanic: RequestDetail['mechanic'];
  garageName: string | null;
  /** ETA serveur du garagiste vers la panne. `null` avant le premier ping. */
  toClient: TrackingEta | null;
  /** Trajet routier. Prioritaire sur l'ETA à vol d'oiseau quand il existe. */
  route: ApproachRoute | null;
  clientArrived: boolean;
  connection: ConnectionState;
  lastPacketAt: number | null;
};

/**
 * Le panneau du suivi client.
 *
 * Il tient sur une règle : **ne jamais afficher un chiffre sans dire d'où il
 * vient ni quand il a été mesuré.** Quelqu'un assis dans une voiture en panne
 * regarde ce panneau toutes les trente secondes ; un « 8 min » figé depuis
 * quatre minutes détruit plus de confiance que pas de chiffre du tout.
 *
 * D'où trois signaux qui accompagnent la durée, et qui sont le vrai contenu de
 * l'écran :
 *
 *  - **la fraîcheur** — l'âge du dernier paquet reçu, en secondes réelles ;
 *  - **le mouvement** — « en approche » ou « à l'arrêt », déduit de la vitesse
 *    réellement mesurée. C'est ce qui explique un ETA qui ne descend plus :
 *    feu rouge, embouteillage, ou dépanneur garé ;
 *  - **la nature du calcul** — routier ou à vol d'oiseau.
 *
 * Fond encre : le panneau est posé sur une carte claire, et il doit s'en
 * détacher sans rideau translucide — un voile sur une carte au soleil rend les
 * deux illisibles.
 */
export function LivePanel({
  status,
  mechanic,
  garageName,
  toClient,
  route,
  clientArrived,
  connection,
  lastPacketAt,
}: LivePanelProps) {
  const theme = useTheme();
  const { t, locale, formatDistance } = useI18n();

  /**
   * La durée vient du **calcul routier** dès qu'il existe, et de l'ETA du suivi
   * sinon. Les deux sont produits par le serveur — jamais recalculés ici — mais
   * le routier tient compte des rues, là où l'autre corrige un vol d'oiseau par
   * un facteur moyen. Sur un quartier mal maillé, l'écart se compte en minutes.
   */
  const durationS = route?.durationS ?? (toClient?.etaMin != null ? toClient.etaMin * 60 : null);
  const distanceM = route?.distanceM ?? toClient?.distanceM ?? null;

  const age = dataAgeSeconds(lastPacketAt);
  const speedKmh = toClient?.speedKmh ?? null;
  const stopped = speedKmh !== null && speedKmh < STOPPED_SPEED_KMH;
  const arrived = status === 'awaiting_confirmation' || status === 'closed';

  return (
    <View
      style={{
        backgroundColor: theme.colors.ink,
        paddingHorizontal: theme.space.lg,
        paddingTop: theme.space.lg,
        paddingBottom: theme.space.md,
        gap: theme.space.lg,
      }}
    >
      <TrackingProgress status={status} clientArrived={clientArrived} />

      {/* — Le chiffre, et ce qu'il vaut — */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.lg }}>
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <Text variant="lbl" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {arrived ? t('live.onSite') : t('live.arrivesIn')}
            </Text>
            {!arrived && connection === 'live' ? (
              <BlinkingDot size={6} color={theme.colors.success} />
            ) : null}
          </View>

          <Text
            variant="numXl"
            style={{ color: theme.colors.surface, fontSize: 44, lineHeight: 46 }}
          >
            {arrived ? '—' : durationS === null ? '···' : formatRouteDuration(durationS, locale)}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 6, paddingBottom: 4 }}>
          <Row
            label={t('jobs.distance')}
            value={distanceM === null ? '—' : formatDistance(distanceM)}
          />
          <Row
            label={t('jobs.arrivalAt')}
            value={arrived || durationS === null ? '—' : arrivalClock(durationS)}
          />
          {/*
            La fraîcheur en clair, pas une jauge : « MAJ 12s » se comprend sans
            légende, et c'est la seule chose qui distingue un suivi vivant d'une
            capture d'écran.
          */}
          <Row label={t('tracking.updated')} value={age === null ? '—' : `${age} s`} />
        </View>
      </View>

      {/* — Mouvement réel — */}
      {!arrived && toClient?.position ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: stopped ? theme.colors.highlight : theme.colors.success,
            }}
          />
          <Text variant="txt" style={{ color: 'rgba(255,255,255,0.75)', flex: 1 }}>
            {stopped
              ? t('live.stopped')
              : speedKmh === null
                ? t('live.moving')
                : `${t('live.moving')} · ${speedKmh} km/h`}
          </Text>
        </View>
      ) : null}

      {/*
        Franchise sur la qualité du calcul, exactement comme du côté garagiste :
        les deux parties doivent savoir la même chose du chiffre qu'elles
        regardent. Sans ça, le client tient pour acquis un « 8 min » que le
        dépanneur, lui, sait approximatif.
      */}
      {route && !route.precise && !arrived ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <AlertIcon color={theme.colors.highlight} size={14} />
          <Text variant="txt" style={{ color: theme.colors.highlight, flex: 1 }}>
            {t('live.roughEstimate')}
          </Text>
        </View>
      ) : null}

      {route && !route.fromLive && !arrived ? (
        <Text variant="txt" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {t('live.notMovingYet')}
        </Text>
      ) : null}

      {connection !== 'live' ? (
        <Text variant="txt" style={{ color: theme.colors.highlight }}>
          {t('live.degraded')}
        </Text>
      ) : null}

      {/* — Qui vient — */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.14)',
          paddingTop: theme.space.md,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="h2" style={{ color: theme.colors.surface }}>
            {mechanic?.initials ?? '—'}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h2" numberOfLines={1} style={{ color: theme.colors.surface }}>
            {mechanic?.fullName ?? garageName ?? '—'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
            <ShieldCheckIcon color="rgba(255,255,255,0.55)" size={12} />
            <Text variant="txt" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.6)' }}>
              {garageName ?? '—'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
      <Text variant="lbl" style={{ color: 'rgba(255,255,255,0.55)', width: 66 }}>
        {label}
      </Text>
      <Text variant="num" style={{ color: theme.colors.surface }}>
        {value}
      </Text>
    </View>
  );
}
