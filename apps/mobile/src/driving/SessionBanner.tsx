import { View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { useDrivingStore } from '../stores/driving';
import { useTheme } from '../theme/ThemeProvider';
import { formatElapsed } from '../time/clock';
import { BlinkingDot } from '../ui/BlinkingDot';
import { Text } from '../ui/Text';

/**
 * Le bandeau de session : pastille, « SESSION ACTIVE », chronomètre.
 *
 * Il occupe la ligne que les autres écrans donnent à un titre, et il en fait
 * le même travail : dire où l'on est. La différence est qu'ici l'information
 * est **vivante** — la pastille clignote parce que la session tourne, et elle
 * s'éteint en pause. C'est le seul endroit de l'écran où l'on vérifie que le
 * trajet est bien en train d'être compté.
 *
 * Le compteur se rafraîchit **à la seconde** et pas au tick : le sélecteur
 * arrondit avant de comparer, donc le store peut avancer quatre fois par
 * seconde sans réveiller ce bandeau plus d'une fois.
 */
export function SessionBanner({ paused }: { paused: boolean }) {
  const theme = useTheme();
  const { t } = useI18n();

  const seconds = useDrivingStore((state) => Math.floor(state.elapsedMs / 1000));

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.md,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.md,
      }}
      accessibilityRole="header"
      accessibilityLabel={`${t('driving.activeSession')} ${formatElapsed(seconds)}`}
    >
      {paused ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.muted,
          }}
        />
      ) : (
        <BlinkingDot size={8} color={theme.colors.primary} />
      )}

      <Text variant="lblb" tone={paused ? 'secondary' : 'primary'} numberOfLines={1}>
        {paused ? t('driving.pause') : t('driving.activeSession')}
      </Text>

      {/*
        Le chronomètre compte le temps **roulé**, pauses exclues : c'est la
        durée du trajet, pas celle passée sur l'écran. `formatElapsed` est
        déjà celui du suivi d'intervention — un même chiffre s'écrit d'une
        seule façon dans toute l'application.
      */}
      <Text variant="num" tone="secondary">
        {formatElapsed(seconds)}
      </Text>
    </View>
  );
}
