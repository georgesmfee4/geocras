import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VEHICLE_LABELS } from '@geocras/shared';
import { useVehicles } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { env } from '../../src/config/env';
import { useI18n } from '../../src/i18n/I18nProvider';
import {
  SEARCH_RADIUS_OPTIONS,
  usePreferences,
  type SearchRadiusKm,
} from '../../src/settings/preferences';
import { useNotificationPermission } from '../../src/settings/useNotificationPermission';
import { useTheme, type ThemePreference } from '../../src/theme/ThemeProvider';
import { useOtaUpdate, type OtaState } from '../../src/updates/useOtaUpdate';
import { PlateTag } from '../../src/ui/PlateTag';
import { RadiusPicker } from '../../src/ui/RadiusPicker';
import { Segmented } from '../../src/ui/Segmented';
import { LinkRow, SettingsCard, SwitchRow } from '../../src/ui/SettingsCard';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Text } from '../../src/ui/Text';
import type { Locale } from '@geocras/shared';
import type { TranslationKey } from '../../src/i18n/translations';

/**
 * L'état de la mise à jour, tel qu'il s'écrit dans la colonne de droite.
 *
 * Une table plutôt qu'une cascade de ternaires dans le JSX : le jour où un
 * état s'ajoute au module OTA, TypeScript signale ici la case manquante.
 */
const OTA_LABELS: Record<OtaState, TranslationKey> = {
  disabled: 'settings.updateDisabled',
  idle: 'settings.updateIdle',
  checking: 'settings.updateChecking',
  downloading: 'settings.updateDownloading',
  ready: 'settings.updateReady',
  failed: 'settings.updateFailed',
};

/**
 * Paramètres.
 *
 * Trois formes, et chacune dit ce qu'elle est :
 *
 *  - un **sélecteur segmenté** pour un choix exclusif dont les options tiennent
 *    en un mot — le thème, la langue ;
 *  - des **tuiles dessinées** pour le rayon de recherche, seul réglage de la
 *    page qui décrive quelque chose de l'espace ;
 *  - des **cartes à filets** pour tout le reste, intitulé de section au-dessus
 *    avec son trait rouge.
 *
 * ---
 *
 * **La page a été vidée de son texte, et c'est le sujet de cette révision.**
 *
 * Elle portait six phrases d'explication et deux paragraphes pour douze
 * réglages : « Auto suit le réglage de votre téléphone » sous une pastille
 * déjà coupée en deux pour le dire, « Un quartier — la carte reste lisible en
 * ville » sous une option qui s'appelle 5 km, un paragraphe entier sur le
 * rayon, un autre sur les notifications. Une page de réglages se parcourt des
 * yeux pour trouver un interrupteur ; chaque phrase qu'on y ajoute éloigne
 * celui d'après.
 *
 * Ce qui reste de texte est ce qu'aucun dessin ne peut porter : l'autorisation
 * refusée qu'il faut aller rouvrir dans les réglages du téléphone, et le fait
 * que les alertes d'intervention ne partent pas encore. Les deux sont des
 * informations, pas des commentaires.
 *
 * L'ordre alterne les formes — barre, ligne, dessins, interrupteurs, barre,
 * lignes — pour qu'on repère sa section à sa silhouette avant de lire son
 * intitulé. Tous les réglages s'appliquent à l'appui : un réglage dont on voit
 * le résultat immédiatement n'a pas besoin d'être validé.
 */
