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
  style,
}: {
  children: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }, style]}
      accessibilityRole="header"
    >
      <View
        style={{
          width: sectionRule.width,
          height: sectionRule.height,
          backgroundColor: theme.colors.primary,
        }}
      />
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
    </View>
  );
}
