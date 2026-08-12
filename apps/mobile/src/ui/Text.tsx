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
  // Nouvelle échelle : mêmes chiffres, même exigence de colonne alignée.
  'num',
  'numSm',
  'numXl',
]);

/**
 * Socle appliqué à toutes les variantes, avant le niveau typographique.
 *
 * `includeFontPadding` — Android réserve autour de chaque ligne un padding
 * vertical calculé sur les métriques de la police, invisible mais réel. Avec
 * IBM Plex il décale le texte vers le bas dans tout gabarit centré : badges
 * d'écusson, libellés de boutons, cases de code, pastilles de fidélité. C'est
 * la première cause de « ça ne tombe pas au milieu sur Android », et elle ne
 * se voit jamais sur un simulateur iOS.
 *
 * `textAlignVertical` — son complément : sans lui, le texte se cale en haut
 * de sa boîte une fois le padding retiré. Sans effet sur iOS, qui centre déjà.
 */
const BASE = {
  includeFontPadding: false,
  textAlignVertical: 'center',
} as const;

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

  /**
   * Le texte ne suit jamais la taille de police du système.
   *
   * Exigence produit, pas préférence : les écrans sont denses, les gabarits
   * sont fixes, et le mode conduite doit rester lisible d'un coup d'œil au
   * volant. En « Très grand texte », une interface qui se déforme devient
   * inutilisable au moment précis où on en a besoin — au bord d'une route.
   *
   * Posé **avant** le spread : un écran garde la possibilité de le réactiver
   * ponctuellement en passant `allowFontScaling` explicitement.
   */
  return (
    <RNText
      allowFontScaling={false}
      style={[
        BASE,
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
    <RNText
      allowFontScaling={false}
      style={[base, style]}
      accessibilityRole="header"
      accessibilityLabel="GeoCras"
    >
      <RNText style={{ fontFamily: 'Inter_500Medium' }}>GEO</RNText>
      <RNText style={{ fontFamily: 'Inter_800ExtraBold' }}>CRAS</RNText>
    </RNText>
  );
}
