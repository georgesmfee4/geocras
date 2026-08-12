import { useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

/** Espacement des hachures, en points. */
const HATCH_SPACING = 8;

/**
 * Abscisses de départ des diagonales montantes couvrant un carré de côté
 * `size`. Il en faut deux fois la largeur pour que le coin bas-gauche et le
 * coin haut-droit soient tous deux atteints.
 */
function hatchOffsets(size: number): number[] {
  const offsets: number[] = [];
  for (let x = 0; x <= size * 2; x += HATCH_SPACING) offsets.push(x);
  return offsets;
}

export type GarageThumbProps = {
  /** Première photo du garage, ou `undefined` s'il n'en a pas. */
  uri?: string | undefined;
  /** Nom du garage — son initiale sert de repère quand il n'y a pas de photo. */
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Vignette d'un garage.
 *
 * **L'absence de photo est l'état nominal, pas un cas limite** : aucun des
 * garages du parc initial n'en a. Un carré gris uni serait lu comme une image
 * qui n'a pas fini de charger, et donnerait l'impression d'une app cassée sur
 * toute la liste. Les hachures diagonales disent l'inverse : « pas de photo »
 * est une information, pas une attente.
 *
 * Le motif reprend le filet du thème plutôt qu'un gris neutre — le parti pris
 * du blanc chaud vaut aussi pour les états vides.
 */
export function GarageThumb({ uri, name, size = 52, style }: GarageThumbProps) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  // Une URL peut pointer vers une image supprimée côté Cloudinary. Sans ce
  // repli, la carte afficherait un trou blanc à la place de la vignette.
  const showPhoto = Boolean(uri) && !failed;

  return (
    <View
      style={[
        { width: size, height: size, backgroundColor: theme.colors.background, overflow: 'hidden' },
        style,
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <>
          {/*
            Hachures tracées ligne à ligne plutôt qu'avec un `<Pattern>` : sur
            Android, plusieurs racines `<Svg>` partageant un même `id` de motif
            se marchent dessus, et cette vignette apparaît une fois par garage
            dans le carrousel. Le débordement est coupé par le `overflow` du
            conteneur.
          */}
          <Svg width={size} height={size}>
            {hatchOffsets(size).map((offset) => (
              <Line
                key={offset}
                x1={offset - size}
                y1={size}
                x2={offset}
                y2={0}
                stroke={theme.colors.rule}
                strokeWidth={3.5}
              />
            ))}
          </Svg>

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              variant="monoStrong"
              tone="muted"
              style={{ fontSize: Math.round(size * 0.34) }}
            >
              {name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
