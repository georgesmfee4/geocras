import { GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type RouteLineProps = {
  /** Tracé, en [lng, lat]. Vient d'OSRM ; en attendant, segment droit. */
  coordinates: readonly [number, number][];
  /** Position courante du véhicule du garagiste. */
  vehicle?: { lat: number; lng: number } | null;
};

/**
 * Itinéraire en **trois couches superposées**, conformément à la maquette 04 :
 *
 *  1. ombre `#1C1A17` à 14 %, 9 px ;
 *  2. trait rouge plein, 6 px ;
 *  3. pointillés blancs animés qui défilent vers la destination, 2 px.
 *
 * L'ordre de déclaration est l'ordre de rendu : l'ombre doit être posée en
 * premier, sinon elle recouvre le trait.
 *
 * Le tracé part exactement du point de l'utilisateur et arrive exactement sur
 * la pointe du marqueur — c'est la géométrie fournie qui le garantit, d'où
 * l'exigence que les extrémités de `coordinates` soient les vraies positions,
 * pas des approximations arrondies.
 */
export function RouteLine({ coordinates, vehicle }: RouteLineProps) {
  const theme = useTheme();
  const dashOffset = useDashAnimation();

  const shape = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coordinates as [number, number][] },
    }),
    [coordinates],
  );

  if (coordinates.length < 2) return null;

  return (
    <>
      <GeoJSONSource id="route" data={shape}>
        <Layer
          id="route-shadow"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': theme.colors.shadow,
            'line-opacity': 0.14,
            'line-width': 9,
          }}
        />
        <Layer
          id="route-fill"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': theme.colors.primary,
            'line-width': 6,
          }}
        />
        <Layer
          id="route-dashes"
          type="line"
          layout={{ 'line-cap': 'butt' }}
          paint={{
            'line-color': '#FFFFFF',
            'line-width': 2,
            'line-dasharray': [dashOffset, 2, 15 - dashOffset, 0.0001],
          }}
        />
      </GeoJSONSource>

      {vehicle ? (
        <Marker id="route-vehicle" lngLat={[vehicle.lng, vehicle.lat]} anchor="center">
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: theme.colors.surface,
              borderWidth: 3,
              borderColor: theme.colors.primary,
            }}
          />
        </Marker>
      ) : null}
    </>
  );
}

/**
 * Défilement des pointillés.
 *
 * MapLibre n'anime pas `line-dasharray` : on fait défiler le motif par pas
 * discrets. 8 images par seconde suffisent à donner le mouvement — plus serait
 * du travail de rendu pour un gain invisible, et cet écran tourne pendant
 * qu'une dépanneuse roule, batterie comprise.
 */
function useDashAnimation(): number {
  const [step, setStep] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      frame.current = (frame.current + 1) % 15;
      setStep(frame.current);
    }, 125);
    return () => clearInterval(timer);
  }, []);

  return step;
}

/**
 * Tracé provisoire en attendant OSRM.
 *
 * Une ligne droite entre deux points. À remplacer par la géométrie renvoyée par
 * le serveur de routage — et **pas** à laisser en production : sur la carte,
 * une droite qui traverse les bâtiments se remarque immédiatement.
 */
export function straightLine(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): [number, number][] {
  return [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ];
}