export default function ParametresScreen() {
  const theme = useTheme();
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();

  const vehicles = useVehicles(user !== null);
  const searchRadiusKm = usePreferences((state) => state.searchRadiusKm);
  const setSearchRadiusKm = usePreferences((state) => state.setSearchRadiusKm);
  const haptics = usePreferences((state) => state.haptics);
  const setHaptics = usePreferences((state) => state.setHaptics);

  const notifications = useNotificationPermission();

  /**
   * L'interrupteur ne bascule rien lui-même : il demande, et l'état suit la
   * réponse du système.
   *
   * Couper une autorisation déjà accordée est impossible depuis une
   * application — seuls les réglages du téléphone le permettent. L'interrupteur
   * y conduit donc, plutôt que de faire semblant de s'éteindre et de se
   * rallumer tout seul à la relecture suivante.
   */
  const toggleNotifications = (next: boolean): void => {
    if (next) {
      void notifications.request();
      return;
    }
    notifications.openSettings();
  };

  /**
   * Une seule ligne d'aide sous l'interrupteur, et seulement quand elle apprend
   * quelque chose.
   *
   * Autorisées, il reste à dire que rien ne part encore — sans quoi on attend
   * une alerte qui ne viendra pas. Refusées définitivement, il faut dire que
   * l'interrupteur ne peut plus rien et où aller. Entre les deux, l'intitulé et
   * l'interrupteur se suffisent.
   */
  const notificationsHint =
    notifications.granted === true
      ? t('settings.notificationsPending')
      : notifications.canAskAgain
        ? undefined
        : t('settings.notificationsDeniedHint');

  const defaultVehicle =
    vehicles.data?.find((vehicle) => vehicle.isDefault) ?? vehicles.data?.[0] ?? null;

  const vehicleTitle = defaultVehicle
    ? [defaultVehicle.brand, defaultVehicle.model].filter(Boolean).join(' ') ||
      VEHICLE_LABELS[defaultVehicle.type][locale]
    : t('settings.vehiclesNone');

  const ota = useOtaUpdate();

  /**
   * Ce que la ligne fait dépend de ce qu'elle affiche.
   *
   * Prête, elle redémarre ; dans tous les autres cas elle relance une
   * recherche. Deux commandes distinctes auraient demandé deux lignes, ou une
   * ligne et un bouton, pour un réglage qu'on ne touche presque jamais.
   */
  const onUpdatePress = ota.state === 'ready' ? ota.apply : ota.check;

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title={t('settings.title')} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.xl, gap: theme.space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------------------------------- apparence */}
        <Section label={t('settings.appearance')} first>
          <View style={{ paddingHorizontal: theme.space.lg }}>
            <Segmented<ThemePreference>
              value={theme.preference}
              onChange={theme.setPreference}
              options={[
                {
                  value: 'light',
                  label: t('settings.light'),
                  glyph: (color) => <ThemeDot mode="light" color={color} />,
                },
                {
                  value: 'dark',
                  label: t('settings.dark'),
                  glyph: (color) => <ThemeDot mode="dark" color={color} />,
                },
                {
                  value: 'auto',
                  label: t('settings.auto'),
                  glyph: (color) => <ThemeDot mode="auto" color={color} />,
                },
              ]}
            />
          </View>
        </Section>

        {/* ------------------------------------------------------- véhicules */}
        <Section label={t('settings.vehicles')}>
          <SettingsCard>
            <LinkRow
              label={vehicleTitle}
              // La plaque, dessinée comme telle : c'est ce qu'on vient
              // vérifier d'un coup d'œil avant de partir, et elle remplace à
              // elle seule la phrase qui expliquait à quoi sert la ligne.
              value={defaultVehicle?.plate ? <PlateTag plate={defaultVehicle.plate} /> : undefined}
              onPress={() => router.push('/parametres/vehicules' as never)}
            />
          </SettingsCard>
        </Section>

        {/* ---------------------------------------------- rayon de recherche */}
        <Section label={t('settings.search')}>
          <View style={{ paddingHorizontal: theme.space.lg }}>
            <RadiusPicker<SearchRadiusKm>
              options={SEARCH_RADIUS_OPTIONS}
              value={searchRadiusKm}
              onChange={setSearchRadiusKm}
            />
          </View>
        </Section>

        {/* ---------------------------------------------------- notifications */}
        <Section label={t('settings.notifications')}>
          <SettingsCard>
            <SwitchRow
              label={t('settings.notificationsSystem')}
              hint={notificationsHint}
              value={notifications.granted === true}
              onValueChange={toggleNotifications}
            />

            <SwitchRow
              label={t('settings.haptics')}
              value={haptics}
              onValueChange={setHaptics}
            />
          </SettingsCard>
        </Section>

        {/* ---------------------------------------------------------- langue */}
        <Section label={t('settings.language')}>
          <View style={{ paddingHorizontal: theme.space.lg }}>
            {/*
              Segmenté comme le thème, et non plus deux lignes cochables : deux
              options d'un mot chacune, exclusives, sans rien à expliquer —
              c'est la définition même de ce contrôle.
            */}
            <Segmented<Locale>
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'fr', label: t('settings.languageFr') },
                { value: 'en', label: t('settings.languageEn') },
              ]}
            />
          </View>
        </Section>

        {/* -------------------------------------------------------- à propos */}
        <Section label={t('settings.about')}>
          <SettingsCard>
            <LinkRow
              label={t('settings.support')}
              // Un numéro se relit chiffre par chiffre : donnée mesurée, donc mono.
              value={
                <Text variant="numSm" tone="muted">
                  {env.supportPhone}
                </Text>
              }
              onPress={() => void Linking.openURL(`tel:${env.supportPhone}`)}
            />
            <LinkRow
              label={t('settings.privacy')}
              onPress={() => router.push('/confidentialite' as never)}
            />
            <LinkRow
              label={t('settings.terms')}
              onPress={() => router.push('/conditions' as never)}
            />
            <LinkRow
              label={t('settings.update')}
              hint={ota.state === 'ready' ? t('settings.updateReadyHint') : undefined}
              // État de la liaison, donc mono — même famille que le numéro de
              // version deux lignes plus bas, dont il est le complément.
              value={
                <Text variant="numSm" tone="muted">
                  {t(OTA_LABELS[ota.state])}
                </Text>
              }
              onPress={onUpdatePress}
            />
          </SettingsCard>
        </Section>

        {/*
          Numéro de version : donnée mesurée, donc `numSm`. C'est le niveau le
          plus proche de l'ancien `footnote`, à ceci près qu'il n'emporte ni
          les capitales ni l'interlettrage large — le libellé est déjà écrit en
          capitales, l'écart tient au seul espacement.
        */}
        <Text
          variant="numSm"
          tone="muted"
          style={{ textAlign: 'center', paddingTop: theme.space.lg }}
        >
          GEOCRAS V{version}
          {ota.buildId ? ` · ${ota.buildId}` : ''}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Une section : son intitulé au trait rouge, puis son contenu.
 *
 * L'intitulé vit **hors** de la carte, comme sur la maquette. Le mettre dedans
 * aurait fait une ligne d'en-tête de plus dans une liste de lignes, et le trait
 * rouge se serait perdu au milieu des filets.
 */
