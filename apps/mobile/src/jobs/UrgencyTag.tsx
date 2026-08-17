import { View } from 'react-native';
import { URGENCY_LABELS, type UrgencyLevel } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { AlertIcon } from '../ui/icons';
import { Text } from '../ui/Text';

/**
 * Couleur d'un niveau d'urgence.
 *
 * Une fonction exportée et non trois constantes recopiées : l'urgence teinte le
 * filet d'une ligne de liste, le bandeau d'un détail et l'étiquette elle-même.
 * Trois endroits, une seule décision — sinon un « danger » finit jaune quelque
 * part, et l'échelle ne veut plus rien dire.
 *
 * Le rouge est **réservé au danger**. Une panne bloquante prend le jaune de ce
 * qui demande de l'attention, une panne qui peut attendre reste discrète.
 * Peindre toute la file en rouge reviendrait à ne plus rien distinguer au
 * moment où la distinction compte.
 */
export function urgencyColor(
  urgency: UrgencyLevel,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  if (urgency === 'danger') return colors.primary;
  if (urgency === 'blocking') return colors.highlight;
  return colors.muted;
}

export type UrgencyTagProps = {
  urgency: UrgencyLevel;
  /** `solid` pour le bandeau de détail, `outline` pour les listes. */
  variant?: 'outline' | 'solid';
};

export function UrgencyTag({ urgency, variant = 'outline' }: UrgencyTagProps) {
  const theme = useTheme();
  const { locale } = useI18n();

  const color = urgencyColor(urgency, theme.colors);
  const solid = variant === 'solid';

  /**
   * Sur aplat jaune, l'encre — jamais le blanc, qui tombe à 1,9:1 et devient
   * illisible en plein soleil, c'est-à-dire dans la condition d'usage réelle.
   */
  const onSolid = urgency === 'blocking' ? theme.colors.onHighlight : theme.colors.surface;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        alignSelf: 'flex-start',
        backgroundColor: solid ? color : 'transparent',
        borderWidth: solid ? 0 : 1,
        borderColor: color,
        paddingHorizontal: theme.space.sm,
        paddingVertical: 3,
      }}
    >
      {urgency === 'danger' ? (
        <AlertIcon color={solid ? onSolid : color} size={12} />
      ) : null}
      <Text variant="lblb" style={{ color: solid ? onSolid : color }}>
        {URGENCY_LABELS[urgency][locale]}
      </Text>
    </View>
  );
}
