import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChangePassword } from '../../src/api/hooks';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button } from '../../src/ui/Button';
import { Callout } from '../../src/ui/Callout';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

/** Même minimum que `passwordSchema` côté serveur. */
const PASSWORD_MIN = 8;

/**
 * Changer son mot de passe.
 *
 * Trois champs et rien d'autre. L'ancien est exigé bien que la session soit
 * déjà ouverte : un téléphone déverrouillé posé sur une table ne doit pas
 * suffire à verrouiller le compte de son propriétaire.
 *
 * Le serveur **révoque les autres sessions** au passage, et l'écran le dit
 * avant la saisie, pas après. Quelqu'un qui change son mot de passe parce qu'il
 * soupçonne un accès étranger doit savoir que le geste suffit — et quelqu'un
 * qui a simplement oublié le sien doit savoir qu'il devra rouvrir sa session
 * sur sa tablette.
 */
export default function MotDePasseScreen() {
  const theme = useTheme();
  const { t, translateError } = useI18n();
  const router = useRouter();

  const changePassword = useChangePassword();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tooShort = next.length > 0 && next.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const same = next.length > 0 && next === current;

  const canSubmit =
    current.length > 0 &&
    next.length >= PASSWORD_MIN &&
    confirm === next &&
    !same &&
    !changePassword.isPending;

  const submit = (): void => {
    if (!canSubmit) return;
    setError(null);

    changePassword.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: ({ revoked }) => {
          Alert.alert(
            t('password.doneTitle'),
            revoked > 0 ? t('password.doneBody') : t('password.doneBodyAlone'),
          );
          // `back` et non `replace` : on revient à l'écran Sécurité, d'où l'on
          // vient, avec son décompte d'appareils à jour.
          router.back();
        },
        onError: (cause) => setError(translateError(cause)),
      },
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title={t('password.title')} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.space.xl,
            paddingTop: theme.space.xl,
            paddingBottom: theme.space.xxxl,
            gap: theme.space.lg,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Callout>{t('password.lead')}</Callout>

          <TextField
            label={t('password.current')}
            value={current}
            onChangeText={(value) => {
              setCurrent(value);
              setError(null);
            }}
            placeholder={t('auth.passwordPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextField
            label={t('password.new')}
            value={next}
            onChangeText={setNext}
            placeholder={t('auth.passwordPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            hint={t('password.tooShort')}
            error={tooShort ? t('password.tooShort') : same ? t('password.same') : null}
          />

          <TextField
            label={t('password.confirm')}
            value={confirm}
            onChangeText={setConfirm}
            placeholder={t('auth.passwordPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            error={mismatch ? t('password.mismatch') : null}
          />

          {error ? <Callout tone="danger">{error}</Callout> : null}

          <Button
            label={t('password.submit')}
            onPress={submit}
            disabled={!canSubmit}
            loading={changePassword.isPending}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
