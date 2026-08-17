import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { CloseIcon } from '../ui/icons';
import { Text } from '../ui/Text';

/** Taille de la pointe qui relie le message à la ligne du garage. */
const NOTCH = { width: 16, height: 8 } as const;

/** Retrait de la pointe depuis le bord gauche — elle vise la vignette du garage. */
const NOTCH_LEFT = 28;

export type PinnedGarageNoticeProps = {
  /**
   * `true` quand le message montre une ligne juste en dessous.
   *
   * `false` quand le garage demandé n'est pas dans la liste : il n'y a alors
   * rien à désigner, et une pointe qui viserait le premier garage venu
   * désignerait le mauvais.
   */
  pointing: boolean;
  onDismiss: () => void;
};

/**
 * Rappel du garage demandé depuis sa fiche.
 *
 * Il répond à une question que l'écran pose sans le vouloir : « pourquoi
 * celui-là est-il en premier alors que j'ai trié par note ? ». Sans ce mot,
 * l'épinglage passe pour un défaut de tri.
 *
 * **Jaune**, et le seul de l'écran. Ce n'est ni une alerte — le rouge est pris
 * par le SOS et l'ambre par les avertissements — ni une confirmation. C'est un
 * repère, et le jaune est la couleur que l'app réserve à ce qui vous appartient
 * en propre : votre position sur la carte, votre demande ici. L'encre posée
 * dessus est forcée sombre dans les deux thèmes (`onHighlight`) : du blanc sur
 * ce jaune tomberait à 1,9:1, illisible en plein soleil.
 *
 * La pointe est dessinée sous la boîte plutôt qu'obtenue par une rotation de
 * 45° : un carré tourné laisse ses bords dépasser en biais des deux côtés, et
 * il faudrait le masquer. Un triangle plein est exact du premier coup.
 */
export function PinnedGarageNotice({ pointing, onDismiss }: PinnedGarageNoticeProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View accessibilityRole="alert">
      <View
        style={{
          backgroundColor: theme.colors.highlight,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.space.sm,
          paddingLeft: theme.space.md,
          paddingRight: theme.space.xs,
          paddingVertical: theme.space.md,
        }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            variant="lblb"
            style={{ color: theme.colors.onHighlight, opacity: 0.7 }}
          >
            {t('results.pinnedLabel')}
          </Text>
          {/*
          Deux phrases complètes de treize mots : reste en Plex Sans. Bebas est
          une police d'affichage, illisible en paragraphe, et le contrôle final
          de la refonte proscrit les capitales condensées au-delà de cinq mots.
        */}
        <Text variant="h2" style={{ color: theme.colors.onHighlight }}>
            {pointing ? t('results.pinnedLead') : t('results.pinnedMissing')}
          </Text>
        </View>

        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('results.pinnedDismiss')}
          hitSlop={8}
          style={({ pressed }) => ({
            width: MIN_TOUCH_TARGET - theme.space.sm,
            height: MIN_TOUCH_TARGET - theme.space.sm,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 0.8,
          })}
        >
          <CloseIcon color={theme.colors.onHighlight} size={16} />
        </Pressable>
      </View>

      {pointing ? (
        <Svg
          width={NOTCH.width}
          height={NOTCH.height}
          style={{ marginLeft: NOTCH_LEFT }}
          pointerEvents="none"
        >
          <Path
            d={`M0 0 H${NOTCH.width} L${NOTCH.width / 2} ${NOTCH.height} Z`}
            fill={theme.colors.highlight}
          />
        </Svg>
      ) : null}
    </View>
  );
}
