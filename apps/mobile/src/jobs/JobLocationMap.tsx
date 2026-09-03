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

/**
 * Hauteur de l'aperçu, en points.
 *
 * Deux valeurs, et l'écart n'est pas décoratif. Le point exact se lit dans une
 * bande : on le cadre serré, la rue et son carrefour suffisent. Le disque
 * masqué, lui, fait deux kilomètres de large — le loger dans la même bande
 * n'aurait laissé que le disque, sans un mètre de ville autour, c'est-à-dire
 * l'inverse de ce qu'on cherche à montrer.
 *
 * Les deux états ne coexistent jamais : la fiche ne « saute » donc pas, elle
 * n'est simplement pas de la même hauteur avant et après l'acceptation.
 */
const PREVIEW_HEIGHT = { precise: 176, area: 210 } as const;

/** Rembourrage vertical de la caméra, retiré de la hauteur utile au cadrage. */
const CAMERA_PADDING = 8;

/**
 * Résolution de la projection Web Mercator à l'équateur, en mètres par pixel
 * au zoom 0. Constante de la projection, pas un réglage.
 */
const EQUATOR_M_PER_PX = 156_543.033_92;

/** Marge autour du disque, pour qu'il ne touche pas les bords du cadre. */
const FRAMING_MARGIN = 1.15;

/**
 * Le zoom qui fait tenir un disque de ce rayon dans la hauteur disponible.
 *
 * Calculé plutôt que choisi à la main : le rayon vit dans le contrat partagé et
 * peut changer, la hauteur de l'aperçu aussi. Une valeur en dur les aurait
 * laissés diverger en silence — un disque débordant du cadre, ou perdu au
 * milieu d'un aplat vide, sans que rien ne signale l'incohérence.
 */
function zoomForRadius(radiusMeters: number, heightPx: number, lat: number): number {
  const needed = (2 * radiusMeters * FRAMING_MARGIN) / heightPx;
  return Math.log2((EQUATOR_M_PER_PX * Math.cos((lat * Math.PI) / 180)) / needed);
}

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
 *  - **avant acceptation**, le serveur n'envoie qu'un point arrondi. On le
 *    marque, entouré de son disque d'un kilomètre — mais **sur un fond
 *    aveugle**, sans une voie ni un nom ;
 *  - **après acceptation**, la ville apparaît et l'épingle marque le point
 *    exact.
 *
 * ---
 *
 * **Ce sont les rues qu'on retire, pas le repère.**
 *
 * Le risque ne tenait ni au point seul, ni au plan seul : il tenait à leur
 * rencontre. Un rond posé sur un plan de ville se rapporte au carrefour le plus
 * proche, et quelqu'un qui connaît son quartier sait alors où aller —
 * l'arrondi des coordonnées n'y change rien, puisqu'il reste dans les quatre
 * cents mètres. Le même rond sur un fond muet ne se rapporte à rien.
 *
 * Retirer le plan plutôt que le repère laisse en outre au garagiste ce dont il
 * a besoin pour décider : l'étendue de la zone, à l'échelle, et le fait qu'une
 * demande vient bien de quelque part. Un cadre vide se serait lu comme une
 * carte en panne.
 *
 * La carte n'est pas manipulable : c'est un aperçu posé dans une fiche qui
 * défile. Sans ça, un doigt qui veut faire défiler la page fait glisser la
 * carte, et l'aperçu finit à trois cents kilomètres de son sujet.
 */
export function JobLocationMap({ origin, precise }: JobLocationMapProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const mapRef = useRef<MapCanvasRef>(null);

  const height = precise ? PREVIEW_HEIGHT.precise : PREVIEW_HEIGHT.area;

  /**
   * Cadrage : serré sur l'épingle, calculé sur le disque.
   *
   * Le zoom 16 de l'état précis est un choix de lecture — on veut la rue et son
   * carrefour. Celui de l'état masqué n'en est pas un : il **découle** du rayon
   * et de la hauteur disponible, et n'a donc pas à être décidé.
   */
  useEffect(() => {
    mapRef.current?.recenter(
      [origin.lng, origin.lat],
      precise
        ? 16
        : zoomForRadius(
            PRIVACY_UNTIL_ACCEPTED.previewRadiusMeters,
            height - 2 * CAMERA_PADDING,
            origin.lat,
          ),
    );
  }, [origin.lat, origin.lng, precise, height]);

  const area = useMemo(
    () =>
      precise
        ? null
        : circlePolygon(origin, PRIVACY_UNTIL_ACCEPTED.previewRadiusMeters),
    // Mémoïsé sur les coordonnées et non sur l'objet : l'appelant en construit
    // un neuf à chaque rendu, ce qui redessinerait la source à chaque image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin.lat, origin.lng, precise],
  );

  return (
    <View style={{ backgroundColor: theme.colors.surface }}>
      <View style={{ height }}>
        <MapCanvas
          ref={mapRef}
          interactive={false}
          // Les rues n'arrivent qu'avec l'acceptation — et c'est là qu'elles
          // servent, puisque c'est là que commence l'itinéraire.
          blind={!precise}
          paddingTop={CAMERA_PADDING}
          paddingBottom={CAMERA_PADDING}
        >
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

              Plus petite sur la zone approchée : elle y désigne le centre d'un
              disque, pas une adresse. Sur le fond aveugle, elle ne peut de toute
              façon se rapporter à rien.
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
