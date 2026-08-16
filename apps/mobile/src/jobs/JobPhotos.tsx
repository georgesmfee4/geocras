import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { CameraIcon, CloseIcon } from '../ui/icons';
import { Text } from '../ui/Text';

/** Hauteur du bandeau. Assez haute pour juger d'un dégât, pas au point de
 *  repousser la panne et la distance hors de l'écran au premier coup d'œil. */
export const JOB_PHOTO_HEIGHT = 232;

/** Espacement des hachures de l'état sans photo. */
const HATCH_SPACING = 14;

export type JobPhotosProps = {
  photos: readonly string[];
  /** Décrit ce qu'on regarde, pour les lecteurs d'écran. */
  label: string;
};

/**
 * Photos de la panne.
 *
 * C'est la seule pièce du dossier que le garagiste ne peut pas déduire : la
 * distance, l'urgence et le type de panne sont des champs, l'état réel du
 * véhicule est sur l'image. Elle est donc en tête de la fiche, pleine largeur,
 * et **agrandissable** — un capot ouvert vu dans une vignette de deux
 * centimètres ne sert à rien.
 *
 * Pagination en **tirets** et non en pastilles rondes : le tiret actif est plus
 * long, ce qui se lit de loin et en plein soleil, là où trois points de six
 * pixels se ressemblent tous. C'est aussi ce que fait déjà la fiche garage —
 * une seule grammaire de carrousel dans le produit.
 *
 * L'absence de photo n'est pas un cas limite : la plupart des SOS partent sans
 * image, parce qu'on ne photographie pas sa panne quand on est au bord d'une
 * route. D'où les hachures plutôt qu'un aplat gris, qui se lirait comme une
 * image en cours de chargement — donc comme une app qui rame.
 */
export function JobPhotos({ photos, label }: JobPhotosProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState<number | null>(null);
  /** Photos dont l'URL ne rend rien : retirées plutôt que laissées en trou blanc. */
  const [broken, setBroken] = useState<readonly string[]>([]);

  const usable = photos.filter((uri) => !broken.includes(uri));

  if (usable.length === 0) {
    return (
      <View
        style={{
          height: JOB_PHOTO_HEIGHT,
          backgroundColor: theme.colors.background,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.sm,
        }}
        accessibilityRole="image"
        accessibilityLabel={`${label} — ${t('jobs.noPhoto')}`}
      >
        <Svg width="100%" height={JOB_PHOTO_HEIGHT} style={{ position: 'absolute' }}>
          {hatchOffsets(width).map((x) => (
            <Line
              key={x}
              x1={x}
              y1={JOB_PHOTO_HEIGHT}
              x2={x - JOB_PHOTO_HEIGHT}
              y2={0}
              stroke={theme.colors.rule}
              strokeWidth={1}
            />
          ))}
        </Svg>

        <CameraIcon color={theme.colors.muted} size={26} />
        <Text variant="txt" tone="muted">
          {t('jobs.noPhoto')}
        </Text>
      </View>
    );
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(usable.length - 1, next)));
  };

  return (
    <View style={{ height: JOB_PHOTO_HEIGHT, backgroundColor: theme.colors.ink }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={64}
      >
        {usable.map((uri, position) => (
          <Pressable
            key={uri}
            onPress={() => setZoomed(position)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${label} ${position + 1}/${usable.length}`}
          >
            <Image
              source={{ uri }}
              style={{ width, height: JOB_PHOTO_HEIGHT }}
              resizeMode="cover"
              onError={() => setBroken((current) => [...current, uri])}
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        ))}
      </ScrollView>

      {usable.length > 1 ? (
        <View
          style={{
            position: 'absolute',
            bottom: theme.space.md,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: theme.space.xs,
          }}
        >
          {usable.map((uri, position) => (
            <View
              key={uri}
              style={{
                height: 2,
                width: position === index ? 20 : 8,
                backgroundColor:
                  position === index ? theme.colors.surface : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </View>
      ) : null}

      {/*
        Vue plein écran.

        Fond encre et non noir pur : le produit n'a aucun gris bleuté ni aucun
        noir neutre, pas même derrière une photo.
      */}
      <Modal
        visible={zoomed !== null}
        animationType="fade"
        onRequestClose={() => setZoomed(null)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.ink }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (zoomed ?? 0) * width, y: 0 }}
          >
            {usable.map((uri) => (
              <View key={uri} style={{ width, flex: 1, justifyContent: 'center' }}>
                <Image
                  source={{ uri }}
                  style={{ width, height: '100%' }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </View>
            ))}
          </ScrollView>

          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, right: 0 }}>
            <Pressable
              onPress={() => setZoomed(null)}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={10}
              style={({ pressed }) => ({
                width: MIN_TOUCH_TARGET,
                height: MIN_TOUCH_TARGET,
                margin: theme.space.sm,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <CloseIcon color={theme.colors.surface} size={24} />
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Abscisses de départ des diagonales couvrant le bandeau. Il en faut au-delà de
 * la largeur pour que le coin bas-gauche soit atteint.
 */
function hatchOffsets(width: number): number[] {
  const offsets: number[] = [];
  for (let x = 0; x <= width + JOB_PHOTO_HEIGHT; x += HATCH_SPACING) offsets.push(x);
  return offsets;
}
