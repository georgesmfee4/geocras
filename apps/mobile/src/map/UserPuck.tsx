import { GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../ui/useReducedMotion';

export type UserPuckProps = {
  position: { lat: number; lng: number };
  /** Précision réelle en mètres. `null` = cercle de précision masqué. */
  accuracyM: number | null;
};

/**
 * Côté de la vue qui porte le point et son halo.
 *
 * Le halo est en pixels d'écran, contrairement au cercle de précision qui est
 * en mètres réels : c'est un signal de vitalité, pas une mesure. Les confondre
 * ferait croire à une précision qui varie au rythme de l'animation.
 */
const PUCK_STAGE = 56;

/**
 * Position de l'utilisateur : point bleu bordé de blanc et **cercle de
 * précision** semi-transparent.
 *
 * Le cercle est dessiné comme un polygone géographique, pas comme un cercle
 * d'écran : il doit représenter des mètres réels et donc grandir au dézoom.
 * Un cercle à rayon fixe en pixels donnerait une fausse impression de précision
 * constante — exactement ce que cet élément est censé démentir.
 */
export function UserPuck({ position, accuracyM }: UserPuckProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const halo = useRef(new Animated.Value(0)).current;

  const accuracyCircle = useMemo(() => {
    if (accuracyM === null || accuracyM <= 0) return null;
    return circlePolygon(position, accuracyM);
    // `position` est reconstruit à chaque rendu par l'appelant : on mémoïse sur
    // les coordonnées elles-mêmes, sinon le polygone serait recalculé — et la
    // source GeoJSON redessinée — à chaque image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.lat, position.lng, accuracyM]);

  /**
   * Halo pulsant.
   *
   * Il dit que la position est **vivante**, pas figée sur un dernier point
   * connu. C'est la même sémantique que la pastille clignotante ailleurs dans
   * l'app, et c'est pour ça qu'il s'arrête si le système réduit les animations.
   */
  useEffect(() => {
    if (reducedMotion) {
      halo.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(halo, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo, reducedMotion]);

  return (
    <>
      {accuracyCircle ? (
        <GeoJSONSource id="user-accuracy" data={accuracyCircle}>
          <Layer
            id="user-accuracy-fill"
            type="fill"
            paint={{
              'fill-color': theme.colors.userPosition,
              // Un peu plus dense que le bleu qu'il remplace : à opacité égale,
              // le jaune se confondait avec le crème du fond de carte.
              'fill-opacity': 0.18,
            }}
          />
          <Layer
            id="user-accuracy-outline"
            type="line"
            paint={{
              'line-color': theme.colors.userPositionDeep,
              'line-opacity': 0.45,
              'line-width': 1,
            }}
          />
        </GeoJSONSource>
      ) : null}

      <Marker id="user-position" lngLat={[position.lng, position.lat]} anchor="center">
        <View style={{ width: PUCK_STAGE, height: PUCK_STAGE, alignItems: 'center', justifyContent: 'center' }}>
          {!reducedMotion ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: PUCK_STAGE,
                height: PUCK_STAGE,
                borderRadius: PUCK_STAGE / 2,
                backgroundColor: theme.colors.userPosition,
                opacity: halo.interpolate({
                  inputRange: [0, 0.12, 1],
                  outputRange: [0, 0.3, 0],
                }),
                transform: [
                  { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                ],
              }}
            />
          ) : null}

          {/*
            Double anneau, et non un simple liseré blanc.

            Le jaune `#F5B301` n'atteint que 1,8:1 sur le fond de carte crème :
            un point jaune bordé de blanc s'y dissoudrait, alors que c'est le
            repère le plus important de l'écran. L'anneau encore extérieur, en
            encre, est ce qui le détache — le blanc seul ne suffit pas sur un
            fond déjà clair.
          */}
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.colors.shadow,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: theme.colors.userPosition,
                borderWidth: 3,
                borderColor: '#FFFFFF',
              }}
            />
          </View>
        </View>
      </Marker>
    </>
  );
}

/**
 * Approxime un cercle géodésique par un polygone de 48 sommets.
 *
 * La correction en `cos(latitude)` sur la longitude est indispensable : sans
 * elle, le cercle est un ovale. À la latitude de Yaoundé (3,8°) l'écart reste
 * faible, mais il deviendrait visible partout ailleurs.
 */
function circlePolygon(
  center: { lat: number; lng: number },
  radiusMeters: number,
  steps = 48,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((center.lat * Math.PI) / 180);

  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      center.lng + (radiusMeters * Math.cos(angle)) / metersPerDegreeLng,
      center.lat + (radiusMeters * Math.sin(angle)) / metersPerDegreeLat,
    ]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}
