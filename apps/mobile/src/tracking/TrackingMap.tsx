import { Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { LatLng } from '@geocras/shared';
import { MapCanvas, type MapCanvasRef } from '../map/MapCanvas';
import { RouteLine } from '../map/RouteLine';
import { UserPuck } from '../map/UserPuck';
import { useTheme } from '../theme/ThemeProvider';
import { TowTruckIcon } from '../ui/icons';

export type TrackingMapProps = {
  /** Lieu de la panne — le point vers lequel tout converge. */
  origin: LatLng;
  /** Précision GPS du client, pour son halo. `null` si inconnue. */
  accuracyM: number | null;
  /** Dernière position connue du garagiste. `null` avant le premier ping. */
  mechanic: LatLng | null;
  /** Tracé routier, en `[lng, lat]`. Vide quand le routage n'a pas répondu. */
  route: readonly [number, number][];
  /** Hauteur du panneau du bas, pour que le cadrage ne centre pas dessous. */
  paddingBottom: number;
  /** L'utilisateur a déplacé la carte : on cesse de la recadrer sous ses doigts. */
  frozen: boolean;
  onUserGesture: () => void;
};

/**
 * La carte du suivi, côté client.
 *
 * Elle répond à une seule question, celle qu'on se pose toutes les trente
 * secondes quand on attend au bord d'une route : **où en est-il ?** D'où trois
 * objets et pas un de plus — le lieu de la panne, le dépanneur, et le chemin
 * entre les deux.
 *
 * Le dépanneur porte l'icône de la dépanneuse, pas une pastille anonyme : sur
 * un fond de carte chargé, la forme se reconnaît plus vite que la couleur, et
 * c'est le seul objet mobile de l'écran.
 *
 * Le cadrage se fige dès que le doigt touche la carte. Recadrer
 * automatiquement pendant que quelqu'un explore les rues autour de lui est la
 * façon la plus sûre de rendre une carte inutilisable.
 */
export function TrackingMap({
  origin,
  accuracyM,
  mechanic,
  route,
  paddingBottom,
  frozen,
  onUserGesture,
}: TrackingMapProps) {
  const theme = useTheme();
  const mapRef = useRef<MapCanvasRef>(null);

  /**
   * Cadrage sur les deux extrémités quand le dépanneur apparaît, puis suivi.
   *
   * On recadre à chaque position retenue tant que l'utilisateur n'a pas touché
   * la carte : c'est ce qui garde les deux points visibles à mesure que la
   * distance fond. Sans ça, la dépanneuse sort du cadre au bout de deux rues.
   */
  useEffect(() => {
    if (frozen) return;

    if (mechanic) {
      mapRef.current?.fitTo([mechanic.lng, mechanic.lat], [origin.lng, origin.lat]);
    } else {
      mapRef.current?.recenter([origin.lng, origin.lat], 15);
    }
  }, [frozen, mechanic?.lat, mechanic?.lng, origin.lat, origin.lng]);

  return (
    <MapCanvas ref={mapRef} paddingBottom={paddingBottom} onUserGesture={onUserGesture}>
      <UserPuck position={origin} accuracyM={accuracyM} />

      {route.length > 1 ? <RouteLine coordinates={route} /> : null}

      {mechanic ? (
        <Marker id="mechanic" lngLat={[mechanic.lng, mechanic.lat]} anchor="center">
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
            <TowTruckIcon color={theme.colors.onFill} size={20} />
          </View>
        </Marker>
      ) : null}
    </MapCanvas>
  );
}
