import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDeleteAccount, useMyGarage, useUpdateProfile } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { closeDrawerFromAnywhere } from '../../src/navigation/drawerControl';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button } from '../../src/ui/Button';
import { Callout } from '../../src/ui/Callout';
import { TowTruckIcon, TrashIcon } from '../../src/ui/icons';
import { MenuRow } from '../../src/ui/MenuRow';
import { PhoneField, LOCAL_DIGITS, toE164, toLocalDigits } from '../../src/ui/PhoneField';
import { SaveChip, type SaveState } from '../../src/ui/SaveChip';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

/**
 * Validation d'e-mail, volontairement grossière.
 *
 * Elle n'existe que pour rattraper la faute de frappe évidente — un `@`
 * manquant, un espace au milieu. Le serveur applique la vraie règle (zod), et
 * une expression rationnelle sévère côté client refuserait des adresses
 * valides pour rien.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Durée d'affichage de la coche « enregistré » avant que la pastille s'efface. */
const SAVED_FEEDBACK_MS = 2400;

/**
 * Gérer mon compte.
 *
 * Une page, trois blocs, dans l'ordre où on s'en sert :
 *
 *  1. **mes informations** — nom, e-mail, numéro ;
 *  2. **mon activité** — devenir garagiste, ou gérer le garage qu'on a déjà ;
 *  3. **ma session** — déconnexion, puis suppression du compte.
 *
 * L'enregistrement n'est pas au bas du formulaire mais **dans l'en-tête, face
 * au titre** : il apparaît en battant dès la première frappe et reste visible
 * quel que soit le champ ouvert. Un bouton posé sous le dernier champ passe
 * sous le clavier au moment précis où l'on vient de finir de taper.
 *
 * La suppression ferme la page, seule dans son bloc et détachée du bas de
 * l'écran : elle ne doit tomber ni sous le doigt qui visait « Enregistrer », ni
 * au ras des touches de navigation du téléphone.
 */
