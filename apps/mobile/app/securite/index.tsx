import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRevokeOtherSessions, useSessions } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { env } from '../../src/config/env';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useCoordinates } from '../../src/location/LocationProvider';
import {
  MAX_TRUSTED_CONTACTS,
  positionLink,
  useTrustedContacts,
  type TrustedContact,
} from '../../src/security/trustedContacts';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../../src/theme/tokens';
import { Accordion } from '../../src/ui/Accordion';
import { Button } from '../../src/ui/Button';
import { Callout } from '../../src/ui/Callout';
import { ChamferView } from '../../src/ui/ChamferView';
import { AlertIcon, MapPinIcon, PhoneIcon, ShieldLockIcon, TrashIcon } from '../../src/ui/icons';
import { MenuRow } from '../../src/ui/MenuRow';
import { PhoneField, LOCAL_DIGITS, toE164 } from '../../src/ui/PhoneField';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

/**
 * Sécurité.
 *
 * Trois strates, dans l'ordre de ce qui protège réellement quelqu'un en panne
 * au bord d'une route camerounaise :
 *
 *  1. **prévenir un proche** — la seule fonction de cet écran qui serve pendant
 *     la panne elle-même, et la plus utile de toutes ;
 *  2. **garder la main sur son compte** — mot de passe, appareils connectés ;
 *  3. **savoir à quoi s'attendre** — ce que le garagiste voit, et comment
 *     reconnaître une arnaque.
 *
 * Deux partis pris valent d'être écrits :
 *
 * **Le SMS plutôt que la notification.** Prévenir un proche passe par
 * l'application SMS du téléphone, avec un lien de carte. Un SMS traverse un
 * réseau où les données ne passent plus — c'est le cas sur la nationale dès
 * qu'on s'éloigne des villes — et le destinataire n'a besoin ni de GeoCras ni
 * d'un forfait pour le lire.
 *
 * **Les contacts ne quittent pas l'appareil.** La liste des proches de
 * quelqu'un n'a aucune raison d'exister sur nos serveurs. C'est dit à l'écran,
 * parce que c'est exactement la question qu'on se pose en la saisissant.
 *
 * Ce qui n'y est **pas** : le verrouillage par code de l'application. Il n'a de
 * sens que gardé à la racine de l'app, et un réglage qui n'empêche rien serait
 * pire qu'absent.
 */
