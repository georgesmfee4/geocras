import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { GarageSummary } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { ChamferView } from './ChamferView';
import { GarageThumb } from './GarageThumb';
import { Text } from './Text';

export type GarageCardProps = {
  garage: GarageSummary;
  onPress?: () => void;
  width?: number;
  /**
   * Vignette du garage sélectionné sur la carte. Les deux vues sont liées :
   * toucher un écusson met sa vignette en avant, et l'inverse.
   */
  selected?: boolean;
};

/**
 * Vignette de garage du carrousel de la feuille du bas.
 *
 * **Pas de chamfer sur la carte elle-même** : c'est une carte de contenu, et le
 * cahier des charges réserve l'angle coupé aux boutons d'action, avatars,
 * badges et logo. La pastille de rang, elle, est un badge — donc chamfrée.
 *
 * Toute la ligne de données est en mono avec `tabular-nums` : sans ça, passer
 * de « 500 m » à « 1,2 km » au défilement décale le badge certifié.
 */
export function GarageCard({ garage, onPress, width = 250, selected = false }: GarageCardProps) {
  const theme = useTheme();
  const { t, formatNumber, formatDistance, formatDuration } = useI18n();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={[
        `${garage.name}, numéro ${garage.rank}`,
        garage.certified ? 'certifié' : null,
        `note ${formatNumber(garage.rating)} sur 5`,
        formatDistance(garage.distanceM),
        `${garage.etaMin} minutes`,
        garage.openNow ? t('garage.open') : t('garage.closed'),
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => ({
        width,
        backgroundColor: theme.colors.surface,
        // La sélection se lit à la bordure encre, pas à un fond teinté : sur une
        // vignette déjà dense, un aplat de couleur écraserait le texte.
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? theme.colors.ink : theme.colors.rule,
        padding: theme.space.md,
        flexDirection: 'row',
        gap: theme.space.md,
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View>
        <GarageThumb uri={garage.photos[0]} name={garage.name} size={52} />

        {/*
          Le rang, repris de l'écusson planté sur la carte. Il n'est pas dans la
          maquette, mais sans lui il faut relire les noms pour faire le lien
          entre le marqueur « 3 » et sa vignette — exactement l'effort qu'on ne
          fournit pas en panne au bord d'une route.
          Il vient du serveur : jamais dérivé d'un index de tableau.
        */}
        <ChamferView
          fill={theme.colors.ink}
          style={{ position: 'absolute', top: 0, left: 0, width: 18, height: 18 }}
          contentStyle={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text variant="numSm" tone="inverse" style={{ fontSize: 10, lineHeight: 13 }}>
            {garage.rank}
          </Text>
        </ChamferView>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
          <Text
            variant="h2"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ flexShrink: 1 }}
          >
            {garage.name}
          </Text>
          {garage.certified ? <CertifiedTick color={theme.colors.primary} /> : null}
        </View>

        <Text variant="numSm" tone="secondary" numberOfLines={1}>
          ★{formatNumber(garage.rating)} · {formatDistance(garage.distanceM)} ·{' '}
          {formatDuration(garage.etaMin)}
        </Text>

        {/*
          On ne signale que la fermeture. Marquer « Ouvert » sur chaque vignette
          ajouterait une ligne de bruit là où c'est le cas général — la ligne de
          contexte, en haut de l'écran, annonce déjà le nombre de garages
          ouverts.
        */}
        {!garage.openNow ? (
          <Text variant="caption" tone="warning" numberOfLines={1}>
            {t('garage.closed')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function CertifiedTick({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 15,
        height: 15,
        borderRadius: 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={10} height={10} viewBox="0 0 24 24">
        <Path
          d="M5 12.5l4.5 4.5L19 7"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
