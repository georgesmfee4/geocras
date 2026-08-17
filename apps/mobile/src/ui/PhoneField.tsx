import { TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { FIELD_HEIGHT } from './TextField';

/**
 * Préfixe imposé, comme à l'inscription.
 *
 * `phoneSchema` n'accepte que `+237` suivi d'un opérateur valide. Plutôt que de
 * laisser saisir un numéro libre et de le refuser après coup, on fige le
 * préfixe : l'utilisateur ne tape que ses neuf chiffres, et la seule erreur
 * possible redevient la faute de frappe.
 */
export const DIAL_PREFIX = '+237';
export const LOCAL_DIGITS = 9;

/** Assemble la valeur attendue par l'API à partir des chiffres saisis. */
export function toE164(localDigits: string): string {
  return `${DIAL_PREFIX}${localDigits}`;
}

/** Extrait les neuf chiffres d'un numéro déjà enregistré. */
export function toLocalDigits(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.startsWith(DIAL_PREFIX) ? phone.slice(DIAL_PREFIX.length) : '';
}

export type PhoneFieldProps = {
  label: string;
  /** Les neuf chiffres, sans indicatif. */
  value: string;
  onChangeText: (digits: string) => void;
  hint?: string;
  error?: string | null;
};

/**
 * Saisie d'un numéro camerounais.
 *
 * En mono, comme toute donnée qu'on lit chiffre par chiffre — et avec un
 * léger interlettrage : un numéro à neuf chiffres se relit à voix haute, et
 * c'est ce qu'on fait quand on le dicte au garagiste.
 */
export function PhoneField({ label, value, onChangeText, hint, error }: PhoneFieldProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.sm }}>
      <Text variant="h2b">{label}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <View
          style={{
            height: FIELD_HEIGHT,
            justifyContent: 'center',
            paddingHorizontal: theme.space.md,
            backgroundColor: theme.colors.rule,
            borderRadius: theme.radius.field,
          }}
        >
          <Text variant="monoStrong">{DIAL_PREFIX}</Text>
        </View>

        <TextInput
          allowFontScaling={false}
          value={value}
          // On retire tout ce qui n'est pas un chiffre : les numéros se dictent
          // avec des espaces et se collent avec des indicatifs.
          onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, LOCAL_DIGITS))}
          placeholder="670123456"
          placeholderTextColor={theme.colors.muted}
          keyboardType="phone-pad"
          accessibilityLabel={label}
          style={{
            flex: 1,
            height: FIELD_HEIGHT,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: error ? theme.colors.primary : theme.colors.rule,
            borderRadius: theme.radius.field,
            paddingHorizontal: theme.space.md,
            fontFamily: theme.type.mono.fontFamily,
            fontSize: theme.type.body.fontSize,
            color: theme.colors.ink,
            letterSpacing: 1,
          }}
        />
      </View>

      {error ? (
        <Text variant="txt" tone="primary">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="txt" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
