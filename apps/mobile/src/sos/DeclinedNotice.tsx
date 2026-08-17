import { Pressable, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { CloseIcon } from '../ui/icons';
import { Text } from '../ui/Text';

/**
 * Le garage retenu a refusé la demande.
 *
 * Le message existe parce que le retour à la liste est autrement
 * incompréhensible : le client attendait une réponse, et il se retrouve à
 * choisir de nouveau sans savoir ce qui s'est passé. Le silence, ici, se lit
 * comme une app qui a perdu la demande.
 *
 * Trois choses en trois lignes, et dans cet ordre : **ce qui s'est passé**, ce
 * qui n'a pas changé — la demande est intacte, rien à ressaisir — et ce qu'il
 * reste à faire. Aucune excuse : un garage qui refuse à trois heures du matin
 * fait son travail honnêtement, et le dramatiser inquiéterait quelqu'un qui est
 * déjà en panne.
 *
 * **Jaune** et non rouge. Le rouge du produit appartient au SOS et aux échecs ;
 * un refus n'est ni l'un ni l'autre, c'est une réorientation. L'encre posée
 * dessus est forcée sombre dans les deux thèmes — du blanc sur ce jaune tombe à
 * 1,9:1, illisible en plein soleil.
 */
export function DeclinedNotice({ onDismiss }: { onDismiss: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View
      accessibilityRole="alert"
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
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="lblb" style={{ color: theme.colors.onHighlight, opacity: 0.7 }}>
          {t('results.declinedLabel')}
        </Text>
        {/* « Ce garage ne peut pas intervenir » : phrase, pas intitulé. */}
      <Text variant="h2" style={{ color: theme.colors.onHighlight }}>
          {t('results.declinedTitle')}
        </Text>
        <Text variant="txt" style={{ color: theme.colors.onHighlight, opacity: 0.85 }}>
          {t('results.declinedLead')}
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
  );
}
