import { Marker } from '@maplibre/maplibre-react-native';
import { Pressable, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import type { GarageSummary } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { markerShadow } from '../theme/tokens';
import { GarageMarker } from '../ui/GarageMarker';
import { Text } from '../ui/Text';

export type GarageMarkersProps = {
  garages: readonly GarageSummary[];
  onSelect?: (garage: GarageSummary) => void;
  /** Identifiant du garage mis en avant — lié au carrousel de la feuille. */
  selectedId?: string | null;
};

/**
 * Débordement de l'ombre sous la pointe du pentagone.
 *
 * L'ellipse est centrée sur la pointe : la moitié de sa hauteur passe donc
 * sous le point d'ancrage. On réserve cette place en rembourrage, puis on la
 * rend au marqueur via `offset` — sans quoi tous les garages remonteraient de
 * 3,5 px vers le nord.
 */
const SHADOW_OVERHANG = markerShadow.height / 2;

/** Grossissement de l'écusson sélectionné. */
const SELECTED_SCALE = 1.18;

/**
 * Écussons numérotés sur la carte.
 *
 * Choix de rendu : un `Marker` (vue native ancrée) par garage, plutôt qu'un
 * `SymbolLayer` alimenté par une source GeoJSON. Le `SymbolLayer` serait plus
 * rapide, mais il exige des icônes matricielles pré-rendues — donc un écusson
 * qui ne serait plus le composant `<GarageMarker>` testé, et une divergence
 * garantie entre la carte et le reste de l'interface.
 *
 * Le compromis est tenable parce que la recherche est plafonnée à 20 résultats.
 * **Budget à mesurer en conditions réelles : 60 fps au pan/zoom avec 20
 * marqueurs sur un Android milieu de gamme.** Si le budget saute, la sortie est
 * connue : passer en `SymbolLayer` avec des icônes générées à partir des mêmes
 * jetons de thème.
 */
export function GarageMarkers({ garages, onSelect, selectedId = null }: GarageMarkersProps) {
  const theme = useTheme();
  const { formatDistance } = useI18n();

  return (
    <>
      {garages.map((garage) => {
        const isSelected = garage.id === selectedId;
        // La bulle va au garage sélectionné ; à défaut au n° 1, comme la
        // maquette. Deux bulles simultanées se chevaucheraient en zone dense.
        const showCallout = selectedId === null ? garage.rank === 1 : isSelected;

        return (
          <Marker
            key={garage.id}
            id={garage.id}
            lngLat={[garage.lng, garage.lat]}
            anchor="bottom"
            offset={[0, SHADOW_OVERHANG]}
          >
            <Pressable
              onPress={() => onSelect?.(garage)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${garage.name}, numéro ${garage.rank}${
                garage.certified ? ', certifié' : ''
              }, ${formatDistance(garage.distanceM)}`}
              // La zone tactile déborde volontairement l'écusson : 38 px de
              // large est en dessous de la cible de 44 px, et on tape debout,
              // parfois en marchant.
              hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
              style={{ alignItems: 'center', paddingBottom: SHADOW_OVERHANG }}
            >
              {/*
                Ombre au sol. Déclarée en premier pour être peinte SOUS
                l'écusson : sur Android, sans `elevation`, l'ordre du rendu est
                l'ordre de l'arbre.
              */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                }}
              >
                <Svg width={markerShadow.width} height={markerShadow.height}>
                  <Ellipse
                    cx={markerShadow.width / 2}
                    cy={markerShadow.height / 2}
                    rx={markerShadow.width / 2}
                    ry={markerShadow.height / 2}
                    fill={theme.colors.shadow}
                    opacity={0.18}
                  />
                </Svg>
              </View>

              {showCallout ? (
                <View
                  style={{
                    backgroundColor: theme.colors.ink,
                    paddingHorizontal: theme.space.md,
                    paddingVertical: theme.space.sm,
                    marginBottom: theme.space.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space.sm,
                  }}
                >
                  <Text variant="bodyStrong" tone="inverse" numberOfLines={1}>
                    {garage.name}
                  </Text>
                  <Text variant="numSm" tone="primary">
                    {formatDistance(garage.distanceM)}
                  </Text>
                </View>
              ) : null}

              {/*
                L'écusson sélectionné grossit au lieu de changer de couleur : le
                rouge et le blanc portent déjà la certification, les recycler
                pour la sélection rendrait les deux illisibles.

                `transformOrigin` en bas : un grossissement centré ferait
                descendre la pointe, donc décrocherait le marqueur de la
                coordonnée du garage au moment même où on le regarde.
              */}
              <View
                style={
                  isSelected
                    ? { transform: [{ scale: SELECTED_SCALE }], transformOrigin: 'bottom center' }
                    : undefined
                }
              >
                <GarageMarker rank={garage.rank} certified={garage.certified} />
              </View>
            </Pressable>
          </Marker>
        );
      })}
    </>
  );
}
