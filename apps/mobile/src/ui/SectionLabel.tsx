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
      <Text variant="sectionLabel" style={{ color: theme.colors.sectionLabel }}>
        {children}
      </Text>
    </View>
  );
}
