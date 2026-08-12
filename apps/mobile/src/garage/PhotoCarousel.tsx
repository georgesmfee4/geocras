import { useState } from 'react';
import {
  Image,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';

/** Hauteur du bandeau, reprise de la maquette 05. */
export const PHOTO_BANNER_HEIGHT = 216;

/** Espacement des hachures de l'état sans photo, en points. */
const HATCH_SPACING = 14;

export type PhotoCarouselProps = {
  photos: readonly string[];
  /** Nom du garage : son initiale tient lieu de repère quand il n'y a rien à montrer. */
  name: string;
};

/**
 * Bandeau photo de la fiche garage.
 *
 * Défilement page à page, et **indicateur en tirets** plutôt qu'en points : le
 * tiret actif est plus long, ce qui se lit de loin et sous le soleil, là où
 * trois points de six pixels se ressemblent tous. C'est aussi la seule forme de
 * pagination compatible avec le reste de l'identité — des pastilles rondes
 * empilées feraient carrousel générique.
 *
 * Aucun indicateur quand il n'y a qu'une photo : paginer une page unique
 * suggère un contenu qui n'existe pas.
 *
 * L'absence totale de photo est l'état **nominal** du parc initial, pas un cas
 * limite : on reprend les hachures de la vignette de liste, agrandies, plutôt
 * qu'un aplat gris qui se lirait comme une image en cours de chargement.
 */
export function PhotoCarousel({ photos, name }: PhotoCarouselProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  /** Photos dont l'URL ne rend rien : retirées plutôt que laissées en trou blanc. */
  const [broken, setBroken] = useState<readonly string[]>([]);

  const usable = photos.filter((uri) => !broken.includes(uri));

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(usable.length - 1, next)));
  };

  if (usable.length === 0) {
    return (
      <View
        style={{
          height: PHOTO_BANNER_HEIGHT,
          backgroundColor: theme.colors.background,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityRole="image"
        accessibilityLabel={`${name} — ${t('garage.noPhoto')}`}
      >
        <Svg width={width} height={PHOTO_BANNER_HEIGHT} style={{ position: 'absolute' }}>
          {hatchOffsets(width, PHOTO_BANNER_HEIGHT).map((offset) => (
            <Line
              key={offset}
              x1={offset - PHOTO_BANNER_HEIGHT}
              y1={PHOTO_BANNER_HEIGHT}
              x2={offset}
              y2={0}
              stroke={theme.colors.rule}
              strokeWidth={6}
            />
          ))}
        </Svg>

        <Text variant="monoStrong" tone="muted" style={{ fontSize: 42, lineHeight: 52 }}>
          {name.trim().charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: PHOTO_BANNER_HEIGHT, backgroundColor: theme.colors.background }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEnabled={usable.length > 1}
      >
        {usable.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={{ width, height: PHOTO_BANNER_HEIGHT }}
            resizeMode="cover"
            onError={() => setBroken((current) => [...current, uri])}
            accessibilityIgnoresInvertColors
            accessible
            accessibilityLabel={name}
          />
        ))}
      </ScrollView>

      {usable.length > 1 ? (
        <View
          style={{
            position: 'absolute',
            right: theme.space.lg,
            bottom: theme.space.xxl,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
          pointerEvents="none"
          accessibilityRole="text"
          accessibilityLabel={`${t('garage.photos')} ${index + 1}/${usable.length}`}
        >
          {usable.map((uri, position) => (
            <View
              key={uri}
              style={{
                // Le tiret actif s'allonge au lieu de changer de couleur : sur
                // une photo quelconque, une différence de longueur se voit
                // toujours, une différence d'opacité peut disparaître.
                width: position === index ? 22 : 10,
                height: 3,
                backgroundColor:
                  position === index ? theme.colors.surface : `${theme.colors.surface}80`,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Abscisses de départ des diagonales couvrant la boîte. */
function hatchOffsets(width: number, height: number): number[] {
  const offsets: number[] = [];
  for (let x = 0; x <= width + height; x += HATCH_SPACING) offsets.push(x);
  return offsets;
}
