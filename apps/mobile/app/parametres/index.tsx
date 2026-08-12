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
import { PlateTag } from '../../src/ui/PlateTag';
import { Segmented } from '../../src/ui/Segmented';
import { LinkRow, OptionRow, SettingsCard, SwitchRow } from '../../src/ui/SettingsCard';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Text } from '../../src/ui/Text';
import type { Locale } from '@geocras/shared';

/**
 * Paramètres.
 *
 * Repris de la maquette 10, dont le vocabulaire tient en trois briques et rien
 * d'autre :
 *
 *  - un **sélecteur segmenté** pour les choix exclusifs et courts — le thème ;
 *  - des **cartes à filets** pour tout le reste, intitulé de section au-dessus
 *    avec son trait rouge ;
 *  - des **interrupteurs rectangulaires**, pas des pilules.
 *
 * Ce que la version précédente faisait de travers : elle empilait des puces de
 * filtre pour représenter des choix exclusifs. Une puce dit « je peux en
 * cocher plusieurs », un segment dit « une seule à la fois » — et une page
 * entière de puces, c'est exactement l'écran de réglages générique qu'on trouve
 * dans n'importe quelle application.
 *
 * L'ordre des sections suit la fréquence d'usage réelle : on vient ici pour son
 * véhicule bien plus souvent que pour son thème. Tous les réglages
 * s'appliquent à l'appui — un réglage dont on voit le résultat immédiatement n'a
 * pas besoin d'être validé.
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

  const defaultVehicle =
    vehicles.data?.find((vehicle) => vehicle.isDefault) ?? vehicles.data?.[0] ?? null;

  const vehicleTitle = defaultVehicle
    ? [defaultVehicle.brand, defaultVehicle.model].filter(Boolean).join(' ') ||
      VEHICLE_LABELS[defaultVehicle.type][locale]
    : t('settings.vehiclesNone');

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
          <View style={{ paddingHorizontal: theme.space.lg, gap: theme.space.sm }}>
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

            <Text variant="txt" tone="muted">
              {t('settings.appearanceHint')}
            </Text>
          </View>
        </Section>

        {/* ------------------------------------------------------- véhicules */}
        <Section label={t('settings.vehicles')}>
          <SettingsCard>
            <LinkRow
              label={vehicleTitle}
              hint={t('settings.vehiclesHint')}
              // La plaque, dessinée comme telle : c'est ce qu'on vient
              // vérifier d'un coup d'œil avant de partir.
              value={defaultVehicle?.plate ? <PlateTag plate={defaultVehicle.plate} /> : undefined}
              onPress={() => router.push('/parametres/vehicules' as never)}
            />
          </SettingsCard>
        </Section>

        {/* ---------------------------------------------------- notifications */}
        <Section label={t('settings.notifications')}>
          <SettingsCard>
            <SwitchRow
              label={t('settings.notificationsSystem')}
              hint={
                notifications.granted === true
                  ? t('settings.notificationsOn')
                  : notifications.canAskAgain
                    ? t('settings.notificationsHint')
                    : t('settings.notificationsDeniedHint')
              }
              value={notifications.granted === true}
              onValueChange={toggleNotifications}
            />

            <SwitchRow
              label={t('settings.haptics')}
              hint={t('settings.hapticsHint')}
              value={haptics}
              onValueChange={setHaptics}
            />
          </SettingsCard>

          {/*
            Dit tel quel : l'autorisation se demande maintenant — au calme, pas
            au moment d'une panne — mais l'envoi des alertes n'est pas encore en
            place. Laisser croire le contraire coûterait une attente déçue le
            jour où elle compte.
          */}
          {notifications.granted === true ? (
            <Text
              variant="txt"
              tone="muted"
              style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.sm }}
            >
              {t('settings.notificationsPending')}
            </Text>
          ) : null}
        </Section>

        {/* ---------------------------------------------- rayon de recherche */}
        <Section label={t('settings.search')}>
          <SettingsCard>
            {SEARCH_RADIUS_OPTIONS.map((option: SearchRadiusKm) => (
              <OptionRow
                key={option}
                label={`${option} km`}
                hint={t(
                  option === 5
                    ? 'settings.radiusNear'
                    : option === 15
                      ? 'settings.radiusCity'
                      : 'settings.radiusRoad',
                )}
                selected={searchRadiusKm === option}
                onPress={() => setSearchRadiusKm(option)}
              />
            ))}
          </SettingsCard>

          <Text
            variant="txt"
            tone="muted"
            style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.sm }}
          >
            {t('settings.searchRadiusHint')}
          </Text>
        </Section>

        {/* ---------------------------------------------------------- langue */}
        <Section label={t('settings.language')}>
          <SettingsCard>
            {(['fr', 'en'] as Locale[]).map((option) => (
              <OptionRow
                key={option}
                label={t(option === 'fr' ? 'settings.languageFr' : 'settings.languageEn')}
                selected={locale === option}
                onPress={() => setLocale(option)}
              />
            ))}
          </SettingsCard>
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
 * le seul dessin de l'écran, et il dit en un coup d'œil ce qu'« Auto »
 * signifie — un mot que personne ne lit deux fois mais que tout le monde
 * interprète mal la première.
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
