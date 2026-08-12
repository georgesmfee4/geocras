import { Pressable, View } from 'react-native';
import {
  isRequestOngoing,
  PROBLEM_LABELS,
  REQUEST_STATUS_LABELS,
  VEHICLE_LABELS,
  type RequestHistoryResponse,
  type RequestStatus,
} from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { BlinkingDot } from '../ui/BlinkingDot';
import { ChevronRightSmallIcon, ShieldCheckIcon, StarIcon } from '../ui/icons';
import { Text } from '../ui/Text';

export type HistoryRequest = RequestHistoryResponse['results'][number];

/** Largeur de la gouttière qui porte le fil du temps. */
export const RAIL_WIDTH = 28;
const NODE = 9;

/** Hauteur à laquelle le nœud tombe : le milieu de la première ligne de texte. */
const NODE_TOP = 18;

/**
 * Couleur d'un état.
 *
 * Trois familles, et pas une par statut : ce qui compte en parcourant une liste
 * est l'issue — ça avance, c'est fini, c'est tombé. Le libellé exact est là
 * pour qui s'arrête sur la ligne.
 */
export function statusColor(status: RequestStatus, colors: ReturnType<typeof useTheme>['colors']): string {
  if (status === 'closed') return colors.success;
  if (status === 'cancelled') return colors.muted;
  // En attente d'un garage : jaune, la couleur de ce qui demande de
  // l'attention sans être grave. Une fois le garagiste engagé, rouge — c'est
  // une intervention en cours, le même rouge que le SOS qui l'a ouverte.
  if (status === 'pending' || status === 'selected') return colors.highlight;
  return colors.primary;
}

/**
 * Une demande dans l'historique.
 *
 * La ligne est bâtie autour d'un **fil du temps** : un trait vertical continu
 * dans la gouttière de gauche, avec un nœud par demande. C'est ce qui donne à
 * la liste sa lecture chronologique sans écrire « le 12, puis le 9, puis le
 * 4 » — et le nœud porte la couleur de l'issue, donc l'œil trie avant de lire.
 *
 * Trois informations sont hiérarchisées dans cet ordre, parce que c'est celui
 * dans lequel on cherche : **quelle panne**, **quel garage**, **quand**. Le
 * statut vient en pastille à droite du titre, la durée en mono sous elle.
 *
 * La demande encore vivante n'est pas rendue ici : elle a sa propre carte en
 * tête d'écran. Cette ligne-ci ne montre donc que du passé, sauf reprise d'un
 * historique où le socket aurait pris du retard — d'où la pastille clignotante
 * conservée dans ce cas.
 */
