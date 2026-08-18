import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { sectionRule } from '../theme/tokens';
import { Text } from './Text';

/**
 * Intitulé de section : filet rouge de 14 × 2 px suivi du libellé en
 * majuscules, 10 px, letter-spacing .16em.
 *
 * C'est l'un des quatre partis pris non négociables de l'identité — il revient
 * sur tous les écrans. D'où un composant plutôt qu'une recette recopiée.
 */
export function SectionLabel({
  children,
  centered = false,
  style,
}: {
  children: string;
  /**
   * Filet des **deux** côtés, l'ensemble centré.
   *
   * Une seule situation le demande, et elle est identifiable : un intitulé qui
   * ne titre pas une colonne de contenu mais **coiffe un écran entier** — le
   * « MODE CONDUITE » posé au-dessus du disque de démarrage. Sur une page
   * centrée, le filet à gauche seul décentre l'ensemble et se lit comme un
   * défaut d'alignement.
   *
   * Le trait ne change ni de couleur, ni d'épaisseur, ni de longueur : c'est
   * le même filet, en miroir.
   */
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  const rule = (
    <View
      style={{
        width: sectionRule.width,
        height: sectionRule.height,
        backgroundColor: theme.colors.primary,
      }}
    />
  );

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          justifyContent: centered ? 'center' : 'flex-start',
        },
        style,
      ]}
      accessibilityRole="header"
    >
      {rule}
      {/*
        `lblb` est le niveau écrit pour ce composant : Bebas, 11 px, filet
        rouge devant, interlettrage à 1,76 point. Rien ici n'est contraint en
        largeur, d'où l'absence de `numberOfLines` — un intitulé de section
        qui passerait à la ligne resterait lisible, le tronquer non.

        Pas de `textTransform` : les glyphes minuscules de Bebas sont des
        copies exactes des capitales, la casse est donc acquise sans lui. Le
        repli le remet, lui en a besoin.
      */}
      <Text variant="lblb" style={{ color: theme.colors.sectionLabel }}>
        {children}
      </Text>

      {centered ? rule : null}
    </View>
  );
}
