import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SERVICES,
  SERVICE_LABELS,
  type Coordinates,
  type EditMyGarageBody,
  type OpeningHours,
  type Service,
} from '@geocras/shared';
import { useCreateMyGarage, useMyGarage, useUpdateMyGarage } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { areHoursValid, DEFAULT_HOURS, OpeningHoursField } from '../../src/garage/OpeningHoursField';
import { PhotosField } from '../../src/garage/PhotosField';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useLocation } from '../../src/location/LocationProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button } from '../../src/ui/Button';
import { Callout } from '../../src/ui/Callout';
import { Chip } from '../../src/ui/Chip';
import { ClockIcon, CrosshairIcon, MapPinIcon, ShieldCheckIcon } from '../../src/ui/icons';
import { PhoneField, LOCAL_DIGITS, toE164, toLocalDigits } from '../../src/ui/PhoneField';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Précision au-delà de laquelle la position ne vaut pas comme repère d'atelier.
 *
 * Le classement d'un SOS se joue à quelques centaines de mètres : un point pris
 * avec ±300 m d'incertitude peut placer le garage de l'autre côté du carrefour.
 * On n'interdit pas — un relevé médiocre vaut mieux que pas de garage — mais on
 * le dit, et la vérification tranchera.
 */
const ACCURACY_WARN_M = 120;

/**
 * Devenir garagiste.
 *
 * C'est un **dossier**, pas une inscription : ce qui est envoyé ici est vérifié
 * par GeoCras avant que le garage n'apparaisse dans la moindre recherche. D'où
 * trois exigences que le formulaire rend explicites plutôt que de les découvrir
 * après coup :
 *
 *  1. un **numéro** et un **e-mail** joignables — c'est par là que la réponse
 *     arrive, et le numéro est aussi celui que le client composera ;
 *  2. une **position relevée sur place** : le point vient du GPS, jamais d'une
 *     adresse tapée, parce qu'une adresse approximative se traduit directement
 *     en garagiste envoyé au mauvais endroit ;
 *  3. les **compétences**, qui décident des pannes qu'on lui proposera.
 *
 * Le reste — description, horaires, photos, ancienneté — est facultatif mais
 * demandé ici : ce sont les champs de la fiche publique, et ceux qu'on ne
 * remplit jamais si on ne les remplit pas tout de suite.
 *
 * Le même écran sert à **corriger** le dossier (`?edit=1`) tant que l'examen
 * dure. Deux différences seulement, et toutes deux tiennent à la position :
 * elle est reprise du dossier au lieu d'être relevée, et elle ne bouge que si
 * on le demande. Le reste est identique, et doit le rester.
 */