export function RequestCard({
  request,
  first,
  last,
  onPress,
  onRate,
}: {
  request: HistoryRequest;
  /** Le fil ne descend pas au-dessus du premier nœud du groupe. */
  first: boolean;
  /** Ni en dessous du dernier. */
  last: boolean;
  onPress: (() => void) | null;
  /** Fourni seulement quand la note est encore possible. */
  onRate: (() => void) | null;
}) {
  const theme = useTheme();
  const { t, locale, formatDate, formatTime, formatDuration } = useI18n();

  const ongoing = isRequestOngoing(request.status);
  const color = statusColor(request.status, theme.colors);

  /**
   * Durée réelle de l'intervention.
   *
   * Comptée depuis le choix du garage et non depuis l'ouverture du formulaire :
   * entre les deux, le client compare les garages, et ces minutes-là ne sont
   * pas du dépannage. `selectedAt` est nul sur les demandes antérieures à la
   * migration 0004 — on retombe alors sur `createdAt`, ce qui reste vrai à
   * défaut d'être juste.
   */
  const durationMin =
    request.closedAt !== null
      ? Math.max(
          1,
          Math.round(
            (Date.parse(request.closedAt) -
              Date.parse(request.selectedAt ?? request.createdAt)) /
              60_000,
          ),
        )
      : null;

  const vehicle =
    request.vehicleLabel ?? VEHICLE_LABELS[request.vehicleType][locale];

  return (
    <View style={{ flexDirection: 'row' }}>
      {/*
        Gouttière : deux segments de fil et un nœud entre les deux.

        Deux segments plutôt qu'un trait unique masqué : aux extrémités du
        groupe, le fil doit s'arrêter **au nœud** et non dépasser dans le vide —
        un fil qui pend sous la dernière ligne du mois se lit comme une ligne
        qui n'a pas fini de charger. Un mois qui ne compte qu'une demande
        n'affiche donc aucun trait, seulement son nœud.
      */}
      <View style={{ width: RAIL_WIDTH, alignItems: 'center' }}>
        {!first ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              height: NODE_TOP,
              width: 1,
              backgroundColor: theme.colors.rule,
            }}
          />
        ) : null}

        {!last ? (
          <View
            style={{
              position: 'absolute',
              top: NODE_TOP + NODE,
              bottom: 0,
              width: 1,
              backgroundColor: theme.colors.rule,
            }}
          />
        ) : null}

        <View style={{ marginTop: NODE_TOP }}>
          {ongoing ? (
            <BlinkingDot size={NODE} color={color} />
          ) : (
            <View
              style={{
                width: NODE,
                height: NODE,
                borderRadius: NODE / 2,
                backgroundColor: color,
              }}
            />
          )}
        </View>
      </View>

      <Pressable
        onPress={onPress ?? undefined}
        disabled={onPress === null}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${PROBLEM_LABELS[request.problemType][locale]}, ${
          REQUEST_STATUS_LABELS[request.status][locale]
        }, ${formatDate(request.createdAt)}`}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: MIN_TOUCH_TARGET,
          paddingVertical: theme.space.md,
          paddingRight: theme.space.xl,
          gap: 3,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <Text variant="h2" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
            {PROBLEM_LABELS[request.problemType][locale]}
          </Text>

          <StatusBadge status={request.status} color={color} />

          {onPress ? <ChevronRightSmallIcon color={theme.colors.muted} size={14} /> : null}
        </View>

        {/* Le garage passe avant la date : c'est lui qu'on cherche en revenant. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
          <Text
            variant="small"
            tone={request.garageName ? 'secondary' : 'muted'}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {request.garageName ?? t('history.noGarage')}
          </Text>
          {request.garageCertified ? (
            <ShieldCheckIcon color={theme.colors.success} size={13} />
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          {/* Date, heure et durée : trois mesures, donc mono et chiffres tabulaires. */}
          <Text variant="numSm" tone="muted">
            {formatDate(request.createdAt)} · {formatTime(request.createdAt)}
          </Text>

          {durationMin !== null ? (
            <Text variant="numSm" tone="muted">
              · {formatDuration(durationMin)}
            </Text>
          ) : null}

          <Text variant="numSm" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            · {vehicle}
          </Text>
        </View>

        {request.status === 'cancelled' && request.cancelReason ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {t('history.cancelledBy')} : {request.cancelReason}
          </Text>
        ) : null}

        {/*
          La note se propose ici, et pas seulement sur la fiche du garage :
          c'est en revoyant la ligne « Garage Central, mardi » qu'on se souvient
          de ce qu'on en a pensé. Elle rapporte aussi des points, donc la
          proposer là où elle manque n'est pas un ornement.
        */}
        {onRate ? (
          <Pressable
            onPress={onRate}
            accessibilityRole="button"
            accessibilityLabel={t('history.rate')}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: theme.space.xs,
              marginTop: theme.space.xs,
              paddingVertical: 5,
              paddingHorizontal: theme.space.sm,
              backgroundColor: theme.colors.highlightTint,
              borderLeftWidth: 2,
              borderLeftColor: theme.colors.highlight,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <StarIcon color={theme.colors.userPositionDeep} size={13} />
            <Text variant="smallStrong">{t('history.rate')}</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * Pastille d'état.
 *
 * Filet de la couleur de l'état et libellé dedans, sans aplat : sept lignes
 * portant chacune un rectangle plein transformeraient la liste en guirlande.
 * Le rayon reste à zéro — la pilule arrondie est justement ce que la règle des
 * rayons interdit.
 */
function StatusBadge({ status, color }: { status: RequestStatus; color: string }) {
  const theme = useTheme();
  const { locale } = useI18n();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: color,
        paddingHorizontal: theme.space.sm,
        paddingVertical: 2,
      }}
    >
      <Text variant="sectionLabel" style={{ color }}>
        {REQUEST_STATUS_LABELS[status][locale]}
      </Text>
    </View>
  );
}
