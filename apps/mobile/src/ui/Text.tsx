import {
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { TextVariant } from '../theme/tokens';

export type TextTone = 'ink' | 'secondary' | 'muted' | 'primary' | 'success' | 'warning' | 'inverse';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
};

/**
 * Texte de l'application.
 *
 * Le composant n'expose ni `fontFamily` ni `color` : on choisit une variante et
 * une tonalité. C'est ce qui garantit la règle du cahier des charges — mono
 * pour toute donnée mesurée, Inter pour le reste, jamais l'inverse — sans avoir
 * à s'en souvenir à chaque écran.
 *
 * Les variantes `mono*`, `speed` et `footnote` activent `tabular-nums` : sans
 * ça, un compteur d'ETA qui passe de 8 à 11 min décale tout le bloc à chaque
 * mise à jour.
 */
const MONO_VARIANTS: ReadonlySet<TextVariant> = new Set<TextVariant>([
  'mono',
  'monoSmall',
  'monoStrong',
  'speed',
  'speedUnit',
  'footnote',
]);

export function Text({ variant = 'body', tone = 'ink', style, ...rest }: TextProps) {
  const theme = useTheme();

  const colorByTone: Record<TextTone, string> = {
    ink: theme.colors.ink,
    secondary: theme.colors.inkSecondary,
    muted: theme.colors.muted,
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    inverse: theme.scheme === 'light' ? theme.colors.surface : theme.colors.ink,
  };

  return (
    <RNText
      style={[
        theme.type[variant],
        { color: colorByTone[tone] },
        MONO_VARIANTS.has(variant) ? { fontVariant: ['tabular-nums' as const] } : null,
        style,
      ]}
      {...rest}
    />
  );
}

/**
 * Wordmark GEOCRAS : `GEO` en poids 500, `CRAS` en poids 800.
 * Jamais « GeoCras » en CamelCase dans l'interface.
 */
export function Wordmark({
  size = 36,
  color,
  style,
}: {
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const base: TextStyle = {
    fontSize: size,
    letterSpacing: Math.round(size * 0.11 * 100) / 100,
    color: color ?? theme.colors.ink,
    lineHeight: Math.round(size * 1.15),
  };

  return (
    <RNText style={[base, style]} accessibilityRole="header" accessibilityLabel="GeoCras">
      <RNText style={{ fontFamily: 'Inter_500Medium' }}>GEO</RNText>
      <RNText style={{ fontFamily: 'Inter_800ExtraBold' }}>CRAS</RNText>
    </RNText>
  );
}
