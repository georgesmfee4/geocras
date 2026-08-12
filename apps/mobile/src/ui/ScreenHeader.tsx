import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChevronLeftIcon } from './icons';
import { Text } from './Text';

/**
 * En-tête des écrans empilés.
 *
 * Le chevron est à gauche, le titre à sa suite et non centré : un titre centré
 * oblige à réserver la même largeur à droite pour rester d'aplomb, et cette
 * place est justement occupée par l'action de l'écran.
 *
 * `action` tient cette place. C'est là que va l'enregistrement du compte :
 * face au titre, visible sans défiler, quel que soit le champ qu'on est en
 * train de remplir. Un bouton posé en bas d'un formulaire est hors de l'écran
 * dès que le clavier s'ouvre.
 *
 * Le retour passe par `back()` et non par une route fixe : ces écrans
 * s'atteignent depuis le tiroir comme depuis un autre écran de compte, et
 * renvoyer toujours au même endroit ferait perdre son fil à l'un des deux.
 */
export function ScreenHeader({ title, action }: { title: string; action?: ReactNode }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingLeft: theme.space.sm,
        paddingRight: theme.space.lg,
        minHeight: 60,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.rule,
      }}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        hitSlop={10}
        style={({ pressed }) => ({
          width: MIN_TOUCH_TARGET,
          height: MIN_TOUCH_TARGET,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ChevronLeftIcon color={theme.colors.ink} />
      </Pressable>

      {/*
        Titre d'écran : `h1`. Il gagne cinq points sur l'ancien `heading` — 22
        au lieu de 17 — ce que la barre absorbe sans bouger, son gabarit étant
        de 60 points pour 26 d'interligne. Le titre se tronque toujours plutôt
        que de repousser le bouton d'action.
      */}
      <Text variant="h1" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
        {title}
      </Text>

      {action}
    </View>
  );
}
