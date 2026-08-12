import { Children, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { CheckIcon, ChevronRightSmallIcon } from './icons';
import { Switch } from './Switch';
import { Text } from './Text';

/**
 * Carte de réglages.
 *
 * Un cadre, des lignes séparées par un filet intérieur, rien d'autre. C'est la
 * grammaire de la maquette 10 : les intitulés de section vivent **au-dessus**
 * de la carte, avec leur trait rouge, et la carte ne contient que des lignes de
 * même hauteur. Trois cartes empilées se lisent donc comme trois listes, et non
 * comme neuf blocs flottants.
 *
 * Le filet est posé par la carte et non par chaque ligne : une ligne ne sait
 * pas si elle est la première, et lui demander de le savoir obligerait chaque
 * appelant à compter ses enfants.
 */
export function SettingsCard({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={{
        marginHorizontal: theme.space.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
      }}
    >
      {Children.map(children, (child, index) =>
        child == null ? null : (
          <View
            style={
              index === 0
                ? undefined
                : { borderTopWidth: 1, borderTopColor: theme.colors.rule }
            }
          >
            {child}
          </View>
        ),
      )}
    </View>
  );
}

/** Hauteur commune à toutes les lignes de réglage — une rangée régulière se lit plus vite. */
const ROW_HEIGHT = MIN_TOUCH_TARGET + 14;

/**
 * Ligne à choix unique, cochée quand elle est retenue.
 *
 * La coche rouge en bout de ligne, et le libellé qui s'éteint quand l'option ne
 * l'est pas : c'est la façon dont la maquette 10 traite la langue, et elle vaut
 * pour tout choix dont les options méritent une phrase d'explication — ce qu'une
 * puce ne peut pas porter.
 */
export function OptionRow({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => ({
        minHeight: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.md,
        backgroundColor: pressed ? theme.colors.primaryTint : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant={selected ? 'bodyStrong' : 'body'} tone={selected ? 'ink' : 'secondary'}>
          {label}
        </Text>
        {hint ? (
          <Text variant="small" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>

      {selected ? <CheckIcon color={theme.colors.primary} size={18} /> : null}
    </Pressable>
  );
}

/**
 * Ligne portant un interrupteur.
 *
 * Toute la ligne bascule le réglage, pas seulement la piste : viser un
 * rectangle de 46 px avec le pouce est une exigence inutile quand la ligne
 * entière peut recevoir le doigt.
 */
export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => ({
        minHeight: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.lg,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.md,
        opacity: disabled ? 0.55 : 1,
        backgroundColor: pressed && !disabled ? theme.colors.primaryTint : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="small" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>

      {/* L'interrupteur ne capte pas le geste : la ligne l'a déjà pris. */}
      <View pointerEvents="none">
        <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
      </View>
    </Pressable>
  );
}

/**
 * Ligne qui ouvre un écran.
 *
 * Même gabarit que les deux autres, avec la valeur courante à droite : sur un
 * écran de réglages, ce qu'on vient vérifier est souvent la valeur, pas le
 * chemin qui y mène.
 */
export function LinkRow({
  label,
  hint,
  value,
  onPress,
}: {
  label: string;
  hint?: string;
  /** Valeur affichée à droite. En mono si c'est une mesure — à l'appelant d'en décider. */
  value?: ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => ({
        minHeight: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.md,
        backgroundColor: pressed ? theme.colors.primaryTint : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>

      {value}
      <ChevronRightSmallIcon color={theme.colors.muted} size={14} />
    </Pressable>
  );
}
