import { isLoaded as isFontLoaded } from 'expo-font';
import {
  Text as RNText,
  StyleSheet,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import {
  BEBAS_FALLBACK_FAMILY,
  BEBAS_FAMILY,
  BEBAS_VARIANTS,
  fonts,
  type TextVariant,
} from '../theme/tokens';
import { centeredBebasPadding } from '../theme/typography';

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
  'numLg',
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
 *
 * Les deux couvrent aussi les variantes Bebas, et le socle étant posé avant le
 * niveau typographique, aucune n'a à les redemander. Bebas en a d'ailleurs plus
 * besoin que Plex : sans jambage descendant, son encre occupe 700 unités sur
 * les 1000 de l'em, et Android centre sur la boîte déclarée — pas sur les
 * capitales. Le texte remonte donc visiblement dans les boutons, les badges et
 * les onglets tant que ces deux propriétés ne sont pas là.
 */
const BASE = {
  includeFontPadding: false,
  textAlignVertical: 'center',
} as const;

/**
 * Bebas est-elle réellement disponible ?
 *
 * `isLoaded` est synchrone : interrogeable pendant le rendu, sans état ni
 * contexte à propager. Le résultat positif est mémorisé — une police chargée
 * ne se décharge pas — mais le négatif est réévalué à chaque appel : mémoriser
 * un échec figerait toute la session sur le repli.
 */
let bebasCached = false;

function bebasReady(): boolean {
  if (bebasCached) return true;
  bebasCached = isFontLoaded(BEBAS_FAMILY);
  return bebasCached;
}

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
   * Deux ajustements propres à Bebas, calculés seulement quand elle est
   * demandée : les variantes Plex ne paient rien de tout ceci.
   */
  const isBebas = BEBAS_VARIANTS.has(variant);
  let bebasFallback: TextStyle | null = null;
  let centerFix: TextStyle | null = null;

  if (isBebas) {
    /**
     * Repli famille par famille, et non pour le lot.
     *
     * `useFonts` ne remonte qu'une erreur globale ; Bebas peut manquer alors
     * que Plex Condensed est bien présente. On interroge donc la police visée
     * plutôt que l'état du chargement.
     *
     * `textTransform` réapparaît **uniquement ici**. Bebas capitalise d'
     * elle-même — ses minuscules sont des copies exactes des capitales — mais
     * le repli, lui, a un vrai bas-de-casse : sans cette ligne, les libellés
     * de section tomberaient de « MON ACTIVITÉ » à « Mon activité » pendant
     * la substitution, filet rouge intact et capitales envolées.
     */
    if (!bebasReady()) {
      bebasFallback = { fontFamily: BEBAS_FALLBACK_FAMILY, textTransform: 'uppercase' };
    }

    /**
     * Le texte centré penche vers la gauche.
     *
     * `letterSpacing` pose son espace **après** chaque lettre, la dernière
     * comprise. La boîte mesure donc l'encre plus un crénage, et la centrer
     * décale l'encre d'un demi-crénage vers la gauche. Un `paddingLeft` égal
     * au crénage élargit la boîte du côté opposé et ramène l'encre au centre
     * exact — la démonstration tient en une ligne : l'encre se retrouve à
     * `(paddingLeft - letterSpacing) / 2` du centre, nul quand les deux sont
     * égaux.
     *
     * Invisible sur un crénage serré, net sur les valeurs larges de cette
     * échelle : 2,2 pt sur un bouton, 1,76 pt sur un libellé de section.
     *
     * On repart du style aplati et non de la seule variante : `textAlign` et
     * `paddingLeft` peuvent venir de l'appelant, et un padding déjà posé doit
     * s'ajouter à la correction, pas être écrasé par elle.
     */
    const flat = (StyleSheet.flatten([theme.type[variant], style]) ?? {}) as TextStyle;
    const padding = centeredBebasPadding(flat);

    if (padding !== null) centerFix = { paddingLeft: padding };
  }

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
        bebasFallback,
        { color: colorByTone[tone] },
        MONO_VARIANTS.has(variant) ? { fontVariant: ['tabular-nums' as const] } : null,
        style,
        centerFix,
      ]}
      {...rest}
    />
  );
}

/**
 * Wordmark GEOCRAS.
 *
 * `GEO` léger, `CRAS` gras : c'est l'écart entre les deux qui fait le mot,
 * pas leur graisse absolue. Le cahier des charges le note 500 / 800 ; IBM Plex
 * Sans n'embarque ici que 400, 600 et 700, et **400 / 700 rend le même écart
 * de trois crans** — la lecture du logotype est préservée.
 *
 * Il aurait pu rester en Inter, mais un logotype dans une famille que plus
 * rien n'emploie autour de lui se remarque, et pas en bien.
 *
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
      <RNText style={{ fontFamily: fonts.sans.regular }}>GEO</RNText>
      <RNText style={{ fontFamily: fonts.sans.bold }}>CRAS</RNText>
    </RNText>
  );
}
