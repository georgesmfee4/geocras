import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import {
  isRequestOngoing,
  PROBLEM_LABELS,
  requestStatusLabel,
  VEHICLE_LABELS,
  type RequestHistoryResponse,
  type RequestStatus,
  type ServiceMode,
} from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { BlinkingDot } from '../ui/BlinkingDot';
import {
  AlertIcon,
  ChevronRightSmallIcon,
  ShieldCheckIcon,
  StarIcon,
  type IconProps,
} from '../ui/icons';
import { ServiceModeTag } from '../ui/ServiceModeTag';
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
  onRequestAgain,
}: {
  request: HistoryRequest;
  /** Le fil ne descend pas au-dessus du premier nœud du groupe. */
  first: boolean;
  /** Ni en dessous du dernier. */
  last: boolean;
  onPress: (() => void) | null;
  /** Fourni seulement quand la note est encore possible. */
  onRate: (() => void) | null;
  /**
   * Fourni seulement quand un nouveau SOS vers ce garage a un sens.
   *
   * C'est l'écran qui en décide — voir `requestAgain` dans `historique.tsx`.
   * La carte ne connaît ni la machine à états ni le compte : elle affiche
   * l'action quand on la lui donne, et rien sinon.
   */
  onRequestAgain: (() => void) | null;
}) {
  const theme = useTheme();
  const { t, locale, formatDate, formatTime, formatDuration } = useI18n();

  const ongoing = isRequestOngoing(request.status);
  const color = statusColor(request.status, theme.colors);

  /**
   * De quel côté ce compte se trouvait sur cette demande.
   *
   * Vient du serveur (`role`), jamais déduit ici : l'historique mêle les deux
   * points de vue, et un même compte peut avoir les deux — un garagiste tombe
   * aussi en panne.
   */
  const asGarage = request.role === 'garage';
  const counterpart = asGarage ? request.clientName : request.garageName;

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
          requestStatusLabel(request.status, request.serviceMode)[locale]
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
          <Text variant="h2b" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
            {PROBLEM_LABELS[request.problemType][locale]}
          </Text>

          <StatusBadge
            status={request.status}
            mode={request.serviceMode}
            color={color}
            asGarage={asGarage}
          />

          {onPress ? <ChevronRightSmallIcon color={theme.colors.muted} size={14} /> : null}
        </View>

        {/*
          L'autre partie, avant la date : c'est elle qu'on cherche en revenant.

          Et elle dépend du côté où l'on était. Un garagiste qui relit ses
          interventions veut le nom de la personne dépannée ; lui répéter
          l'enseigne de son propre atelier sur chaque ligne ne lui apprend rien
          et lui fait lire l'écran comme s'il était le client.
        */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
          <Text
            variant="txt"
            tone={counterpart ? 'secondary' : 'muted'}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {counterpart ?? t('history.noGarage')}
          </Text>
          {asGarage ? null : request.garageCertified ? (
            <ShieldCheckIcon color={theme.colors.success} size={13} />
          ) : null}
          {/*
            Où la rencontre a eu lieu, sur la ligne qui dit **avec qui** — les
            deux moitiés de la même information. Rien ne s'affiche sur un
            dépannage sur place : c'est le cas courant, et l'historique doit
            rester une liste qu'on parcourt, pas une liste qu'on décode.
          */}
          <ServiceModeTag mode={request.serviceMode} />
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
          <Text variant="txt" tone="muted" numberOfLines={2}>
            {t('history.cancelledBy')} : {request.cancelReason}
          </Text>
        ) : null}

        {/*
          Les deux suites d'une intervention terminée, dans l'ordre où elles
          servent.

          **Refaire appel d'abord.** C'est la raison n°2 pour laquelle on ouvre
          cet écran — « retrouver le garage qui est venu le mois dernier » — et
          jusqu'ici l'écran s'arrêtait à mi-chemin : il menait à la fiche du
          garage, laquelle ne porte volontairement aucun moyen de le contacter.
          Le client y retrouvait un nom, puis devait recommencer un SOS depuis
          la carte et rechercher ce garage parmi les résultats. Le chemin
          existait, il n'était simplement pas offert là où le besoin naît.

          **Noter ensuite.** Elle se propose ici et pas seulement sur la fiche :
          c'est en revoyant la ligne « Garage Central, mardi » qu'on se souvient
          de ce qu'on en a pensé. Elle rapporte aussi des points.

          Une rangée qui se replie, et non deux puces empilées d'office : sur un
          écran de trois cent vingt points les deux libellés ne tiennent pas
          côte à côte, et `flexWrap` les met l'une sous l'autre sans rien
          tronquer.
        */}
        {onRequestAgain || onRate ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.space.sm,
              marginTop: theme.space.xs,
            }}
          >
            {onRequestAgain ? (
              <ActionChip
                label={t('history.requestAgain')}
                hint={t('history.requestAgainHint')}
                /*
                  Le glyphe SOS, et non celui de la dépanneuse. Deux raisons,
                  dont une de fond : cette puce **ouvre un SOS** — même parcours,
                  même formulaire, même trace — et le triangle est le signe de
                  ce geste partout ailleurs dans l'app.

                  L'autre est une affaire de taille. `TowTruckIcon` porte deux
                  roues et un crochet ; son propre commentaire raconte qu'il a
                  fallu le redessiner d'un seul tracé pour qu'il tienne à quinze
                  points. À treize, ses roues tombent sous le pixel.
                */
                icon={AlertIcon}
                accent={theme.colors.primary}
                background={theme.colors.primaryTint}
                onPress={onRequestAgain}
              />
            ) : null}

            {onRate ? (
              <ActionChip
                label={t('history.rate')}
                hint={t('history.rate')}
                icon={StarIcon}
                accent={theme.colors.highlight}
                background={theme.colors.highlightTint}
                /*
                  Le jaune vif tombe sous le seuil de lisibilité dès qu'il
                  devient un trait : on garde l'ambre foncé pour le picto, comme
                  partout ailleurs dans le produit. Même raison que
                  `userPositionDeep`.
                */
                glyph={theme.colors.userPositionDeep}
                onPress={onRate}
              />
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * Puce d'action au pied d'une ligne d'historique.
 *
 * Le filet coloré à gauche et l'aplat pâle derrière sont la construction déjà
 * employée par les encarts du produit : la couleur **borde**, elle ne remplit
 * pas. C'est ce qui permet d'en poser deux côte à côte sans que la liste
 * devienne une guirlande.
 *
 * Le libellé reste à l'encre par défaut, jamais à la couleur d'accent : en
 * Bebas treize points, le rouge sur teinte primaire tombe à 3,7:1 et le jaune
 * bien plus bas encore. C'est le filet qui porte le sens, le texte porte la
 * lisibilité.
 */
function ActionChip({
  label,
  hint,
  icon: Icon,
  accent,
  background,
  glyph,
  onPress,
}: {
  label: string;
  /** Ce que le lecteur d'écran annonce, quand le libellé court ne suffit pas. */
  hint: string;
  icon: (props: IconProps) => ReactNode;
  /** Couleur du filet de gauche. */
  accent: string;
  background: string;
  /** Couleur du picto, quand l'accent est trop clair pour un trait. */
  glyph?: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint}
      // La puce fait vingt-six points de haut : le débord porte la cible
      // tactile à quarante-six, au-dessus du minimum de quarante-quatre imposé
      // par le cahier des charges.
      hitSlop={10}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        paddingVertical: 5,
        paddingHorizontal: theme.space.sm,
        backgroundColor: background,
        borderLeftWidth: 2,
        borderLeftColor: accent,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {Icon({ color: glyph ?? accent, size: 13 })}
      <Text variant="btnSm">{label}</Text>
    </Pressable>
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
function StatusBadge({
  status,
  mode,
  color,
  asGarage,
}: {
  status: RequestStatus;
  mode: ServiceMode;
  color: string;
  asGarage: boolean;
}) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  /**
   * `REQUEST_STATUS_LABELS` est écrit **du point de vue du client** — c'est dit
   * dans le contrat. « En attente du garage » ou « Garagiste en route » sur la
   * ligne de quelqu'un qui *est* ce garagiste inverse les rôles à la lecture.
   *
   * Côté garage on reprend donc les libellés du poste de travail, qui nomment
   * l'action attendue de son côté. Deux vocabulaires pour un même état, parce
   * qu'il y a bien deux points de vue — et c'est justement ce que l'écran
   * ignorait.
   */
  const label =
    asGarage && GARAGE_STATUS_LABELS[status]
      ? t(GARAGE_STATUS_LABELS[status]!)
      : /*
          `requestStatusLabel` et non la table brute : « Garagiste en route »
          sur une demande où c'est le **client** qui conduisait lui fait
          relire son propre trajet comme celui de quelqu'un d'autre. La
          fonction ne remplace que les deux libellés concernés — cf. son
          commentaire dans le contrat.
        */
        requestStatusLabel(status, mode)[locale];

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: color,
        paddingHorizontal: theme.space.sm,
        paddingVertical: 2,
      }}
    >
      <Text variant="lblb" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

/** États non terminaux, nommés du côté du garagiste. Les autres se disent pareil. */
const GARAGE_STATUS_LABELS: Partial<Record<RequestStatus, TranslationKey>> = {
  selected: 'jobs.stateToAnswer',
  accepted: 'jobs.stateToLeave',
  en_route: 'jobs.stateDriving',
  awaiting_confirmation: 'jobs.stateToConfirm',
};