export default function SecuriteScreen() {
  const theme = useTheme();
  const { t, plural } = useI18n();
  const router = useRouter();
  const { user, status } = useAuth();
  const position = useCoordinates();

  const contacts = useTrustedContacts();
  const sessions = useSessions(user !== null);
  const revokeOthers = useRevokeOtherSessions();

  const [adding, setAdding] = useState(false);

  const sessionCount = sessions.data?.sessions.length ?? 0;

  /**
   * Composer un SMS prêt à partir.
   *
   * On n'envoie rien à la place de l'utilisateur : le système ouvre son
   * application de messages, il relit, il envoie. Envoyer un SMS dans son dos
   * lui coûterait de l'argent sans qu'il l'ait décidé.
   */
  const sendPosition = (contact: TrustedContact): void => {
    if (!position) return;

    const body = `${t('security.smsBody')} : ${positionLink(position)}`;
    const separator = Platform.OS === 'ios' ? '&' : '?';
    void Linking.openURL(`sms:${contact.phone}${separator}body=${encodeURIComponent(body)}`);
  };

  const confirmRemove = (contact: TrustedContact): void => {
    Alert.alert(t('security.contactRemoveTitle'), contact.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('security.contactRemove'),
        style: 'destructive',
        onPress: () => void contacts.remove(contact.id),
      },
    ]);
  };

  const confirmRevokeOthers = (): void => {
    Alert.alert(t('security.revokeOthersTitle'), t('security.revokeOthersBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('security.revokeOthers'),
        style: 'destructive',
        onPress: () => {
          revokeOthers.mutate(undefined, {
            onSuccess: ({ revoked }) => {
              Alert.alert(
                t('security.title'),
                revoked === 0
                  ? t('security.revokedNone')
                  : `${revoked} ${t(
                      plural(revoked) === 'one'
                        ? 'security.revokedOne'
                        : 'security.revokedMany',
                    )}`,
              );
            },
          });
        },
      },
    ]);
  };

  if (status !== 'loading' && !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <ScreenHeader title={t('security.title')} />
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

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title={t('security.title')} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.xxxl, gap: theme.space.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------------------- contacts de confiance */}
        <View style={{ paddingTop: theme.space.xl, gap: theme.space.md }}>
          <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.sm }}>
            <SectionLabel>{t('security.contacts')}</SectionLabel>
            <Text variant="txt" tone="secondary">
              {t('security.contactsLead')}
            </Text>
          </View>

          {contacts.contacts.length === 0 && !contacts.loading ? (
            <Text
              variant="txt"
              tone="muted"
              style={{ paddingHorizontal: theme.space.xl }}
            >
              {t('security.contactsEmpty')}
            </Text>
          ) : null}

          {contacts.contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              canSend={position !== null}
              onSend={() => sendPosition(contact)}
              onRemove={() => confirmRemove(contact)}
            />
          ))}

          {position === null ? (
            <View style={{ paddingHorizontal: theme.space.xl }}>
              <Text variant="txt" tone="warning">
                {t('security.noPosition')}
              </Text>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.md }}>
            {adding ? (
              <ContactForm
                onCancel={() => setAdding(false)}
                onSave={async (contact) => {
                  await contacts.add(contact);
                  setAdding(false);
                }}
              />
            ) : contacts.contacts.length >= MAX_TRUSTED_CONTACTS ? (
              <Text variant="txt" tone="muted">
                {t('security.contactsFull')}
              </Text>
            ) : (
              <Button
                label={t('security.contactAdd')}
                variant="outline"
                onPress={() => setAdding(true)}
                fullWidth
              />
            )}
          </View>
        </View>

        {/* ---------------------------------------------------- accès au compte */}
        <View style={{ gap: theme.space.md }}>
          <View style={{ paddingHorizontal: theme.space.xl }}>
            <SectionLabel>{t('security.account')}</SectionLabel>
          </View>

          <View style={{ marginHorizontal: theme.space.lg }}>
            <MenuRow
              icon={ShieldLockIcon}
              label={t('security.password')}
              hint={t('security.passwordHint')}
              onPress={() => router.push('/securite/mot-de-passe' as never)}
              first
            />
          </View>

          <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.md }}>
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.rule,
                padding: theme.space.lg,
                gap: theme.space.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.sm }}>
                {/* Un décompte d'appareils est une mesure : mono, et grand. */}
                <Text variant="mono" style={{ fontSize: 28, lineHeight: 32 }}>
                  {sessions.isPending ? '—' : sessionCount}
                </Text>
                <Text variant="h2" style={{ flex: 1 }}>
                  {t(
                    plural(sessionCount) === 'one'
                      ? 'security.devicesOne'
                      : 'security.devicesMany',
                  )}
                </Text>
              </View>

              <Text variant="txt" tone="secondary">
                {t('security.devicesLead')}
              </Text>

              {sessions.data?.sessions.map((session) => (
                <SessionRow key={session.id} createdAt={session.createdAt} />
              ))}

              {sessionCount > 1 ? (
                <Callout icon={AlertIcon}>{t('security.devicesMultiple')}</Callout>
              ) : null}

              <Button
                label={t('security.revokeOthers')}
                variant="outline"
                onPress={confirmRevokeOthers}
                loading={revokeOthers.isPending}
                disabled={sessionCount < 2}
                fullWidth
              />
            </View>
          </View>
        </View>

        {/* -------------------------------------------- ce qu'on explique, replié */}
        <View style={{ paddingHorizontal: theme.space.xl }}>
          <Accordion title={t('security.visibility')}>
            <View style={{ gap: theme.space.md }}>
              <Bullet tone="ink">{t('security.visibilityBefore')}</Bullet>
              <Bullet tone="ink">{t('security.visibilityAfter')}</Bullet>
              <Bullet tone="success">{t('security.visibilityNever')}</Bullet>
            </View>
          </Accordion>

          <Accordion title={t('security.scams')}>
            <View style={{ gap: theme.space.md }}>
              {/*
                Le premier conseil est le seul en jaune : au Cameroun, l'acompte
                Mobile Money réclamé avant le déplacement est *l'*arnaque, et
                celle qui coûte le plus cher à quelqu'un déjà immobilisé.
              */}
              <Callout>{t('security.scam1')}</Callout>
              <Bullet tone="ink">{t('security.scam2')}</Bullet>
              <Bullet tone="ink">{t('security.scam3')}</Bullet>
              <Bullet tone="ink">{t('security.scam4')}</Bullet>

              <Pressable
                onPress={() => void Linking.openURL(`tel:${env.supportPhone}`)}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.sm,
                  paddingVertical: theme.space.sm,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <PhoneIcon color={theme.colors.primary} size={17} />
                <Text variant="h2" tone="primary">
                  {t('security.report')}
                </Text>
              </Pressable>
            </View>
          </Accordion>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Un contact, et ses deux gestes.
 *
 * Deux lignes plutôt qu'une : l'avatar, le nom et le retrait tiennent en haut,
 * l'envoi occupe toute la largeur en dessous. Sur un écran de 360 points, les
 * trois côte à côte laissaient au nom une quinzaine de pixels — et surtout,
 * l'envoi est le geste qu'on fait **debout au bord d'une route, en panne** : il
 * mérite la pleine largeur, pas un bouton coincé entre un nom tronqué et une
 * corbeille.
 *
 * Le retrait, lui, se fait une fois dans sa vie, assis au calme. Une icône
 * discrète en bout de ligne suffit, et elle ne doit surtout pas ressembler à
 * l'action principale.
 */
