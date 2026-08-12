import { TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type TextFieldProps = TextInputProps & {
  label: string;
  /** Ligne d'explication sous le champ — remplacée par l'erreur le cas échéant. */
  hint?: string;
  error?: string | null;
  /** Saisie en mono : plaques, numéros, tout ce qui se lit chiffre par chiffre. */
  mono?: boolean;
};

/** Hauteur commune à tous les champs du produit, cible tactile comprise. */
export const FIELD_HEIGHT = 52;

/**
 * Champ de saisie.
 *
 * Rayon 2 px et **jamais de chamfer** : le cahier des charges réserve l'angle
 * coupé aux boutons, logos, avatars et badges, et l'interdit explicitement sur
 * les champs.
 *
 * Le filet passe au rouge quand le champ est en erreur, et le message remplace
 * l'aide plutôt que de s'y ajouter : deux lignes sous un champ, dont une qui ne
 * s'applique plus, se lisent mal debout au soleil.
 */
export function TextField({ label, hint, error, mono = false, style, ...rest }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.sm }}>
      <Text variant="bodyStrong">{label}</Text>

      {/*
        Même règle que `<Text>` : la saisie ne suit pas la taille de police du
        système. Le champ a une hauteur fixe ; un texte agrandi y serait rogné.
      */}
      <TextInput
        allowFontScaling={false}
        placeholderTextColor={theme.colors.muted}
        accessibilityLabel={label}
        style={[
          {
            height: FIELD_HEIGHT,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: error ? theme.colors.primary : theme.colors.rule,
            borderRadius: theme.radius.field,
            paddingHorizontal: theme.space.md,
            fontFamily: mono ? theme.type.mono.fontFamily : theme.type.body.fontFamily,
            fontSize: theme.type.body.fontSize,
            color: theme.colors.ink,
          },
          style,
        ]}
        {...rest}
      />

      {error ? (
        <Text variant="small" tone="primary">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
