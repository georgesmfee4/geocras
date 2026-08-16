import { GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { PRIVACY_UNTIL_ACCEPTED, type LatLng } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { circlePolygon } from '../map/circle';
import { MapCanvas, type MapCanvasRef } from '../map/MapCanvas';
import { useTheme } from '../theme/ThemeProvider';
import { ShieldLockIcon } from '../ui/icons';
import { Text } from '../ui/Text';

/** Hauteur de l'aperçu : de quoi reconnaître un carrefour, pas de quoi naviguer. */
const PREVIEW_HEIGHT = 176;

/**
 * Rayon de la zone d'incertitude, en mètres.
 *
 * Dérivé de la maille de confidentialité du contrat plutôt que fixé ici :
 * arrondir à 0,005° déplace le point d'au plus une demi-maille dans chaque
 * direction, soit la demi-diagonale en pire cas. Un cercle plus petit que
 * l'arrondi réel mentirait par optimisme.
 */
const UNCERTAINTY_M = Math.round(
  ((PRIVACY_UNTIL_ACCEPTED.originGridDegrees * 111_320) / 2) * Math.SQRT2,
);

export type JobLocationMapProps = {
  origin: LatLng;
  /** `false` : le point est arrondi, on dessine la zone au lieu d'une épingle. */
  precise: boolean;
};

/**
 * Où se trouve la panne.
 *
 * Deux rendus pour deux vérités, et c'est tout l'intérêt du composant :
 *
 *  - **avant acceptation**, le serveur n'envoie qu'un point arrondi. On dessine
 *    donc un **disque**, à l'échelle réelle de l'arrondi. Une épingle posée sur
 *    un point flouté prétendrait à une précision au mètre que personne n'a ;
 *  - **après acceptation**, la position exacte arrive et l'épingle la marque.
 *
 * La carte n'est pas manipulable : c'est un aperçu posé dans une fiche qui
 * défile. Sans ça, un doigt qui veut faire défiler la page fait glisser la
 * carte, et l'aperçu finit à trois cents kilomètres de son sujet.
 */
export function JobLocationMap({ origin, precise }: JobLocationMapProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const mapRef = useRef<MapCanvasRef>(null);

  /**
   * Zoom choisi selon ce qu'on montre : serré sur l'épingle, plus large sur la
   * zone pour que le disque tienne dans le cadre avec sa rue autour.
   */
  useEffect(() => {
    mapRef.current?.recenter([origin.lng, origin.lat], precise ? 16 : 14.4);
  }, [origin.lat, origin.lng, precise]);

  const area = useMemo(
    () => (precise ? null : circlePolygon(origin, UNCERTAINTY_M)),
    // Mémoïsé sur les coordonnées et non sur l'objet : l'appelant en construit
    // un neuf à chaque rendu, ce qui redessinerait la source à chaque image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin.lat, origin.lng, precise],
  );

  return (
    <View style={{ backgroundColor: theme.colors.surface }}>
      <View style={{ height: PREVIEW_HEIGHT }}>
        <MapCanvas ref={mapRef} interactive={false} paddingTop={8} paddingBottom={8}>
          {area ? (
            <GeoJSONSource id="job-area" data={area}>
              <Layer
                id="job-area-fill"
                type="fill"
                paint={{ 'fill-color': theme.colors.primary, 'fill-opacity': 0.12 }}
              />
              <Layer
                id="job-area-outline"
                type="line"
                paint={{
                  'line-color': theme.colors.primary,
                  'line-opacity': 0.5,
                  'line-width': 1.5,
                  'line-dasharray': [3, 2],
                }}
              />
            </GeoJSONSource>
          ) : null}

          <Marker id="job-origin" lngLat={[origin.lng, origin.lat]} anchor="center">
            {/*
              Pastille et non écusson : l'écusson pentagonal numéroté appartient
              aux garages et ne se prête pas à autre chose. Ici il n'y a qu'un
              point, et il désigne un véhicule en panne.
            */}
            <View
              style={{
                width: precise ? 20 : 12,
                height: precise ? 20 : 12,
                borderRadius: precise ? 10 : 6,
                backgroundColor: theme.colors.primary,
                borderWidth: precise ? 3 : 2,
                borderColor: theme.colors.surface,
              }}
            />
          </Marker>
        </MapCanvas>
      </View>

      {!precise ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            borderTopWidth: 1,
            borderTopColor: theme.colors.rule,
            padding: theme.space.md,
          }}
        >
          <ShieldLockIcon color={theme.colors.muted} size={15} />
          <Text variant="txt" tone="muted" style={{ flex: 1 }}>
            {t('jobs.areaOnly')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