export default function DevenirGaragisteScreen() {
  const theme = useTheme();
  const { t, locale, formatNumber, translateError } = useI18n();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { fix, accuracyM, status: locationStatus, retry } = useLocation();

  /**
   * Deux écrans en un : le dépôt du dossier, et sa correction.
   *
   * Le formulaire est le même à la virgule près — mêmes champs, mêmes règles,
   * même position à relever. Le dupliquer pour la correction, c'était garantir
   * qu'un champ ajouté un jour d'un côté manquerait de l'autre.
   */
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';

  const create = useCreateMyGarage();
  const update = useUpdateMyGarage();
  const garage = useMyGarage(editing);

  const dossier = garage.data?.garage ?? null;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState(() => toLocalDigits(user?.phone));
  const [email, setEmail] = useState(user?.email ?? '');
  const [quarter, setQuarter] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [years, setYears] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ville du dossier.
   *
   * Sans champ à l'écran — le produit ne dessert que Yaoundé — mais gardée en
   * état pour être renvoyée telle quelle : la recalculer depuis le profil à
   * chaque correction réécrirait la ville d'un garage inscrit ailleurs.
   */
  const [city, setCity] = useState(user?.city ?? 'Yaoundé');

  /** Position déjà enregistrée dans le dossier, en mode correction. */
  const [savedPoint, setSavedPoint] = useState<Coordinates | null>(null);

  /** Nouveau relevé, quand on demande explicitement à déplacer le garage. */
  const [movedPoint, setMovedPoint] = useState<Coordinates | null>(null);

  /**
   * Report du dossier existant dans le formulaire.
   *
   * Une seule fois : la réponse du serveur est réécrite à chaque
   * enregistrement, et repartir de ses valeurs effacerait une saisie en cours.
   */
  const hydrated = useRef(false);

  useEffect(() => {
    if (!editing || hydrated.current || !dossier) return;

    hydrated.current = true;
    setName(dossier.name);
    setPhone(toLocalDigits(dossier.phone));
    setEmail(dossier.email ?? '');
    setQuarter(dossier.quarter ?? '');
    setAddress(dossier.addressLabel ?? '');
    setDescription(dossier.description ?? '');
    setYears(dossier.yearsInBusiness === null ? '' : String(dossier.yearsInBusiness));
    setServices(dossier.services);
    setHours(dossier.openingHours ?? DEFAULT_HOURS);
    setPhotos(dossier.photos);
    setCity(dossier.city);
    setSavedPoint({ lat: dossier.lat, lng: dossier.lng });
  }, [editing, dossier]);

  const trimmedEmail = email.trim();
  const emailInvalid = trimmedEmail.length === 0 || !EMAIL_PATTERN.test(trimmedEmail);

  const toggleService = (service: Service): void => {
    setServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service],
    );
  };

  const livePoint: Coordinates | null = fix ? { lat: fix.lat, lng: fix.lng } : null;

  /**
   * Position que portera le dossier.
   *
   * Au dépôt, c'est le relevé du moment : le formulaire est censé être rempli
   * depuis l'atelier, et l'écran le dit avant le premier champ.
   *
   * À la correction, c'est celle **déjà enregistrée**. On corrige souvent son
   * dossier assis chez soi, un soir : prendre le relevé courant déplacerait le
   * garage à l'endroit d'où l'on écrit, sans que personne ne l'ait demandé —
   * et c'est précisément la donnée sur laquelle porte la vérification. Il faut
   * donc un geste explicite pour la remplacer.
   */
  const point = editing ? (movedPoint ?? savedPoint) : livePoint;

  /**
   * Précision affichée.
   *
   * Nulle pour une position venue du dossier : on ne sait pas avec quelle
   * incertitude elle avait été relevée, et réafficher celle du GPS courant
   * attribuerait à un vieux point la qualité d'un relevé qu'il n'a pas eu.
   */
  const shownAccuracyM = editing && movedPoint === null ? null : accuracyM;

  const busy = create.isPending || update.isPending;

  const canSubmit = useMemo(
    () =>
      name.trim().length >= 2 &&
      phone.length === LOCAL_DIGITS &&
      !emailInvalid &&
      services.length > 0 &&
      areHoursValid(hours) &&
      point !== null &&
      !busy,
    [name, phone, emailInvalid, services, hours, point, busy],
  );

  const submit = async (): Promise<void> => {
    if (!canSubmit || !point) return;
    setError(null);

    const parsedYears = Number.parseInt(years, 10);

    const body: EditMyGarageBody = {
      name: name.trim(),
      phone: toE164(phone),
      email: trimmedEmail,
      quarter: quarter.trim() === '' ? null : quarter.trim(),
      addressLabel: address.trim() === '' ? null : address.trim(),
      city,
      lat: point.lat,
      lng: point.lng,
      services,
      description: description.trim() === '' ? null : description.trim(),
      openingHours: hours,
      photos,
      yearsInBusiness: Number.isNaN(parsedYears) ? null : parsedYears,
    };

    try {
      if (editing) {
        await update.mutateAsync(body);
      } else {
        await create.mutateAsync(body);

        // Le rôle du compte vient de passer à `garage_owner` côté serveur :
        // sans ce rappel, « Mon garage » resterait inaccessible jusqu'au
        // prochain démarrage de l'app.
        //
        // Ce rôle n'ouvre pas pour autant l'onglet Interventions : celui-ci
        // attend la vérification du dossier, pas son envoi — cf. le layout des
        // onglets.
        await refreshUser();
      }

      // `replace` : revenir en arrière depuis « Mon garage » ne doit pas
      // ramener sur un formulaire déjà envoyé.
      router.replace('/compte/garage' as never);
    } catch (cause) {
      setError(translateError(cause));
    }
  };

  const accuracyPoor = shownAccuracyM !== null && shownAccuracyM > ACCURACY_WARN_M;

  const title = editing ? t('becomeGarage.editTitle') : t('becomeGarage.title');

  /**
   * Deux impasses de la correction, atteignables par lien profond seulement.
   *
   * L'écran « Mon garage » n'affiche « Modifier » que pendant l'examen du
   * dossier. On peut malgré tout arriver ici sans dossier, ou après que la
   * vérification a eu lieu entre-temps — auquel cas le serveur refuserait
   * l'enregistrement. Le dire tout de suite vaut mieux qu'à la fin d'un
   * formulaire rempli pour rien.
   */
  if (editing && (garage.isPending || dossier === null || dossier.verifiedAt !== null)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <ScreenHeader title={title} />

        <View style={{ padding: theme.space.xl, gap: theme.space.lg }}>
          {garage.isPending ? (
            <Text variant="txt" tone="muted">
              {t('common.loading')}
            </Text>
          ) : (
            <>
              <Callout tone="danger">
                {dossier === null ? t('becomeGarage.editMissing') : t('becomeGarage.editLocked')}
              </Callout>
              <Button
                label={t('common.close')}
                variant="outline"
                onPress={() => router.back()}
                fullWidth
              />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title={title} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.space.xl,
            paddingTop: theme.space.xl,
            paddingBottom: theme.space.xxxl,
            gap: theme.space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: theme.space.md }}>
            <Text variant="txt" tone="secondary">
              {editing ? t('becomeGarage.editLead') : t('becomeGarage.lead')}
            </Text>

            {/*
              La règle du jeu, dite avant le premier champ et non après le
              dernier : ce dossier est examiné, et la réponse arrive par les
              coordonnées saisies ici. En correction, elle rappelle la seule
              chose qui change — l'examen reprend sur les valeurs corrigées.
            */}
            <Callout
              icon={editing ? ClockIcon : ShieldCheckIcon}
              title={editing ? t('becomeGarage.editNoticeTitle') : t('becomeGarage.reviewTitle')}
            >
              {editing ? t('becomeGarage.editNoticeBody') : t('becomeGarage.reviewBody')}
            </Callout>
          </View>

          <View style={{ gap: theme.space.lg }}>
            <SectionLabel>{t('becomeGarage.sectionGarage')}</SectionLabel>

            <TextField
              label={t('becomeGarage.name')}
              value={name}
              onChangeText={setName}
              placeholder={t('becomeGarage.namePlaceholder')}
              autoCapitalize="words"
            />

            <TextField
              label={t('becomeGarage.description')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('becomeGarage.descriptionPlaceholder')}
              hint={t('becomeGarage.descriptionHint')}
              multiline
              numberOfLines={4}
              maxLength={400}
              style={{ height: 108, paddingTop: theme.space.md, textAlignVertical: 'top' }}
            />

            <TextField
              label={t('becomeGarage.years')}
              value={years}
              onChangeText={(value) => setYears(value.replace(/\D/g, '').slice(0, 3))}
              placeholder="12"
              keyboardType="number-pad"
              hint={t('becomeGarage.yearsHint')}
              mono
            />
          </View>

          <View style={{ gap: theme.space.lg }}>
            <SectionLabel>{t('becomeGarage.sectionContact')}</SectionLabel>

            <PhoneField
              label={t('becomeGarage.phone')}
              value={phone}
              onChangeText={setPhone}
              hint={t('becomeGarage.phoneHint')}
            />

            <TextField
              label={t('becomeGarage.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="garage@exemple.cm"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              hint={t('becomeGarage.emailHint')}
              error={
                trimmedEmail.length > 0 && emailInvalid ? t('account.emailInvalid') : null
              }
            />
          </View>

          <View style={{ gap: theme.space.lg }}>
            <SectionLabel>{t('becomeGarage.sectionPlace')}</SectionLabel>

            <TextField
              label={t('becomeGarage.quarter')}
              value={quarter}
              onChangeText={setQuarter}
              placeholder={t('becomeGarage.quarterPlaceholder')}
              autoCapitalize="words"
            />

            <TextField
              label={t('becomeGarage.address')}
              value={address}
              onChangeText={setAddress}
              placeholder={t('becomeGarage.addressPlaceholder')}
              hint={t('becomeGarage.addressHint')}
            />

            <Callout icon={CrosshairIcon} title={t('becomeGarage.positionTitle')}>
              {editing ? t('becomeGarage.positionEditBody') : t('becomeGarage.positionBody')}
            </Callout>

            {point ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.md,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.rule,
                  padding: theme.space.md,
                }}
              >
                <MapPinIcon color={theme.colors.userPositionDeep} size={20} />
                <View style={{ flex: 1 }}>
                  {/* Coordonnées et précision : données mesurées, donc mono. */}
                  <Text variant="monoStrong">
                    {formatNumber(point.lat, 5)} · {formatNumber(point.lng, 5)}
                  </Text>

                  {/*
                    Une position venue du dossier n'a pas de précision connue :
                    on l'annonce en toutes lettres plutôt qu'en mono, qui est
                    réservé aux valeurs mesurées.
                  */}
                  {shownAccuracyM === null ? (
                    <Text variant="txt" tone="muted">
                      {t('becomeGarage.positionSaved')}
                    </Text>
                  ) : (
                    <Text variant="numSm" tone={accuracyPoor ? 'warning' : 'muted'}>
                      ±{Math.round(shownAccuracyM)} m
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={{ gap: theme.space.md }}>
                <Text variant="txt" tone="warning">
                  {t('becomeGarage.positionMissing')}
                </Text>
                {locationStatus !== 'acquiring' ? (
                  <Button label={t('common.retry')} variant="outline" onPress={retry} />
                ) : null}
              </View>
            )}

            {/*
              Déplacement du garage, en correction seulement et sur demande.
              Deux boutons plutôt qu'un interrupteur : « relever ici » est un
              acte, et le retour en arrière doit rester possible tant que rien
              n'est enregistré.
            */}
            {editing ? (
              <View style={{ gap: theme.space.sm }}>
                {/*
                  Sans relevé courant, le bouton n'est pas grisé : il disparaît
                  au profit de la raison. Un bouton désactivé sans explication
                  se lit comme une panne de l'application.
                */}
                {livePoint === null ? (
                  <>
                    <Text variant="txt" tone="muted">
                      {t('becomeGarage.positionUnavailable')}
                    </Text>
                    {locationStatus !== 'acquiring' ? (
                      <Button
                        label={t('common.retry')}
                        variant="outline"
                        onPress={retry}
                        fullWidth
                      />
                    ) : null}
                  </>
                ) : (
                  <Button
                    label={t('becomeGarage.positionUpdate')}
                    variant="outline"
                    onPress={() => setMovedPoint(livePoint)}
                    fullWidth
                  />
                )}

                {movedPoint !== null ? (
                  <Button
                    label={t('becomeGarage.positionRestore')}
                    variant="outline"
                    onPress={() => setMovedPoint(null)}
                    fullWidth
                  />
                ) : null}
              </View>
            ) : null}

            {accuracyPoor ? (
              <Text variant="txt" tone="warning">
                {t('becomeGarage.positionCoarse')}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: theme.space.md }}>
            <SectionLabel>{t('becomeGarage.services')}</SectionLabel>
            <Text variant="txt" tone="muted">
              {t('becomeGarage.servicesHint')}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
              {SERVICES.map((service) => (
                <Chip
                  key={service}
                  label={SERVICE_LABELS[service][locale]}
                  active={services.includes(service)}
                  onPress={() => toggleService(service)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: theme.space.md }}>
            <SectionLabel>{t('becomeGarage.hours')}</SectionLabel>
            <Text variant="txt" tone="muted">
              {t('becomeGarage.hoursHint')}
            </Text>
            <OpeningHoursField value={hours} onChange={setHours} />
          </View>

          <View style={{ gap: theme.space.md }}>
            <SectionLabel>{t('becomeGarage.photos')}</SectionLabel>
            <PhotosField urls={photos} onChange={setPhotos} />
          </View>

          {error ? <Callout tone="danger">{error}</Callout> : null}

          <Button
            label={editing ? t('becomeGarage.saveEdit') : t('becomeGarage.submit')}
            onPress={() => void submit()}
            disabled={!canSubmit}
            loading={busy}
            fullWidth
          />

          <Text variant="txt" tone="muted" style={{ textAlign: 'center' }}>
            {editing ? t('becomeGarage.saveEditHint') : t('becomeGarage.submitHint')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
