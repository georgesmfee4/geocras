import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../src/theme/tokens';
import { AuthHero } from '../src/ui/AuthHero';
import { Button } from '../src/ui/Button';
import { Callout } from '../src/ui/Callout';
import { FloatingField } from '../src/ui/FloatingField';
import { DIAL_PREFIX, LOCAL_DIGITS, PHONE_EXAMPLE, toE164 } from '../src/ui/PhoneField';
import { RevealToggle } from '../src/ui/RevealToggle';
import { Text } from '../src/ui/Text';

type Mode = 'login' | 'signup';

/** Longueur minimale imposée par `passwordSchema`. */
const PASSWORD_MIN = 8;

/**
 * Connexion et inscription.
 *
 * **Un seul écran pour les deux.** Le formulaire ne diffère que d'un champ, et
 * on passe d'un mode à l'autre sans quitter la page ni perdre ce qui est déjà
 * tapé — quelqu'un qui se trompe de mode retrouve son numéro là où il l'avait
 * laissé. Le bandeau, lui, se resserre à l'inscription : trois champs, une
 * mention légale et un renvoi tiennent en dessous.
 *
 * Les champs sont à **libellé flottant** (`<FloatingField>`) : l'intitulé tient
 * lieu d'invite tant que le champ est vide, puis remonte se poser sur le filet
 * du haut. Sur un écran qui n'est que formulaire, cela vaut trois lignes
 * gagnées et, surtout, un intitulé qui ne disparaît plus à la première frappe.
 *
 * **Pas de « mot de passe oublié »**, contrairement à la maquette : aucune
 * route de réinitialisation n'existe côté serveur (`/auth` n'expose que
 * `signup`, `login`, `refresh` et `logout`). Un lien qui ne mène nulle part au
 * moment où l'on est bloqué dehors est pire que son absence.
 */
