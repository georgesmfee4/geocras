import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../src/theme/tokens';
import { Button } from '../src/ui/Button';
import { ChevronLeftIcon } from '../src/ui/icons';
import { SectionLabel } from '../src/ui/SectionLabel';
import { Text, Wordmark } from '../src/ui/Text';

type Mode = 'login' | 'signup';

/**
 * Préfixe imposé.
 *
 * `phoneSchema` n'accepte que `+237` suivi d'un opérateur valide. Plutôt que
 * de laisser saisir un numéro libre et de refuser après coup, on fige le
 * préfixe à l'écran : l'utilisateur ne tape que les neuf chiffres, et la seule
 * erreur possible devient une faute de frappe sur son propre numéro.
 */
const DIAL_PREFIX = '+237';
const LOCAL_DIGITS = 9;

/** Longueur minimale imposée par `passwordSchema`. */
const PASSWORD_MIN = 8;

export default function ConnexionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, locale, translateError } = useI18n();
  const { login, signup } = useAuth();

  /**
   * D'où vient l'utilisateur.
   *
   * Le parcours SOS renvoie ici quand il découvre qu'il n'y a pas de session.
   * On y retourne après connexion plutôt que sur l'accueil : quelqu'un en
   * panne qui vient d'être interrompu par un formulaire ne doit pas avoir à
   * retrouver son chemin.
   */
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phone = `${DIAL_PREFIX}${localPhone}`;

  const canSubmit = useMemo(() => {
    if (localPhone.length !== LOCAL_DIGITS) return false;
    if (password.length < PASSWORD_MIN) return false;
    if (mode === 'signup' && fullName.trim().length < 2) return false;
    return true;
  }, [localPhone, password, mode, fullName]);

  const submit = useCallback(async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login({ phone, password });
      } else {
        await signup({
          fullName: fullName.trim(),
          phone,
          password,
          email: null,
          city: 'Yaoundé',
          locale,
          vehicle: null,
          referredByCode: null,
        });
      }

      // `replace` et non `push` : une fois connecté, revenir en arrière ne doit
      // pas ramener sur le formulaire de connexion.
      if (redirect) router.replace(redirect as never);
      else router.back();
    } catch (cause) {
      setError(translateError(cause));
    } finally {
      setBusy(false);
    }
  }, [
    canSubmit,
    busy,
    mode,
    login,
    signup,
    phone,
    password,
    fullName,
    locale,
    redirect,
    router,
    translateError,
  ]);

  const inputStyle = {
    height: 52,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.rule,
    borderRadius: theme.radius.field,
    paddingHorizontal: theme.space.md,
    fontFamily: theme.type.body.fontFamily,
    fontSize: theme.type.body.fontSize,
    color: theme.colors.ink,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: theme.space.sm,
            height: 56,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={10}
            style={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeftIcon color={theme.colors.ink} />
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center', paddingRight: MIN_TOUCH_TARGET }}>
            <Wordmark size={15} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.space.xl,
            paddingBottom: theme.space.xxxl,
            gap: theme.space.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: theme.space.sm }}>
            <SectionLabel>
              {t(mode === 'login' ? 'auth.loginTitle' : 'auth.signupTitle')}
            </SectionLabel>
            <Text variant="body" tone="secondary">
              {t(mode === 'login' ? 'auth.loginLead' : 'auth.signupLead')}
            </Text>
          </View>

          {mode === 'signup' ? (
            <View style={{ gap: theme.space.sm }}>
              <Text variant="bodyStrong">{t('auth.fullName')}</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('auth.fullNamePlaceholder')}
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
                style={inputStyle}
              />
            </View>
          ) : null}

          <View style={{ gap: theme.space.sm }}>
            <Text variant="bodyStrong">{t('auth.phone')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              {/*
                Préfixe non éditable. Le seul format accepté par le serveur est
                `+237` : le rendre saisissable n'ouvrirait que la porte aux
                erreurs, sans offrir de choix réel.
              */}
              <View
                style={{
                  height: 52,
                  justifyContent: 'center',
                  paddingHorizontal: theme.space.md,
                  backgroundColor: theme.colors.rule,
                  borderRadius: theme.radius.field,
                }}
              >
                <Text variant="monoStrong">{DIAL_PREFIX}</Text>
              </View>

              <TextInput
                value={localPhone}
                // On retire tout ce qui n'est pas un chiffre : les numéros se
                // dictent avec des espaces, et se collent avec des indicatifs.
                onChangeText={(value) =>
                  setLocalPhone(value.replace(/\D/g, '').slice(0, LOCAL_DIGITS))
                }
                placeholder="670123456"
                placeholderTextColor={theme.colors.muted}
                keyboardType="phone-pad"
                style={[
                  inputStyle,
                  {
                    flex: 1,
                    fontFamily: theme.type.mono.fontFamily,
                    letterSpacing: 1,
                  },
                ]}
              />
            </View>
          </View>

          <View style={{ gap: theme.space.sm }}>
            <Text variant="bodyStrong">{t('auth.password')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            {mode === 'signup' ? (
              <Text variant="small" tone="muted">
                {t('auth.passwordHint')}
              </Text>
            ) : null}
          </View>

          {error ? (
            <View
              style={{
                backgroundColor: theme.colors.primaryTint,
                padding: theme.space.md,
                borderLeftWidth: 3,
                borderLeftColor: theme.colors.primary,
              }}
            >
              <Text variant="small" tone="primary">
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            label={t(mode === 'login' ? 'auth.login' : 'auth.signup')}
            onPress={() => void submit()}
            disabled={!canSubmit}
            loading={busy}
            fullWidth
          />

          <Pressable
            onPress={() => {
              setMode((current) => (current === 'login' ? 'signup' : 'login'));
              setError(null);
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={{ alignItems: 'center', paddingVertical: theme.space.sm }}
          >
            <Text variant="body" tone="primary">
              {t(mode === 'login' ? 'auth.switchToSignup' : 'auth.switchToLogin')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
