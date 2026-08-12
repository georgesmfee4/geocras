import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PROBLEM_LABELS,
  REQUEST_VEHICLE_TYPES,
  URGENCY_LABELS,
  URGENCY_LEVELS,
  VEHICLE_LABELS,
  VEHICLE_LABEL_MAX,
  problemsForVehicle,
  type Locale,
  type ProblemType,
  type RequestVehicleType,
  type UrgencyLevel,
  type Vehicle,
} from '@geocras/shared';
import { useCreateRequest, useVehicles } from '../../src/api/hooks';
import { uploadPhoto } from '../../src/api/uploadPhoto';
import { useAuth } from '../../src/auth/AuthProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useCoordinates, useLocation } from '../../src/location/LocationProvider';
import { useReverseGeocode } from '../../src/location/useReverseGeocode';
import { PhotoField } from '../../src/sos/PhotoField';
import { SavedVehiclePicker, vehicleTitle } from '../../src/sos/SavedVehiclePicker';
import { SosHeader } from '../../src/sos/SosHeader';
import { SosIllustration } from '../../src/sos/SosIllustration';
import { VehicleTile } from '../../src/sos/VehicleTile';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../../src/theme/tokens';
import { BlinkingDot } from '../../src/ui/BlinkingDot';
import { Button } from '../../src/ui/Button';
import { Chip } from '../../src/ui/Chip';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Text } from '../../src/ui/Text';
import { ToggleRow } from '../../src/ui/ToggleRow';
import {
  AlertIcon,
  CheckIcon,
  MapPinIcon,
  ShieldLockIcon,
  type IconProps,
} from '../../src/ui/icons';

/**
 * Réservation du service aux comptes.
 *
 * Le serveur l'impose déjà : `POST /requests` passe par `requireAuth`, parce
 * qu'une demande engage deux personnes et débouche sur des points convertibles
 * en argent — elle a besoin d'une identité.
 *
 * Ce drapeau ne fait qu'avancer le refus **avant** la saisie. Il est passé à
 * `true` maintenant que `/connexion` existe : sans lui, on remplissait les
 * trois étapes pour se voir opposer « Veuillez vous reconnecter » à l'envoi,
 * sans aucun moyen de se connecter. Un refus à la fin d'un formulaire est déjà
 * pénible ; un refus sans issue est un cul-de-sac.
 */
const REQUIRE_ACCOUNT = true;

/**
 * Version du consentement.
 *
 * Elle fait partie de la clé de stockage : modifier la politique de traitement
 * revient à incrémenter ce numéro, et tout le monde est réinterrogé. Un
 * consentement recueilli sur un texte qui a changé depuis n'en est pas un.
 */
const CONSENT_KEY = 'geocras.sos-consent.v1';

const TOTAL_STEPS = 3;

/**
 * État de la photo.
 *
 * `uploading` et `failed` existent parce que le téléversement a été **sorti du
 * chemin critique** : il démarre dès que l'image est jointe, à l'étape 2, et
 * non au moment d'envoyer le SOS. Sur un réseau muet, l'ancienne version
 * faisait patienter vingt secondes pour la photo **puis** vingt de plus pour la
 * demande — quarante secondes de sablier sur un écran d'urgence, suivies d'un
 * message rassurant (« la demande part sans elle ») immédiatement démenti par
 * un échec réseau.
 *
 * Ici l'utilisateur apprend le sort de sa photo au moment où il la joint, où
 * attendre ne coûte rien, et l'envoi ne fait plus qu'un seul appel.
 *
 * Les deux échecs sont distingués parce qu'ils n'appellent pas la même
 * réaction : `unavailable` veut dire que le serveur n'a pas de fournisseur
 * d'images configuré — réessayer n'y changera rien, et ce n'est pas la faute
 * de l'utilisateur. `failed` est un vrai raté, qui mérite une nouvelle
 * tentative. Les confondre sous « Envoi impossible » laissait croire à un
 * problème de réseau là où il s'agit d'une clé absente côté serveur.
 */
type PhotoState = 'idle' | 'uploading' | 'ready' | 'unavailable' | 'failed';