export default function CompteScreen() {
  const theme = useTheme();
  const { t, translateError } = useI18n();
  const router = useRouter();
  const { status, user, logout, refreshUser } = useAuth();

  const garage = useMyGarage(user !== null);
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Les champs suivent le compte, pas l'inverse.
   *
   * Un état initialisé une seule fois resterait vide si l'écran est monté avant
   * que `/me` ait répondu — cas normal sur un lien profond. Et après
   * enregistrement, c'est la valeur retenue par le serveur qui doit s'afficher,
   * pas celle qu'on a tapée : le serveur découpe les espaces.
   */
  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setEmail(user.email ?? '');
    setPhone(toLocalDigits(user.phone));
  }, [user]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim();

  const emailInvalid = trimmedEmail.length > 0 && !EMAIL_PATTERN.test(trimmedEmail);
  const phoneInvalid = phone.length !== LOCAL_DIGITS;
  const phoneChanged = user !== null && toE164(phone) !== user.phone;

  const dirty =
    user !== null &&
    (trimmedName !== user.fullName ||
      (trimmedEmail === '' ? null : trimmedEmail) !== user.email ||
      phoneChanged);

  const valid = trimmedName.length >= 2 && !emailInvalid && !phoneInvalid;

  const saveState: SaveState = updateProfile.isPending
    ? 'saving'
    : dirty && valid
      ? 'dirty'
      : justSaved
        ? 'saved'
        : 'idle';

  const touch = (): void => {
    setJustSaved(false);
    if (savedTimer.current) clearTimeout(savedTimer.current);
  };

  const save = async (): Promise<void> => {
    if (!dirty || !valid || !user) return;
    setError(null);

    const numberChanged = phoneChanged;

    try {
      await updateProfile.mutateAsync({
        fullName: trimmedName,
        email: trimmedEmail === '' ? null : trimmedEmail,
        ...(numberChanged ? { phone: toE164(phone) } : {}),
      });

      // Le contexte d'authentification porte sa propre copie du profil — c'est
      // elle que lisent le tiroir et la salutation. Sans ce rappel, le nom
      // change ici et nulle part ailleurs.
      await refreshUser();

      setJustSaved(true);
      savedTimer.current = setTimeout(() => setJustSaved(false), SAVED_FEEDBACK_MS);

      // Le changement de numéro mérite mieux qu'une coche : c'est l'identifiant
      // de connexion qui vient de bouger, et la reprise de l'historique n'est
      // pas instantanée. On le dit noir sur blanc plutôt que de laisser
      // découvrir un compte incomplet dans les minutes qui suivent.
      if (numberChanged) {
        Alert.alert(t('account.phoneChangedTitle'), t('account.phoneChangedBody'));
      }
    } catch (cause) {
      setError(translateError(cause));
    }
  };

  /**
   * Après une sortie de session, l'écran de compte n'a plus rien à afficher.
   *
   * Le tiroir est resté ouvert sous cet écran — c'est ce qui rend son ouverture
   * instantanée. On le referme ici, sans quoi la déconnexion déposerait
   * l'utilisateur sur le menu au lieu de la carte.
   */
  const leave = (): void => {
    closeDrawerFromAnywhere();
    router.replace('/(drawer)/(tabs)/carte' as never);
  };

  const confirmLogout = (): void => {
    Alert.alert(t('account.logoutTitle'), t('account.logoutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('drawer.logout'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await logout();
            leave();
          })();
        },
      },
    ]);
  };

  const confirmDelete = (): void => {
    Alert.alert(t('account.deleteTitle'), t('account.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setError(null);
            try {
              await deleteAccount.mutateAsync();
              // Le compte n'existe plus : `logout` ne fait ici que nettoyer
              // l'appareil — jetons, socket, cache de données personnelles.
              await logout();
              leave();
            } catch (cause) {
              setError(translateError(cause));
            }
          })();
        },
      },
    ]);
  };

  /**
   * Sans session, cet écran n'a pas de contenu.
   *
   * Il n'est pas atteignable depuis le tiroir en mode invité, mais un lien
   * profond ou un jeton expiré pendant la navigation y mènent : mieux vaut une
   * porte de sortie qu'un écran de champs vides.
   */
  if (status !== 'loading' && !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <ScreenHeader title={t('account.title')} />
        <View style={{ padding: theme.space.xl, gap: theme.space.lg }}>
          <Text variant="txt" tone="secondary">
            {t('drawer.guestLead')}
          </Text>
          <Button
            label={t('drawer.login')}
            onPress={() => router.replace('/connexion' as never)}
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  const myGarage = garage.data?.garage ?? null;
  const pendingVerification = myGarage !== null && myGarage.verifiedAt === null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      // Le bas est protégé : la dernière ligne de la page est la suppression du
      // compte, et elle se confondait avec les touches de navigation d'Android.
      edges={['top', 'bottom']}
    >
      <ScreenHeader
        title={t('account.title')}
        action={<SaveChip state={saveState} onPress={() => void save()} />}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: theme.space.xxxl, gap: theme.space.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              paddingHorizontal: theme.space.xl,
              paddingTop: theme.space.xl,
              gap: theme.space.lg,
            }}
          >
            <SectionLabel>{t('account.identity')}</SectionLabel>

            <TextField
              label={t('account.fullName')}
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                touch();
              }}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <TextField
              label={t('account.email')}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                touch();
              }}
              placeholder={t('account.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={emailInvalid ? t('account.emailInvalid') : null}
            />

            <PhoneField
              label={t('account.phone')}
              value={phone}
              onChangeText={(digits) => {
                setPhone(digits);
                touch();
              }}
              hint={t('account.phoneHint')}
              error={phoneInvalid && phone.length > 0 ? t('account.phoneIncomplete') : null}
            />

            {/*
              L'avertissement n'apparaît qu'au moment où le numéro change
              réellement. Affiché en permanence, il deviendrait du décor qu'on
              ne lit plus — et c'est précisément le message qu'il ne faut pas
              rater le jour où l'on change d'opérateur.
            */}
            {phoneChanged ? (
              <Callout title={t('account.phoneChangeTitle')}>
                {t('account.phoneChangeBody')}
              </Callout>
            ) : null}

            {error ? <Callout tone="danger">{error}</Callout> : null}
          </View>

          <View style={{ gap: theme.space.md }}>
            <View style={{ paddingHorizontal: theme.space.xl }}>
              <SectionLabel>{t('account.activity')}</SectionLabel>
            </View>

            <View style={{ marginHorizontal: theme.space.lg }}>
              {myGarage ? (
                <MenuRow
                  icon={TowTruckIcon}
                  label={t('account.myGarage')}
                  hint={myGarage.name}
                  /*
                    L'état se lit sans ouvrir l'écran : c'est la seule chose
                    qu'un garagiste vient vérifier en ouvrant son compte le
                    matin. Jaune tant que le dossier est à l'étude, vert ou
                    ambre ensuite selon la détection.
                  */
                  trailing={
                    pendingVerification ? (
                      <View
                        style={{
                          backgroundColor: theme.colors.highlight,
                          paddingHorizontal: theme.space.sm,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          variant="sectionLabel"
                          style={{ color: theme.colors.onHighlight }}
                        >
                          {t('myGarage.pendingBadge')}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        variant="numSm"
                        tone={myGarage.isActive ? 'success' : 'warning'}
                      >
                        {t(myGarage.isActive ? 'garage.open' : 'garage.closed')}
                      </Text>
                    )
                  }
                  onPress={() => router.push('/compte/garage' as never)}
                  first
                />
              ) : (
                <MenuRow
                  icon={TowTruckIcon}
                  label={t('account.becomeGarage')}
                  hint={t('account.becomeGarageHint')}
                  onPress={() => router.push('/compte/devenir-garagiste' as never)}
                  first
                />
              )}
            </View>
          </View>

          <View style={{ gap: theme.space.lg }}>
            <View style={{ paddingHorizontal: theme.space.xl }}>
              <SectionLabel>{t('account.session')}</SectionLabel>
            </View>

            <View style={{ paddingHorizontal: theme.space.xl }}>
              <Button
                label={t('drawer.logout')}
                variant="outline"
                onPress={confirmLogout}
                fullWidth
              />
            </View>

            {/*
              La suppression est séparée du reste par un filet et de l'air. Ce
              n'est pas une entrée de menu de plus : c'est la seule action de
              cette page qu'on ne peut pas défaire.
            */}
            <View
              style={{
                marginTop: theme.space.xl,
                borderTopWidth: 1,
                borderTopColor: theme.colors.rule,
                paddingTop: theme.space.xl,
                marginHorizontal: theme.space.lg,
              }}
            >
              <MenuRow
                icon={TrashIcon}
                label={t('account.delete')}
                hint={t('account.deleteHint')}
                tone="danger"
                onPress={confirmDelete}
                first
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
