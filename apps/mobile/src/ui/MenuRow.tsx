import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChevronRightSmallIcon, type IconProps } from './icons';
import { Text } from './Text';

/**
 * Ligne de menu.
 *
 * Les lignes forment un bloc continu séparé par des filets, et non des cartes
 * détachées : elles appartiennent à la même liste, et six cartes empilées
 * fragmenteraient la lecture pour rien.
 *
 * Partagée entre le tiroir et les écrans de compte : ces deux listes doivent
 * se ressembler au pixel près, puisqu'on passe de l'une à l'autre d'un geste.
 */
export function MenuRow({
  icon: Icon,
  label,
  hint,
  trailing,
  onPress,
  first = false,
  tone = 'ink',
}: {
  icon: (props: IconProps) => ReactNode;
  label: string;
  /** Seconde ligne : ce que l'entrée fait, quand le libellé seul ne suffit pas. */
  hint?: string;
  trailing?: ReactNode;
  onPress: () => void;
  /** Seule la première ligne porte un filet haut — les autres héritent du bas de la précédente. */
  first?: boolean;
  /** `danger` réserve le rouge aux actions irréversibles. */
  tone?: 'ink' | 'danger';
}) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.colors.primary : theme.colors.ink;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_TARGET + 12,
        backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
        borderColor: theme.colors.rule,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: first ? 1 : 0,
        borderBottomWidth: 1,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
      })}
    >
      <Icon color={color} size={21} />

      <View style={{ flex: 1 }}>
        <Text variant="h2b" numberOfLines={1} ellipsizeMode="tail" style={{ color }}>
          {label}
        </Text>
        {hint ? (
          <Text variant="txt" tone="muted" numberOfLines={2} ellipsizeMode="tail">
            {hint}
          </Text>
        ) : null}
      </View>

      {trailing}
      <ChevronRightSmallIcon color={theme.colors.muted} size={14} />
    </Pressable>
  );
}
