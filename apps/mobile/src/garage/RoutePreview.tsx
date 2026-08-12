import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { LatLng } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { GarageMarkers } from '../map/GarageMarkers';
import { MapCanvas, type MapCanvasRef } from '../map/MapCanvas';
import { RouteLine, straightLine } from '../map/RouteLine';
import { UserPuck } from '../map/UserPuck';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';

/** Hauteur de l'aperçu : de quoi lire deux rues, pas de quoi naviguer. */
const PREVIEW_HEIGHT = 190;

export type RoutePreviewProps = {
  garage: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    certified: boolean;
    distanceM: number;
    etaMin: number;
  };
  /** Position de l'utilisateur. `null` tant que le GPS n'a rien rendu. */
  origin: LatLng | null;
};

/**
 * Aperçu d'itinéraire de la fiche garage.
 *
 * Une carte **non manipulable** : le doigt qui passe dessus fait défiler la
 * fiche, pas glisser la carte. C'est la différence entre un aperçu et un outil
 * de navigation, et elle est nécessaire ici — un aperçu qu'on déplace par
 * accident au milieu d'une page qui défile devient un rectangle perdu quelque
 * part, sans moyen de revenir.
 *
 * Conformément au cahier des charges, le trajet est tracé **dans l'app** :
 * aucun lien sortant vers une application de navigation tierce.
 *
 * Sans position, on ne montre pas de carte centrée sur rien : on dit ce qui
 * manque et comment le débloquer.
 */
export function RoutePreview({ garage, origin }: RoutePreviewProps) {
  const theme = useTheme();
  const { t, formatDistance, formatDuration } = useI18n();
  const mapRef = useRef<MapCanvasRef>(null);

  /**
   * Cadrage sur les deux points, une fois la carte prête.
   *
   * `fitTo` avant le chargement du style serait ignoré par MapLibre — la file
   * d'attente de `MapCanvas` s'en charge, mais on redemande le cadrage quand
   * l'origine arrive après coup.
   */
  useEffect(() => {
    if (!origin) return;
    mapRef.current?.fitTo([origin.lng, origin.lat], [garage.lng, garage.lat]);
  }, [origin, garage.lng, garage.lat]);

  const marker = {
    ...garage,
    // L'écusson d'un aperçu ne classe rien : il n'y a qu'un garage à montrer.
    // On garde le rang à 1 pour rester dans le contrat du marqueur, jamais
    // dérivé d'un index de liste ailleurs dans l'app.
    rank: 1,
    rating: 0,
    reviewCount: 0,
    addressLabel: null,
    quarter: null,
    phone: null,
    services: [],
    photos: [],
    openNow: true,
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
      }}
    >
      <View style={{ height: PREVIEW_HEIGHT }}>
        {origin ? (
          <MapCanvas ref={mapRef} interactive={false} paddingTop={12} paddingBottom={12}>
            <UserPuck position={origin} accuracyM={null} />
            <RouteLine coordinates={straightLine(origin, { lat: garage.lat, lng: garage.lng })} />
            <GarageMarkers garages={[marker]} selectedId={garage.id} />
          </MapCanvas>
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.space.xl,
            }}
          >
            <Text variant="txt" tone="muted" style={{ textAlign: 'center' }}>
              {t('garage.routeNoPosition')}
            </Text>
          </View>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.rule,
          padding: theme.space.md,
        }}
      >
        <Text variant="mono">
          {origin ? formatDistance(garage.distanceM) : '—'} ·{' '}
          {origin ? formatDuration(garage.etaMin) : '—'}
        </Text>

        <View style={{ flex: 1 }} />

        {/* Le tracé est un segment droit tant qu'OSRM n'est pas branché. On le
            dit plutôt que de laisser croire à un calcul routier : la ligne
            traverse visiblement les bâtiments. */}
        <Text variant="caption" tone="muted" numberOfLines={2} style={{ flexShrink: 1 }}>
          {t('garage.routeLead')}
        </Text>
      </View>
    </View>
  );
}
