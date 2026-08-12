import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { Switch } from './Switch';
import { Text } from './Text';

export type ToggleRowProps = {
  label: string;
  /** Une ligne de contexte : pourquoi la question est posée. */
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
};

/**
 * Question fermée du formulaire de panne.
 *
 * Interrupteur maison plutôt que le `Switch` de React Native : celui-ci prend
 * les couleurs du système sur Android — un vert Material au milieu d'une
 * charte rouge et crème — et sa taille n'est pas réglable. Il est **partagé**
 * avec l'écran de réglages (`src/ui/Switch.tsx`) : une seule forme
 * d'interrupteur dans toute l'app, rectangulaire comme la maquette 10.
 *
 * Toute la ligne est cliquable. Viser une pastille de 46 px debout au bord
 * d'une route est une exigence inutile quand la ligne entière peut recevoir
 * le doigt.
 */
export function ToggleRow({ label, hint, value, onChange }: ToggleRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.lg,
        minHeight: MIN_TOUCH_TARGET,
        paddingVertical: theme.space.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text variant="h2">{label}</Text>
        {hint ? (
          <Text variant="txt" tone="muted" style={{ marginTop: 2 }}>
            {hint}
          </Text>
        ) : null}
      </View>

      {/* L'interrupteur ne capte pas le geste : la ligne entière l'a déjà pris. */}
      <View pointerEvents="none">
        <Switch value={value} onValueChange={onChange} />
      </View>
    </Pressable>
  );
}
