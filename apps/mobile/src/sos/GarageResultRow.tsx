import { Pressable, View } from 'react-native';
import type { GarageSummary } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChamferView } from '../ui/ChamferView';
import { GarageThumb } from '../ui/GarageThumb';
import { CheckIcon, ChevronRightIcon } from '../ui/icons';
import { Stars } from '../ui/Stars';
import { Text } from '../ui/Text';

export type GarageResultRowProps = {
  garage: GarageSummary;
  /** Même garage que l'écusson mis en avant sur la carte. */
  selected: boolean;
  /** Son itinéraire est celui actuellement tracé sur la carte. */
  routed: boolean;
  /**
   * Garage demandé depuis sa fiche, épinglé en tête.
   *
   * Marqué par sa bordure jaune, la même couleur que le message qui le
   * désigne juste au-dessus — sans ce lien de couleur, la pointe du message
   * est le seul indice, et il disparaît dès qu’on fait défiler la liste.
   */
  pinned?: boolean;
  onPress: () => void;
  onDetails: () => void;
  onRoute: () => void;
  onSos: () => void;
};

/**
 * Ligne de la liste de résultats.
 *
 * Reprend la composition de la fiche de la maquette 03 — vignette au rang
 * chamfré, nom, badge certifié, mesures en mono, étoiles — mais posée à plat
 * dans une liste plutôt qu'en feuille contextuelle : ici on compare des
 * garages, on n'en consulte pas un.
 *
 * **Pas de chamfer sur la carte elle-même** : c'est une carte de contenu. Seuls
 * le badge de rang et le bouton d'envoi y ont droit.
 *
 * Les trois actions sont **toujours visibles**, jamais repliées derrière une
 * sélection : le produit s'utilise en panne au bord d'une route, et un appui
 * de plus pour découvrir une action est un appui de trop. Leur hiérarchie est
 * portée par la forme et non par la place — deux libellés nus pour ce qui ne
 * coûte rien, consulter ou regarder le trajet, et un seul aplat rouge chamfré
 * pour la seule action qui engage la demande.
 */
export function GarageResultRow({
  garage,
  selected,
  routed,
  pinned = false,
  onPress,
  onDetails,
  onRoute,
  onSos,
}: GarageResultRowProps) {
  const theme = useTheme();
  const { t, formatNumber, formatDistance, formatDuration } = useI18n();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        // La sélection se lit à la bordure encre, comme sur la vignette de la
        // carte : un fond teinté écraserait une ligne déjà dense.
        borderWidth: selected || pinned ? 1.5 : 1,
        // La sélection l’emporte sur l’épinglage : c’est l’état que le doigt
        // vient de produire, il doit répondre.
        borderColor: selected
          ? theme.colors.ink
          : pinned
            ? theme.colors.highlight
            : theme.colors.rule,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={[
          `${garage.name}, numéro ${garage.rank}`,
          garage.certified ? t('garage.certified') : null,
          `note ${formatNumber(garage.rating)} sur 5`,
          formatDistance(garage.distanceM),
          formatDuration(garage.etaMin),
          garage.openNow ? t('garage.open') : t('garage.closed'),
        ]
          .filter(Boolean)
          .join(', ')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          gap: theme.space.md,
          padding: theme.space.md,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <View>
          <GarageThumb uri={garage.photos[0]} name={garage.name} size={62} />
          {/*
            Le rang vient du serveur — jamais dérivé de l'index de la ligne.
            C'est le même numéro que celui planté sur la carte, et c'est lui
            qui permet de passer de l'écusson à la ligne sans relire les noms.
          */}
          <ChamferView
            fill={theme.colors.ink}
            style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20 }}
            contentStyle={{
              width: 20,
              height: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="monoStrong" tone="inverse" style={{ fontSize: 10, lineHeight: 13 }}>
              {garage.rank}
            </Text>
          </ChamferView>
        </View>

        <View style={{ flex: 1, gap: 5 }}>
          <Text variant="h2" numberOfLines={1} ellipsizeMode="tail">
            {garage.name}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            {garage.certified ? (
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {/* Bebas ne contient pas ✓ : icône vectorielle plutôt que tofu. */}
                <CheckIcon color={theme.colors.surface} size={11} />
                <Text variant="lblb" tone="inverse">
                  {t('garage.certified')}
                </Text>
              </View>
            ) : null}

            <Text variant="mono" numberOfLines={1} style={{ flexShrink: 1 }}>
              {formatDistance(garage.distanceM)} · {formatDuration(garage.etaMin)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <Stars value={garage.rating} size={12} showValue reviewCount={garage.reviewCount} />
            {/* On ne signale que la fermeture : « Ouvert » sur chaque ligne
                serait du bruit là où c'est le cas général. */}
            {!garage.openNow ? (
              <Text variant="caption" tone="warning">
                {t('garage.closed')}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={{ height: 1, backgroundColor: theme.colors.rule }} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.space.sm,
          paddingBottom: theme.space.sm,
        }}
      >
        {/*
          Le groupe de gauche est le seul à pouvoir se comprimer : sur un écran
          étroit, un libellé qui se tronque vaut mieux qu'un bouton d'envoi qui
          déborde de la ligne.
        */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 }}>
          <QuietAction label={t('garage.details')} onPress={onDetails} />
          <View style={{ width: 1, height: 16, backgroundColor: theme.colors.rule }} />
          <QuietAction label={t('garage.directions')} onPress={onRoute} active={routed} chevron />
        </View>

        <View style={{ flex: 1, minWidth: theme.space.sm }} />

        <Pressable
          onPress={onSos}
          accessibilityRole="button"
          accessibilityLabel={`${t('garage.sendSos')} — ${garage.name}`}
          accessibilityHint={t('garage.sendSosHint')}
          style={({ pressed }) => ({ flexShrink: 0, opacity: pressed ? 0.85 : 1 })}
        >
          <ChamferView
            fill={theme.colors.primary}
            style={{ minHeight: MIN_TOUCH_TARGET }}
            contentStyle={{
              minHeight: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.space.md,
            }}
          >
            <Text variant="h2" tone="inverse" numberOfLines={1}>
              {t('garage.sendSos')}
            </Text>
          </ChamferView>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Action secondaire : un libellé, une cible de 44 px, rien d'autre.
 *
 * Encre et non rouge — le rouge appartient à l'action qui engage la demande.
 * Active, elle passe quand même au rouge : c'est alors un **état** et non une
 * invitation, et il faut voir d'un coup d'œil de quel garage l'itinéraire est
 * tracé sur la carte.
 */
function QuietAction({
  label,
  onPress,
  active = false,
  chevron = false,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  chevron?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        height: MIN_TOUCH_TARGET,
        paddingHorizontal: theme.space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {chevron ? (
        <ChevronRightIcon color={active ? theme.colors.primary : theme.colors.ink} size={14} />
      ) : null}
      <Text
        variant="smallStrong"
        tone={active ? 'primary' : 'ink'}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