function Section({
  label,
  children,
  first = false,
}: {
  label: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md, paddingTop: first ? theme.space.xl : 0 }}>
      <View style={{ paddingHorizontal: theme.space.xl }}>
        <SectionLabel>{label}</SectionLabel>
      </View>
      {children}
    </View>
  );
}

/**
 * Pastille de mode d'affichage.
 *
 * Un disque plein pour les deux modes explicites, **coupé en deux** pour
 * l'automatique : la moitié ambrée du jour, la moitié encre de la nuit. C'est
 * lui qui a permis de retirer la phrase « Auto suit le réglage de votre
 * téléphone » — il dit la même chose sans occuper de ligne, et il la dit au
 * moment où l'œil est sur l'option plutôt qu'en dessous.
 *
 * Sur le segment actif, tout passe en blanc : l'ambre sur le rouge tomberait
 * sous le seuil de lisibilité, exactement comme le jaune de position sur fond
 * clair.
 */
function ThemeDot({ mode, color }: { mode: ThemePreference; color: string }) {
  const theme = useTheme();
  const size = 10;

  // `color` vaut blanc quand le segment est actif : la pastille suit alors le
  // libellé plutôt que de garder sa teinte propre.
  const active = color === '#FFFFFF';
  const day = active ? color : theme.colors.userPosition;
  const night = active ? color : theme.colors.ink;

  if (mode === 'auto') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          flexDirection: 'row',
          // Le disque coupé garde un contour quand ses deux moitiés sont de la
          // même couleur — cas du segment actif, où tout est blanc.
          opacity: active ? 0.9 : 1,
        }}
      >
        <View style={{ flex: 1, backgroundColor: day }} />
        <View style={{ flex: 1, backgroundColor: night, opacity: active ? 0.45 : 1 }} />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: mode === 'light' ? day : night,
      }}
    />
  );
}
