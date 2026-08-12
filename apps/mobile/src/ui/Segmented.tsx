import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { Text } from './Text';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Pastille posée devant le libellé. Reçoit la couleur à employer. */
  glyph?: (color: string) => ReactNode;
};

/**
 * Sélecteur segmenté.
 *
 * Trois choix exclusifs dans **un seul bloc**, et non trois puces posées côte à
 * côte. La différence n'est pas cosmétique : des puces disent « filtres qu'on
 * peut cumuler », un segment dit « une seule de ces valeurs à la fois ». Le
 * thème et la langue sont exactement ce second cas, et les puces les
 * présentaient mal.
 *
 * Le segment actif est un aplat rouge pleine hauteur, comme sur la maquette 10.
 * C'est le seul endroit du produit où le rouge sert à marquer une sélection
 * plutôt qu'une action — il le peut parce qu'il n'y a rien d'autre à côté qui
 * puisse être confondu avec un bouton.
 *
 * Rayon zéro et filets entre les cellules : le bloc se lit comme une rangée de
 * touches, pas comme une pilule.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: theme.colors.rule,
        backgroundColor: theme.colors.surface,
      }}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        // Sur l'aplat rouge, tout passe en blanc — y compris la pastille, qui
        // perdrait sa lisibilité en gardant sa couleur propre.
        const contentColor = active ? '#FFFFFF' : theme.colors.ink;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH_TARGET + 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.space.sm,
              backgroundColor: active ? theme.colors.primary : 'transparent',
              borderLeftWidth: index === 0 ? 0 : 1,
              borderLeftColor: theme.colors.rule,
            }}
          >
            {option.glyph?.(contentColor)}

            <Text
              variant={active ? 'h2' : 'txt'}
              style={{ color: active ? contentColor : theme.colors.inkSecondary }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
