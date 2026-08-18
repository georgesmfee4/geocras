import { Children, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { size } from '../theme/sizes';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChevronRightSmallIcon } from './icons';
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

/**
 * Hauteur d'une ligne de réglage.
 *
 * Deux cas, et un seul est arbitré.
 *
 * **Sans phrase d'aide** — c'est la ligne de la maquette 10 : un libellé, un
 * contrôle, rien d'autre. Hauteur figée à `size.rowH`, 48 points. Le libellé
 * en `h2` occupe 19 points de hauteur de ligne entre deux marges de 12 : 43
 * au total, cinq points de marge.
 *
 * **Avec phrase d'aide** — le produit en a ajouté une là où la maquette n'en
 * montrait pas, et elle porte de l'information réelle — « l'autorisation est
 * refusée, passez par les réglages », le seul cas qui en garde une depuis que
 * la page a été allégée. Le compte y devient 12 + 19 + 2 + 20 + 12, soit 65
 * points : figer ces lignes à 48 les rognerait. Elles gardent donc leur
 * `minHeight` d'origine en attendant que le gabarit à deux lignes soit relevé
 * sur maquette — l'inventer ici reviendrait à décider du dessin.
 */
const ROW_HEIGHT = MIN_TOUCH_TARGET + 14;

/** Ligne d'une seule ligne : gabarit fixe, conforme à la maquette. */
const singleLine = { height: size.rowH } as const;

/** Ligne à deux lignes : hauteur encore déduite du contenu, cf. ci-dessus. */
const withHint = { minHeight: ROW_HEIGHT } as const;

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
        ...(hint ? withHint : singleLine),
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
        <Text variant="h2b" numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        {hint ? (
          <Text variant="txt" tone="muted">
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
        ...(hint ? withHint : singleLine),
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.md,
        backgroundColor: pressed ? theme.colors.primaryTint : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h2b" numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        {hint ? (
          <Text variant="txt" tone="muted" numberOfLines={2} ellipsizeMode="tail">
            {hint}
          </Text>
        ) : null}
      </View>

      {value}
      {/*
        Le chevron mesure 14 px : très en deçà des 44 px de cible tactile. On
        ne l'agrandit pas — la maquette le veut discret — on lui rend les
        pixels manquants au doigt.
      */}
      <View hitSlop={size.hitSlop}>
        <ChevronRightSmallIcon color={theme.colors.muted} size={14} />
      </View>
    </Pressable>
  );
}