function ContactRow({
  contact,
  canSend,
  onSend,
  onRemove,
}: {
  contact: TrustedContact;
  canSend: boolean;
  onSend: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  const initial = contact.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      style={{
        marginHorizontal: theme.space.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
          padding: theme.space.md,
        }}
      >
        {/* L'angle coupé : la charte le réserve aux avatars, c'en est un. */}
        <ChamferView
          fill={theme.colors.ink}
          style={{ width: 40, height: 40 }}
          contentStyle={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="heading" tone="inverse">
            {initial}
          </Text>
        </ChamferView>

        <View style={{ flex: 1 }}>
          <Text variant="h2" numberOfLines={1}>
            {contact.name}
          </Text>
          {/* Un numéro se lit chiffre par chiffre : mono, toujours. */}
          <Text variant="numSm" tone="secondary">
            {contact.phone}
          </Text>
        </View>

        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`${t('security.contactRemove')} — ${contact.name}`}
          hitSlop={12}
          style={({ pressed }) => ({ padding: theme.space.sm, opacity: pressed ? 0.5 : 1 })}
        >
          <TrashIcon color={theme.colors.muted} size={17} />
        </Pressable>
      </View>

      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={`${t('security.sendPosition')} — ${contact.name}`}
        accessibilityState={{ disabled: !canSend }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.sm,
          minHeight: MIN_TOUCH_TARGET,
          backgroundColor: theme.colors.highlightTint,
          borderTopWidth: 1,
          borderTopColor: theme.colors.rule,
          opacity: !canSend ? 0.45 : pressed ? 0.75 : 1,
        })}
      >
        <MapPinIcon color={theme.colors.userPositionDeep} size={17} />
        <Text variant="h2">{t('security.sendPosition')}</Text>
      </Pressable>
    </View>
  );
}

/** Saisie d'un contact, dépliée sous la liste plutôt que dans un écran à part. */
function ContactForm({
  onSave,
  onCancel,
}: {
  onSave: (contact: { name: string; phone: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length >= 2 && digits.length === LOCAL_DIGITS;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.rule,
        backgroundColor: theme.colors.surface,
        padding: theme.space.lg,
        gap: theme.space.lg,
      }}
    >
      <TextField
        label={t('security.contactName')}
        value={name}
        onChangeText={setName}
        placeholder={t('security.contactNamePlaceholder')}
        autoCapitalize="words"
      />

      <PhoneField label={t('security.contactPhone')} value={digits} onChangeText={setDigits} />

      <View style={{ flexDirection: 'row', gap: theme.space.md }}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({
            justifyContent: 'center',
            paddingHorizontal: theme.space.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text variant="h2" tone="secondary">
            {t('common.cancel')}
          </Text>
        </Pressable>

        <Button
          label={t('security.contactSave')}
          onPress={() => {
            if (!valid || busy) return;
            setBusy(true);
            void onSave({ name: name.trim(), phone: toE164(digits) }).finally(() =>
              setBusy(false),
            );
          }}
          disabled={!valid}
          loading={busy}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function SessionRow({ createdAt }: { createdAt: string }) {
  const theme = useTheme();
  const { t, formatDate, formatTime } = useI18n();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.rule,
        paddingTop: theme.space.sm,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.colors.success,
        }}
      />
      <Text variant="txt" tone="secondary" style={{ flex: 1 }}>
        {t('security.devicesSince')}
      </Text>
      <Text variant="numSm" tone="muted">
        {formatDate(createdAt)} · {formatTime(createdAt)}
      </Text>
    </View>
  );
}

/**
 * Puce de liste.
 *
 * Un carré de 5 px et non un rond : le produit n'a pas de pastilles ailleurs
 * que sur les états vivants, et une puce ronde ici les banaliserait.
 */
function Bullet({ children, tone }: { children: string; tone: 'ink' | 'success' }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.md }}>
      <View
        style={{
          width: 5,
          height: 5,
          marginTop: 7,
          backgroundColor: tone === 'success' ? theme.colors.success : theme.colors.ink,
        }}
      />
      <Text variant="txt" tone="secondary" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}