export default function ConnexionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, locale, translateError } = useI18n();
  const { login, signup } = useAuth();

  /**
   * D'où vient l'utilisateur, et dans quel mode il arrive.
   *
   * Le parcours SOS renvoie ici quand il découvre qu'il n'y a pas de session.
   * On y retourne après connexion plutôt que sur l'accueil : quelqu'un en
   * panne qui vient d'être interrompu par un formulaire ne doit pas avoir à
   * retrouver son chemin.
   */
  const { redirect, mode: requestedMode } = useLocalSearchParams<{
    redirect?: string;
    mode?: string;
  }>();

  const [mode, setMode] = useState<Mode>(requestedMode === 'signup' ? 'signup' : 'login');
  const [fullName, setFullName] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Compteur d'échecs, et non le seul message d'erreur.
   *
   * C'est lui qui secoue la marque. Deux refus identiques d'affilée — le même
   * mot de passe retapé de la même façon — doivent se voir tous les deux ;
   * avec la chaîne pour signal, le second ne changerait rien et l'écran
   * paraîtrait ne pas avoir répondu.
   */
  const [failures, setFailures] = useState(0);

  /**
   * Barre d'état claire tant que le bandeau sombre est à l'écran.
   *
   * `useFocusEffect` et non `useEffect` : depuis l'inscription on peut ouvrir
   * les conditions d'utilisation, qui s'empilent par-dessus sans démonter cet
   * écran. Sans le retour au réglage du thème à la perte du focus, l'heure et
   * la batterie resteraient blanches sur le fond clair de l'écran suivant.
   */
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(theme.scheme === 'dark' ? 'light' : 'dark');
    }, [theme.scheme]),
  );

  const phone = toE164(localPhone);
  const isSignup = mode === 'signup';

  /**
   * Avancement du formulaire, de 0 à 1.
   *
   * Pas un ornement : c'est lui qui resserre la visée de la marque à mesure
   * qu'on remplit, et `canSubmit` en est **déduit** plutôt que calculé à côté.
   * Deux définitions du même « c'est complet » finissent toujours par
   * diverger, et celle qui se voit à l'écran ne serait pas forcément celle qui
   * autorise l'envoi.
   */
  const { progress, canSubmit } = useMemo(() => {
    const checks = [
      localPhone.length === LOCAL_DIGITS,
      password.length >= PASSWORD_MIN,
      ...(isSignup ? [fullName.trim().length >= 2] : []),
    ];
    const done = checks.filter(Boolean).length;
    return { progress: done / checks.length, canSubmit: done === checks.length };
  }, [localPhone, password, isSignup, fullName]);

  const submit = useCallback(async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);

    try {
      if (isSignup) {
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
      } else {
        await login({ phone, password });
      }

      // `replace` et non `push` : une fois connecté, revenir en arrière ne doit
      // pas ramener sur le formulaire de connexion.
      if (redirect) router.replace(redirect as never);
      else router.back();
    } catch (cause) {
      setError(translateError(cause));
      setFailures((count) => count + 1);
    } finally {
      setBusy(false);
    }
  }, [
    canSubmit,
    busy,
    isSignup,
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

  const switchMode = useCallback(() => {
    // Les valeurs déjà saisies survivent au changement de mode ; seule l'erreur
    // est effacée, puisqu'elle portait sur l'autre geste.
    setMode((current) => (current === 'login' ? 'signup' : 'login'));
    setError(null);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.hero }} edges={['top']}>
      {/*
        Le fond de la zone sûre est celui du bandeau, celui du défilement celui
        de la page : la barre d'état prolonge le noir sans que le bas de l'écran
        le suive.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ backgroundColor: theme.colors.background }}
          contentContainerStyle={{ paddingBottom: theme.space.xxxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHero
            title={t(isSignup ? 'auth.signupTitle' : 'auth.loginTitle')}
            tagline={t(isSignup ? 'auth.signupLead' : 'auth.loginLead')}
            compact={isSignup}
            onBack={() => router.back()}
            progress={progress}
            busy={busy}
            failures={failures}
          />

          <View
            style={{
              paddingHorizontal: theme.space.xl,
              paddingTop: theme.space.xl,
              gap: theme.space.lg,
            }}
          >
            {isSignup ? (
              <FloatingField
                label={t('auth.fullName')}
                example={t('auth.fullNamePlaceholder')}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                autoCorrect={false}
                returnKeyType="next"
              />
            ) : null}

            {/*
              Le préfixe est figé et n'apparaît qu'avec le libellé remonté.
              `phoneSchema` n'accepte que `+237` suivi d'un opérateur valide :
              le rendre saisissable n'ouvrirait que la porte aux erreurs, sans
              offrir de choix réel.
            */}
            <FloatingField
              label={t('auth.phone')}
              example={PHONE_EXAMPLE}
              prefix={DIAL_PREFIX}
              mono
              value={localPhone}
              // On retire tout ce qui n'est pas un chiffre : les numéros se
              // dictent avec des espaces, et se collent avec des indicatifs.
              onChangeText={(value) =>
                setLocalPhone(value.replace(/\D/g, '').slice(0, LOCAL_DIGITS))
              }
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="next"
            />

            <FloatingField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!revealed}
              autoCapitalize="none"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              autoCorrect={false}
              hint={isSignup ? t('auth.passwordHint') : undefined}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              trailing={
                <RevealToggle
                  revealed={revealed}
                  onToggle={() => setRevealed((current) => !current)}
                  label={t(revealed ? 'auth.hidePassword' : 'auth.showPassword')}
                />
              }
            />

            {error ? <Callout tone="danger">{error}</Callout> : null}

            <Button
              label={t(isSignup ? 'auth.signup' : 'auth.login')}
              onPress={() => void submit()}
              disabled={!canSubmit}
              loading={busy}
              fullWidth
              style={{ marginTop: theme.space.xs }}
            />

            {isSignup ? (
              <Text variant="txt" tone="muted" style={{ textAlign: 'center' }}>
                {t('auth.legalPrefix')}{' '}
                <Text
                  variant="txt"
                  tone="secondary"
                  accessibilityRole="link"
                  onPress={() => router.push('/conditions' as never)}
                  style={{ textDecorationLine: 'underline' }}
                >
                  {t('auth.legalTerms')}
                </Text>
              </Text>
            ) : null}

            {/*
              La question en discret, l'action en rouge : c'est le seul lien de
              l'écran, il doit se voir sans concurrencer le bouton plein qui est
              juste au-dessus.
            */}
            <Pressable
              onPress={switchMode}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: theme.space.sm,
                minHeight: MIN_TOUCH_TARGET,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text variant="txt" tone="secondary">
                {t(isSignup ? 'auth.hasAccount' : 'auth.noAccount')}
              </Text>
              <Text variant="btnSm" tone="primary">
                {t(isSignup ? 'auth.login' : 'auth.signupTitle')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
