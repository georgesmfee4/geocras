import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChamferView } from './ChamferView';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'outline' | 'success';
export type ButtonSize = 'regular' | 'large';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  /** Deuxième ligne, plus petite — cf. le bouton SOS de la maquette 01. */
  sublabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Bouton d'action.
 *
 * Toujours chamfré : le cahier des charges impose l'angle coupé sur les boutons
 * d'action. La variante `wide` du chamfer s'active automatiquement en pleine
 * largeur, où une coupe standard serait disproportionnée.
 *
 * La hauteur minimale respecte la cible tactile de 44 px — le produit s'utilise
 * debout au bord d'une route, pas assis à un bureau.
 */
export function Button({
  label,
  sublabel,
  variant = 'primary',
  size = 'regular',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled === true || loading;

  const height = size === 'large' ? 64 : MIN_TOUCH_TARGET + 4;

  const fills: Record<ButtonVariant, string> = {
    primary: theme.colors.primary,
    outline: 'transparent',
    success: theme.colors.success,
  };

  const labelTone = variant === 'outline' ? 'ink' : 'inverse';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={sublabel ? `${label}. ${sublabel}` : label}
      disabled={isDisabled}
      style={({ pressed }) => [
        { opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        fullWidth ? { alignSelf: 'stretch' } : null,
        style,
      ]}
      {...rest}
    >
      <ChamferView
        variant={fullWidth ? 'wide' : 'standard'}
        fill={fills[variant]}
        borderColor={theme.colors.ink}
        borderWidth={variant === 'outline' ? 1.5 : 0}
        style={{ minHeight: height }}
        contentStyle={{
          minHeight: height,
          justifyContent: 'center',
          alignItems: sublabel ? 'flex-start' : 'center',
          paddingHorizontal: theme.space.xl,
          paddingVertical: theme.space.md,
        }}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'outline' ? theme.colors.ink : theme.colors.surface}
          />
        ) : (
          <View>
            {/* `numberOfLines={1}` : le cahier des charges impose que le titre
                et le sous-titre du bouton SOS tiennent chacun sur une ligne. */}
            <Text variant="btn" tone={labelTone} numberOfLines={1} ellipsizeMode="tail">
              {label}
            </Text>
            {sublabel ? (
              <Text variant="txt" tone={labelTone} numberOfLines={1} style={{ opacity: 0.85 }}>
                {sublabel}
              </Text>
            ) : null}
          </View>
        )}
      </ChamferView>
    </Pressable>
  );
}