type Draft = {
  /**
   * Véhicule enregistré retenu, ou `null` quand on décrit un véhicule à la main.
   *
   * Il ne remplace pas `vehicleType` : le serveur classe les garages sur le
   * genre, et une demande doit rester lisible même si la fiche véhicule est
   * supprimée plus tard. Les deux partent donc ensemble.
   */
  vehicleId: string | null;
  vehicleType: RequestVehicleType | null;
  vehicleLabel: string;
  problemType: ProblemType | null;
  description: string;
  urgency: UrgencyLevel;
  immobilized: boolean;
  vulnerablePassengers: boolean;
  /** Fichier local choisi. */
  photoUri: string | null;
  /** URL distante, une fois le téléversement abouti. */
  photoUrl: string | null;
  photoState: PhotoState;
};

const EMPTY_DRAFT: Draft = {
  vehicleId: null,
  vehicleType: null,
  vehicleLabel: '',
  problemType: null,
  description: '',
  // Défaut sur le cas courant : on est rarement en panne « qui peut attendre »
  // au bord d'une route, et jamais « en danger » par défaut.
  urgency: 'blocking',
  immobilized: true,
  vulnerablePassengers: false,
  photoUri: null,
  photoUrl: null,
  photoState: 'idle',
};

export default function DeclarerPanneScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, locale, translateError } = useI18n();

  /**
   * Garage ouvert avant la demande, quand on arrive depuis une fiche.
   *
   * Le formulaire ne s’en sert pas : il ne le lit que pour le repasser aux
   * résultats. La panne reste décrite de la même façon, et la recherche
   * interroge les mêmes garages — ce paramètre ne fait que désigner celui à
   * mettre en tête à l’arrivée.
   */
  const { garage: preferredGarageId } = useLocalSearchParams<{ garage?: string }>();
  const { status: authStatus } = useAuth();
  const { status: locationStatus, accuracyM } = useLocation();
  const origin = useCoordinates();
  const { label: address } = useReverseGeocode(origin);

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [consented, setConsented] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const createRequest = useCreateRequest();

  /**
   * Véhicules déjà enregistrés.
   *
   * Interrogés dès l'ouverture du formulaire et non à l'étape 2 : la requête a
   * ainsi le temps d'aboutir pendant qu'on lit l'écran de consentement, et la
   * liste est là au moment où elle sert.
   */
  const vehicles = useVehicles(authStatus === 'authenticated');
  const savedVehicles = useMemo(() => vehicles.data ?? [], [vehicles.data]);

  const selectedVehicle = useMemo(
    () => savedVehicles.find((each) => each.id === draft.vehicleId) ?? null,
    [savedVehicles, draft.vehicleId],
  );

  /**
   * Préremplissage par le véhicule par défaut.
   *
   * C'est la promesse faite dans « Mes véhicules » — « c'est celui qui part
   * avec le SOS » — tenue ici. Une seule fois, et seulement si rien n'a encore
   * été choisi : la liste arrive du réseau, parfois après que l'utilisateur a
   * appuyé sur une tuile, et écraser son choix serait pire que ne rien
   * préremplir du tout.
   */
  const vehiclePrefilled = useRef(false);

  useEffect(() => {
    if (vehiclePrefilled.current) return;
    const preferred = savedVehicles.find((each) => each.isDefault) ?? savedVehicles[0];
    if (!preferred) return;

    vehiclePrefilled.current = true;
    setDraft((current) =>
      current.vehicleType === null
        ? { ...current, vehicleId: preferred.id, vehicleType: preferred.type }
        : current,
    );
  }, [savedVehicles]);

  /**
   * Consentement déjà donné : la case revient cochée.
   *
   * On ne saute pas l'étape pour autant. Le rappel « votre position exacte est
   * partagée » mérite d'être relu à chaque demande — c'est le seul écran où on
   * l'annonce — mais relire la politique entière au bord d'une route, non. Une
   * seule tape suffit alors pour passer.
   */
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(CONSENT_KEY).then((stored) => {
      if (!cancelled && stored === 'true') setConsented(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = useCallback((values: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...values }));
  }, []);

  /**
   * Téléversement de la photo, déclenché à la sélection.
   *
   * `pendingPhoto` garde l'URI en cours de traitement : si l'utilisateur
   * change d'image pendant l'envoi, la réponse de la précédente arrive après
   * et écraserait la nouvelle. On ignore alors le résultat périmé.
   */
  const pendingPhoto = useRef<string | null>(null);

  const attachPhoto = useCallback(
    (photoUri: string | null) => {
      pendingPhoto.current = photoUri;

      if (!photoUri) {
        patch({ photoUri: null, photoUrl: null, photoState: 'idle' });
        return;
      }

      patch({ photoUri, photoUrl: null, photoState: 'uploading' });

      void uploadPhoto(photoUri, 'sos').then((result) => {
        if (pendingPhoto.current !== photoUri) return;

        patch({
          photoUrl: result.url,
          photoState: !result.skipped
            ? 'ready'
            : result.reason === 'not_configured'
              ? 'unavailable'
              : 'failed',
        });
      });
    },
    [patch],
  );

  /**
   * Changer de véhicule remet la panne à zéro.
   *
   * Les listes ne se recouvrent pas — « carburateur » n'existe que pour une
   * moto, « circuit pneumatique » que pour un camion. Garder la sélection
   * précédente laisserait une panne invalide pour le véhicule choisi, que le
   * serveur rejetterait à l'envoi, soit deux écrans plus loin.
   */
  const selectVehicle = useCallback((vehicleType: RequestVehicleType) => {
    void Haptics.selectionAsync();
    setDraft((current) =>
      current.vehicleType === vehicleType && current.vehicleId === null
        ? current
        : { ...current, vehicleId: null, vehicleType, problemType: null },
    );
  }, []);

  /**
   * Choix d'un véhicule enregistré.
   *
   * Le genre suit tout seul — c'est tout l'intérêt du raccourci — et la panne
   * n'est remise à zéro que si ce genre change vraiment : passer d'une voiture
   * enregistrée à une autre ne doit pas effacer « batterie ».
   */
  const selectSavedVehicle = useCallback((vehicle: Vehicle) => {
    void Haptics.selectionAsync();
    setDraft((current) =>
      current.vehicleId === vehicle.id
        ? current
        : {
            ...current,
            vehicleId: vehicle.id,
            vehicleType: vehicle.type,
            // Un véhicule enregistré a un genre connu : le libellé libre, qui
            // n'existe que pour « Autre », n'a plus d'objet.
            vehicleLabel: '',
            problemType: current.vehicleType === vehicle.type ? current.problemType : null,
          },
    );
  }, []);

  /**
   * Retour au choix manuel.
   *
   * On emprunte une voiture, on dépanne un proche, on conduit le camion de
   * l'entreprise : le véhicule du jour n'est pas toujours celui du profil. Le
   * genre repart de zéro plutôt que d'hériter de celui du véhicule enregistré,
   * qui serait un choix qu'on n'a pas fait.
   */
  const selectOtherVehicle = useCallback(() => {
    void Haptics.selectionAsync();
    setDraft((current) =>
      current.vehicleId === null
        ? current
        : { ...current, vehicleId: null, vehicleType: null, problemType: null },
    );
  }, []);

  const problems = useMemo(
    () => (draft.vehicleType ? problemsForVehicle(draft.vehicleType) : []),
    [draft.vehicleType],
  );

  const needsVehicleLabel = draft.vehicleType === 'other';
  const needsDescription = draft.problemType === 'other';

  const canContinue =
    draft.vehicleType !== null &&
    draft.problemType !== null &&
    (!needsVehicleLabel || draft.vehicleLabel.trim().length >= 2) &&
    (!needsDescription || draft.description.trim().length >= 3);

  const goBack = useCallback(() => {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((current) => current - 1);
  }, [step, router]);

  const acceptAndContinue = useCallback(() => {
    if (!consented) {
      setConsentTouched(true);
      return;
    }
    void AsyncStorage.setItem(CONSENT_KEY, 'true');
    void Haptics.selectionAsync();
    setStep(2);
  }, [consented]);

  const submit = useCallback(async () => {
    if (!origin || !draft.vehicleType || !draft.problemType) return;

    setSubmitting(true);
    setNotice(null);

    try {
      // Un seul appel réseau : la photo est déjà téléversée (ou déjà connue
      // comme impossible) depuis l'étape 2. Rien ne s'intercale entre l'appui
      // sur « Lancer la recherche » et la création de la demande.
      const response = await createRequest.mutateAsync({
        vehicleType: draft.vehicleType,
        vehicleLabel: needsVehicleLabel ? draft.vehicleLabel.trim() : null,
        problemType: draft.problemType,
        vehicleId: draft.vehicleId,
        description: draft.description.trim(),
        urgency: draft.urgency,
        immobilized: draft.immobilized,
        vulnerablePassengers: draft.vulnerablePassengers,
        photoUrl: draft.photoUrl,
        origin,
        accuracyM,
        sort: 'distance',
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // `replace` et non `push` : revenir en arrière depuis les résultats doit
      // ramener à la carte, pas rouvrir un formulaire déjà envoyé.
      // Le garage ouvert avant la demande, s’il y en avait un, continue son
      // chemin jusqu’aux résultats : c’est là qu’il sera mis en tête. Rien
      // d’autre du parcours n’en dépend — sans lui, l’URL est celle d’avant.
      router.replace(
        preferredGarageId
          ? `/sos/resultats?requestId=${response.request.id}&garage=${preferredGarageId}`
          : `/sos/resultats?requestId=${response.request.id}`,
      );
    } catch (error) {
      setNotice(translateError(error));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  }, [
    origin,
    draft,
    needsVehicleLabel,
    accuracyM,
    createRequest,
    router,
    translateError,
    preferredGarageId,
  ]);

  if (REQUIRE_ACCOUNT && authStatus === 'anonymous') {
    return (
      <AccountGate
        onBack={() => router.back()}
        // `redirect` ramène ici après connexion : quelqu'un en panne qu'on
        // vient d'interrompre par un formulaire ne doit pas avoir à retrouver
        // le bouton SOS tout seul.
        onSignIn={() =>
          router.push(
            `/connexion?redirect=${encodeURIComponent(
              preferredGarageId ? `/sos/declarer?garage=${preferredGarageId}` : '/sos/declarer',
            )}`,
          )
        }
      />
    );
  }

  const titles = [t('sos.service'), t('sos.describeTitle'), t('sos.reviewTitle')];

  // `bottom` autant que `top` sur la zone sûre : les trois étapes se terminent
  // par un pied fixe, et sans l'encoche basse ce pied passe sous la barre de
  // navigation d'Android — le bouton « Commencer » y devient inatteignable.
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ paddingTop: theme.space.sm, paddingBottom: theme.space.lg }}>
          <SosHeader
            title={titles[step - 1] ?? ''}
            step={step}
            totalSteps={TOTAL_STEPS}
            onBack={goBack}
            backLabel={t('sos.back')}
          />
        </View>

        {step === 1 ? (
          <WelcomeStep
            consented={consented}
            showConsentError={consentTouched && !consented}
            onToggleConsent={() => {
              setConsentTouched(true);
              setConsented((current) => !current);
            }}
            onAccept={acceptAndContinue}
            onCancel={() => router.back()}
          />
        ) : step === 2 ? (
          <DescribeStep
            draft={draft}
            problems={problems}
            savedVehicles={savedVehicles}
            locale={locale}
            needsVehicleLabel={needsVehicleLabel}
            needsDescription={needsDescription}
            canContinue={canContinue}
            onPatch={patch}
            onSelectVehicle={selectVehicle}
            onSelectSavedVehicle={selectSavedVehicle}
            onSelectOtherVehicle={selectOtherVehicle}
            onAttachPhoto={attachPhoto}
            onContinue={() => {
              void Haptics.selectionAsync();
              setStep(3);
            }}
          />
        ) : (
          <ReviewStep
            draft={draft}
            savedVehicle={selectedVehicle}
            locale={locale}
            address={address}
            accuracyM={accuracyM}
            hasOrigin={origin !== null}
            locationStatus={locationStatus}
            notice={notice}
            submitting={submitting}
            onEdit={() => setStep(2)}
            onSubmit={() => void submit()}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------ Étape 1 ------------------------------ */

function WelcomeStep({
  consented,
  showConsentError,
  onToggleConsent,
  onAccept,
  onCancel,
}: {
  consented: boolean;
  showConsentError: boolean;
  onToggleConsent: () => void;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  const points: { key: string; icon: (props: IconProps) => ReactNode; title: string; hint: string }[] =
    [
      {
        key: 'position',
        icon: MapPinIcon,
        title: t('sos.pointPosition'),
        hint: t('sos.pointPositionHint'),
      },
      {
        key: 'visible',
        icon: ShieldLockIcon,
        title: t('sos.pointVisible'),
        hint: t('sos.pointVisibleHint'),
      },
      {
        key: 'data',
        icon: ShieldLockIcon,
        title: t('sos.pointData'),
        hint: t('sos.pointDataHint'),
      },
      {
        key: 'single',
        icon: AlertIcon,
        title: t('sos.pointSingle'),
        hint: t('sos.pointSingleHint'),
      },
    ];

  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <SosIllustration />

        <View style={{ padding: theme.space.lg, gap: theme.space.lg }}>
          <View style={{ gap: theme.space.sm }}>
            <Text variant="h1">{t('sos.welcomeTitle')}</Text>
            <Text variant="txt" tone="secondary">
              {t('sos.welcomeLead')}
            </Text>
          </View>

          <View style={{ gap: theme.space.lg }}>
            {points.map((point) => (
              <View
                key={point.key}
                style={{ flexDirection: 'row', gap: theme.space.md, alignItems: 'flex-start' }}
              >
                <View style={{ paddingTop: 1 }}>
                  {point.icon({ color: theme.colors.primary, size: 20 })}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="h2">{point.title}</Text>
                  <Text variant="txt" tone="secondary" style={{ marginTop: 2 }}>
                    {point.hint}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/*
            Avertissement secours. Une app d'assistance routière peut être
            ouverte juste après un accident : ne pas rappeler que ce n'est pas
            un service d'urgence médicale serait une faute, pas une omission.
          */}
          <Banner tone="warning" text={t('sos.emergencyNote')} />
        </View>
      </ScrollView>

      <View
        style={{
          padding: theme.space.lg,
          gap: theme.space.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.rule,
          backgroundColor: theme.colors.background,
        }}
      >
        {/*
          Case à cocher explicite, et non un « en continuant vous acceptez »
          glissé sous le bouton. Le consentement au traitement de données de
          localisation se recueille par un geste, pas par une inférence — et
          il n'est demandé qu'une fois, la case revenant cochée ensuite.
        */}
        <Pressable
          onPress={onToggleConsent}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consented }}
          accessibilityLabel={t('sos.consent')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.md,
            minHeight: MIN_TOUCH_TARGET,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: theme.radius.field,
              borderWidth: consented ? 0 : 1.5,
              borderColor: showConsentError ? theme.colors.primary : theme.colors.muted,
              backgroundColor: consented ? theme.colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {consented ? <CheckIcon color="#FFFFFF" size={14} /> : null}
          </View>

          <Text variant="txt" style={{ flex: 1 }}>
            {t('sos.consent')}
          </Text>
        </Pressable>

        {showConsentError ? (
          <Text variant="txt" tone="primary">
            {t('sos.consentRequired')}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          <Button label={t('sos.cancel')} variant="outline" onPress={onCancel} style={{ flex: 1 }} />
          <Button label={t('sos.start')} onPress={onAccept} style={{ flex: 1.4 }} />
        </View>
      </View>
    </>
  );
}

/* ------------------------------ Étape 2 ------------------------------ */

function DescribeStep({
  draft,
  problems,
  savedVehicles,
  locale,
  needsVehicleLabel,
  needsDescription,
  canContinue,
  onPatch,
  onSelectVehicle,
  onSelectSavedVehicle,
  onSelectOtherVehicle,
  onAttachPhoto,
  onContinue,
}: {
  draft: Draft;
  problems: readonly ProblemType[];
  savedVehicles: readonly Vehicle[];
  locale: Locale;
  needsVehicleLabel: boolean;
  needsDescription: boolean;
  canContinue: boolean;
  onPatch: (values: Partial<Draft>) => void;
  onSelectVehicle: (vehicle: RequestVehicleType) => void;
  onSelectSavedVehicle: (vehicle: Vehicle) => void;
  onSelectOtherVehicle: () => void;
  onAttachPhoto: (uri: string | null) => void;
  onContinue: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          padding: theme.space.lg,
          paddingBottom: theme.space.xxxl,
          gap: theme.space.xxl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: theme.space.md }}>
          <SectionLabel>
            {savedVehicles.length > 0 ? t('sos.vehicle') : t('sos.vehicleType')}
          </SectionLabel>

          {/*
            Les véhicules enregistrés passent devant les tuiles de genre : ils
            sont plus précis — ils portent la plaque — et coûtent une seule
            tape. Les tuiles restent l'issue de secours et ne réapparaissent
            que si l'on choisit « un autre véhicule ».
          */}
          {savedVehicles.length > 0 ? (
            <>
              <Text variant="txt" tone="muted">
                {t('sos.savedVehiclesHint')}
              </Text>

              <SavedVehiclePicker
                vehicles={savedVehicles}
                selectedId={draft.vehicleId}
                onSelect={onSelectSavedVehicle}
                onSelectOther={onSelectOtherVehicle}
              />
            </>
          ) : null}

          {draft.vehicleId === null ? (
            <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
              {REQUEST_VEHICLE_TYPES.map((vehicle) => (
                <VehicleTile
                  key={vehicle}
                  type={vehicle}
                  label={VEHICLE_LABELS[vehicle][locale]}
                  active={draft.vehicleType === vehicle}
                  onPress={() => onSelectVehicle(vehicle)}
                />
              ))}
            </View>
          ) : null}

          {needsVehicleLabel ? (
            <FreeText
              label={t('sos.vehicleOtherLabel')}
              placeholder={t('sos.vehicleOtherPlaceholder')}
              value={draft.vehicleLabel}
              onChangeText={(vehicleLabel) => onPatch({ vehicleLabel })}
              maxLength={VEHICLE_LABEL_MAX}
              autoFocus
            />
          ) : null}
        </View>

        {/*
          Les sections apparaissent au fur et à mesure. Afficher d'emblée des
          puces de panne sans véhicule choisi obligerait à inventer un ordre,
          alors que cet ordre EST l'information — la panne la plus probable
          pour le véhicule sélectionné vient en tête.
        */}
        {draft.vehicleType ? (
          <View style={{ gap: theme.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SectionLabel style={{ flex: 1 }}>{t('sos.problemType')}</SectionLabel>
              <Text variant="numSm" tone="muted">
                {t('sos.autoSort')}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
              {problems.map((problem) => (
                <Chip
                  key={problem}
                  label={PROBLEM_LABELS[problem][locale]}
                  active={draft.problemType === problem}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onPatch({ problemType: problem });
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        {draft.problemType ? (
          <>
            <FreeText
              label={needsDescription ? t('sos.problemOtherLabel') : t('sos.details')}
              placeholder={
                needsDescription ? t('sos.problemOtherPlaceholder') : t('sos.detailsPlaceholder')
              }
              value={draft.description}
              onChangeText={(description) => onPatch({ description })}
              maxLength={500}
              multiline
              // « Autre » ne dit rien au garage : c'est la seule situation où
              // le champ libre devient l'information principale, donc la seule
              // où on ouvre le clavier d'office.
              autoFocus={needsDescription}
            />

            <View style={{ gap: theme.space.sm }}>
              <SectionLabel>{t('sos.photo')}</SectionLabel>
              <Text variant="txt" tone="muted">
                {t('sos.photoOptional')}
              </Text>
              <PhotoField
                uri={draft.photoUri}
                state={draft.photoState}
                onChange={onAttachPhoto}
              />
            </View>

            <View style={{ gap: theme.space.md }}>
              <SectionLabel>{t('sos.urgency')}</SectionLabel>
              <UrgencyPicker
                value={draft.urgency}
                locale={locale}
                onChange={(urgency) => {
                  void Haptics.selectionAsync();
                  onPatch({ urgency });
                }}
              />
            </View>

            <View>
              <ToggleRow
                label={t('sos.immobilized')}
                hint={t('sos.immobilizedHint')}
                value={draft.immobilized}
                onChange={(immobilized) => onPatch({ immobilized })}
              />
              <View style={{ height: 1, backgroundColor: theme.colors.rule }} />
              <ToggleRow
                label={t('sos.vulnerable')}
                hint={t('sos.vulnerableHint')}
                value={draft.vulnerablePassengers}
                onChange={(vulnerablePassengers) => onPatch({ vulnerablePassengers })}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <View
        style={{
          padding: theme.space.lg,
          borderTopWidth: 1,
          borderTopColor: theme.colors.rule,
          backgroundColor: theme.colors.background,
        }}
      >
        <Button label={t('sos.continue')} fullWidth disabled={!canContinue} onPress={onContinue} />
      </View>
    </>
  );
}

/**
 * Niveau d'urgence.
 *
 * Champ absent de la maquette, ajouté parce qu'il change ce que le garage fait
 * de la demande : « danger » désigne quelqu'un arrêté sur une voie rapide et se
 * traite avant tout le reste, « peut attendre » autorise à finir l'intervention
 * en cours. Sans cette distinction, toutes les demandes arrivent avec la même
 * priorité et c'est l'ordre d'arrivée qui décide — au détriment du plus exposé.
 *
 * Trois niveaux, pas cinq : il faut décider en une seconde.
 */
function UrgencyPicker({
  value,
  locale,
  onChange,
}: {
  value: UrgencyLevel;
  locale: Locale;
  onChange: (next: UrgencyLevel) => void;
}) {
  const theme = useTheme();

  // Le rouge est réservé au danger. L'étendre aux trois niveaux le viderait de
  // son sens au moment précis où il doit alerter.
  const activeFill: Record<UrgencyLevel, string> = {
    can_wait: theme.colors.ink,
    blocking: theme.colors.ink,
    danger: theme.colors.primary,
  };

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
      {URGENCY_LEVELS.map((level) => {
        const active = value === level;
        return (
          <Pressable
            key={level}
            onPress={() => onChange(level)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.space.sm,
              backgroundColor: active ? activeFill[level] : theme.colors.surface,
              borderWidth: active ? 0 : 1,
              borderColor: theme.colors.rule,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="smallStrong" numberOfLines={1} tone={active ? 'inverse' : 'ink'}>
              {URGENCY_LABELS[level][locale]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FreeText({
  label,
  placeholder,
  value,
  onChangeText,
  maxLength,
  multiline = false,
  autoFocus = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (next: string) => void;
  maxLength: number;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SectionLabel style={{ flex: 1 }}>{label}</SectionLabel>
        {/* Compteur en mono — c'est une mesure. Il n'apparaît qu'une fois la
            moitié consommée : avant, il ne fait que du bruit. */}
        {value.length > maxLength / 2 ? (
          <Text variant="numSm" tone="muted">
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>

      <TextInput
        allowFontScaling={false}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        maxLength={maxLength}
        multiline={multiline}
        autoFocus={autoFocus}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 84 : MIN_TOUCH_TARGET + 4,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.rule,
          // Rayon 2 px sur les champs, jamais de chamfer : le cahier des
          // charges l'interdit explicitement sur les champs de saisie.
          borderRadius: theme.radius.field,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.md,
          fontFamily: theme.type.body.fontFamily,
          fontSize: theme.type.body.fontSize,
          color: theme.colors.ink,
        }}
      />
    </View>
  );
}

/* ------------------------------ Étape 3 ------------------------------ */

function ReviewStep({
  draft,
  savedVehicle,
  locale,
  address,
  accuracyM,
  hasOrigin,
  locationStatus,
  notice,
  submitting,
  onEdit,
  onSubmit,
}: {
  draft: Draft;
  /** Fiche du véhicule retenu, quand la demande part sur un véhicule enregistré. */
  savedVehicle: Vehicle | null;
  locale: Locale;
  address: string | null;
  accuracyM: number | null;
  hasOrigin: boolean;
  locationStatus: string;
  notice: string | null;
  submitting: boolean;
  onEdit: () => void;
  onSubmit: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  const vehicleText = savedVehicle
    ? vehicleTitle(savedVehicle, locale)
    : draft.vehicleType === 'other'
      ? draft.vehicleLabel.trim()
      : draft.vehicleType
        ? VEHICLE_LABELS[draft.vehicleType][locale]
        : t('sos.none');

  const rows: { label: string; value: string }[] = [
    { label: t('sos.vehicle'), value: vehicleText },
    // La plaque n'apparaît que si elle est connue : c'est ce que le garagiste
    // cherche des yeux en arrivant, et la seule chose qu'un véhicule
    // enregistré apporte et qu'une description à la main n'aurait pas.
    ...(savedVehicle?.plate
      ? [{ label: t('settings.vehiclePlate'), value: savedVehicle.plate.toUpperCase() }]
      : []),
    {
      label: t('sos.problem'),
      value: draft.problemType ? PROBLEM_LABELS[draft.problemType][locale] : t('sos.none'),
    },
    { label: t('sos.urgency'), value: URGENCY_LABELS[draft.urgency][locale] },
    { label: t('sos.immobilized'), value: draft.immobilized ? t('sos.yes') : t('sos.no') },
    { label: t('sos.vulnerable'), value: draft.vulnerablePassengers ? t('sos.yes') : t('sos.no') },
    { label: t('sos.photo'), value: draft.photoUri ? t('sos.yes') : t('sos.no') },
  ];

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          padding: theme.space.lg,
          paddingBottom: theme.space.xxxl,
          gap: theme.space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="txt" tone="secondary">
          {t('sos.reviewLead')}
        </Text>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.rule,
          }}
        >
          {rows.map((row, index) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.md,
                paddingHorizontal: theme.space.lg,
                paddingVertical: theme.space.md,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: theme.colors.rule,
              }}
            >
              <Text variant="txt" tone="secondary" style={{ flex: 1 }}>
                {row.label}
              </Text>
              <Text
                variant="h2"
                numberOfLines={2}
                style={{ flex: 1.4, textAlign: 'right' }}
              >
                {row.value || t('sos.none')}
              </Text>
            </View>
          ))}
        </View>

        {draft.description.trim() ? (
          <View style={{ gap: theme.space.sm }}>
            <SectionLabel>{t('sos.details')}</SectionLabel>
            <Text variant="txt">{draft.description.trim()}</Text>
          </View>
        ) : null}

        <View style={{ gap: theme.space.sm }}>
          <SectionLabel>{t('sos.position')}</SectionLabel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
            <MapPinIcon color={theme.colors.userPositionDeep} />
            <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>
              {address ?? (hasOrigin ? t('map.exactPosition') : t('location.unavailable'))}
            </Text>
            {hasOrigin ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
                <BlinkingDot size={6} />
                <Text variant="numSm" tone="success">
                  ±{accuracyM === null ? '—' : Math.round(accuracyM)}m
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Ni la position manquante ni l'erreur serveur ne sont des cas rares
            ici : sans l'une la demande est impossible, l'autre survient dès
            qu'un invité tente d'envoyer. Les deux se disent en clair. */}
        {!hasOrigin && locationStatus !== 'acquiring' ? (
          <Banner tone="primary" text={t('sos.noPosition')} />
        ) : null}
        {notice ? <Banner tone="warning" text={notice} /> : null}
      </ScrollView>

      <View
        style={{
          padding: theme.space.lg,
          borderTopWidth: 1,
          borderTopColor: theme.colors.rule,
          backgroundColor: theme.colors.background,
        }}
      >
        <View style={{ flexDirection: 'row', gap: theme.space.md, alignItems: 'stretch' }}>
          <Button
            label={t('sos.edit')}
            variant="outline"
            onPress={onEdit}
            disabled={submitting}
            style={{ flex: 1 }}
          />
          <Button
            label={t('sos.submit')}
            loading={submitting}
            disabled={!hasOrigin}
            onPress={onSubmit}
            style={{ flex: 1.7 }}
          />
        </View>
      </View>
    </>
  );
}

function Banner({ tone, text }: { tone: 'primary' | 'warning'; text: string }) {
  const theme = useTheme();
  const color = tone === 'primary' ? theme.colors.primary : theme.colors.warning;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.space.md,
        padding: theme.space.md,
        backgroundColor: `${color}1F`,
        borderLeftWidth: 3,
        borderLeftColor: color,
      }}
    >
      <AlertIcon color={theme.colors.ink} size={18} />
      <Text variant="txt" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/* ------------------------------- Barrière ------------------------------ */

/**
 * Écran opposé à un visiteur sans compte.
 *
 * Il **explique** et il **ouvre une porte**. La version précédente ne faisait
 * ni l'un ni l'autre : elle annonçait qu'un compte était nécessaire et ne
 * proposait que « Retour », ce qui laissait exactement là où on était.
 */
function AccountGate({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.space.xl,
          gap: theme.space.lg,
        }}
      >
        <ShieldLockIcon color={theme.colors.primary} size={36} />

        <Text variant="heading" style={{ textAlign: 'center' }}>
          {t('auth.required')}
        </Text>

        {/* La raison, pas seulement la règle : un garagiste va se déplacer. */}
        <Text variant="txt" tone="secondary" style={{ textAlign: 'center' }}>
          {t('auth.requiredLead')}
        </Text>

        <View style={{ alignSelf: 'stretch', gap: theme.space.md, marginTop: theme.space.md }}>
          <Button label={t('auth.login')} onPress={onSignIn} fullWidth />
          <Button label={t('sos.back')} variant="outline" onPress={onBack} fullWidth />
        </View>
      </View>
    </SafeAreaView>
  );
}
