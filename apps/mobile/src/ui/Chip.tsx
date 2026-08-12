import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { chromeShadow, MIN_TOUCH_TARGET } from '../theme/tokens';
import type { IconProps } from './icons';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /**
   * Pictogramme du filtre.
   *
   * Reçoit la couleur à appliquer : la puce décide seule du contraste selon
   * qu'elle est active ou non, l'appelant n'a pas à s'en occuper.
   */
  icon?: (props: IconProps) => ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Hauteur visuelle de la puce. */
const HEIGHT = 34;

/**
 * Rattrapage de zone tactile.
 *
 * La puce est volontairement plus fine que la cible de 44 px imposée par le
 * cahier des charges. On rend les pixels manquants en `hitSlop` : le doigt
 * garde ses 44 px, l'œil voit une barre de filtres légère. C'est la seule
 * façon d'obtenir les deux — l'épaissir alourdirait le haut de l'écran, la
 * rétrécir sans compensation la rendrait difficile à atteindre en marchant.
 */
const TOUCH_PADDING = Math.max(0, (MIN_TOUCH_TARGET - HEIGHT) / 2);

/**
 * Puce de filtre ou de tri.
 *
 * Active : fond encre `#1C1A17`, libellé et pictogramme blancs. Inactive :
 * surface blanche, filet. Rayon 2 px, conformément à la règle des rayons —
 * pas de pilule arrondie, qui rendrait l'app générique.
 */
export function Chip({ label, active = false, onPress, icon, style }: ChipProps) {
  const theme = useTheme();

  // Sur fond encre, tout passe en blanc. Inactif, le pictogramme reste plus
  // discret que le libellé : il situe le filtre, il ne le crie pas.
  const iconColor = active ? theme.colors.surface : theme.colors.inkSecondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={{ top: TOUCH_PADDING, bottom: TOUCH_PADDING, left: 4, right: 4 }}
      style={({ pressed }) => [
        {
          height: HEIGHT,
          paddingHorizontal: theme.space.md,
          borderRadius: theme.radius.chip,
          backgroundColor: active ? theme.colors.ink : theme.colors.surface,
          // Le filet reste sur la puce inactive : sur fond de carte crème,
          // l'ombre seule ne suffit pas à dessiner le bord.
          borderWidth: active ? 0 : 1,
          borderColor: theme.colors.rule,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          shadowColor: theme.colors.shadow,
          ...chromeShadow,
          // Une puce active est un aplat encre : elle porte déjà son poids, une
          // ombre l'alourdirait sans rien séparer.
          ...(active ? { shadowOpacity: 0, elevation: 0 } : null),
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon?.({ color: iconColor, size: 15 })}

      <Text variant="smallStrong" tone={active ? 'inverse' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}
