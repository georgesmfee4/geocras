import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useMyGarage } from '../../../src/api/hooks';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useI18n } from '../../../src/i18n/I18nProvider';
import { useJobFeed } from '../../../src/realtime/useJobFeed';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { tabBarHeight, tabIndicator, MIN_TOUCH_TARGET } from '../../../src/theme/tokens';
import {
  DrivingTabIcon,
  JobsTabIcon,
  MapTabIcon,
  type TabIconProps,
} from '../../../src/ui/icons';
import { ChamferView } from '../../../src/ui/ChamferView';
import { Text } from '../../../src/ui/Text';
import type { TranslationKey } from '../../../src/i18n/translations';

const LABELS: Record<string, TranslationKey> = {
  carte: 'tab.map',
  conduite: 'tab.driving',
  interventions: 'tab.jobs',
};

/**
 * Pictogramme de chaque onglet.
 *
 * Le libellé seul obligeait à lire pour s'orienter ; l'icône se reconnaît de
 * loin et en plein soleil, ce qui est la condition d'usage du produit. Les deux
 * restent affichés : un pictogramme sans texte se devine, il ne se lit pas.
 */
const ICONS: Record<string, (props: TabIconProps) => React.ReactNode> = {
  carte: MapTabIcon,
  conduite: DrivingTabIcon,
  interventions: JobsTabIcon,
};

export default function TabsLayout() {
  const { role } = useAuth();

  /**
   * Garage rattaché au compte.
   *
   * Interrogé seulement pour un compte déjà promu : c'est la seule situation
   * où la réponse peut changer quelque chose à cette barre.
   */
  const garage = useMyGarage(role === 'garage_owner');

  /**
   * Onglet Interventions : réservé au garage **vérifié**.
   *
   * Le rôle passe à `garage_owner` dès l'envoi du dossier — il faut bien que
   * « Mon garage » devienne accessible pour suivre la vérification. Mais le
   * garage, lui, reste inactif et n'apparaît dans aucune recherche tant que
   * GeoCras ne l'a pas contrôlé : ouvrir l'onglet à ce moment-là promettait un
   * flux d'interventions qui ne pouvait pas arriver, et laissait croire que
   * l'inscription était acquise.
   *
   * Tant que la réponse n'est pas là — premier démarrage, réseau muet —
   * l'onglet reste masqué. C'est le défaut sûr : un onglet qui apparaît une
   * seconde après le chargement se remarque à peine, un onglet vide qui promet
   * du travail se remarque beaucoup.
   */
  const verifiedOwner =
    role === 'garage_owner' && (garage.data?.garage?.verifiedAt ?? null) !== null;

  /**
   * Abonnement aux SOS, tenu **ici** et pas dans l'écran Interventions.
   *
   * Un garagiste ne passe pas sa journée sur son onglet de travail : il
   * consulte la carte, il roule. Abonner l'écran l'aurait rendu sourd partout
   * ailleurs — et le seul message qui compte, le SOS qui arrive, serait celui
   * qu'il aurait manqué. La barre d'onglets, elle, est montée tant qu'il est
   * dans l'app.
   *
   * Un seul abonné dans tout l'arbre : deux monteraient deux écouteurs sur le
   * même socket, donc deux vibrations pour une demande.
   */
  const jobs = useJobFeed(verifiedOwner);
  const waiting = jobs.data?.incoming.length ?? 0;

  return (
    <Tabs
      tabBar={(props) => <GeoCrasTabBar {...props} badges={{ interventions: waiting }} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="carte" />
      <Tabs.Screen name="conduite" />
      {/*
        Le troisième onglet n'existe que pour un garagiste dont le dossier est
        vérifié. `href: null` le retire de la barre sans démonter la route : un
        lien profond vers une intervention reste donc valide même pour un
        client.
      */}
      <Tabs.Screen name="interventions" options={{ href: verifiedOwner ? undefined : null }} />
    </Tabs>
  );
}

/**
 * Barre d'onglets conforme à la maquette 01.
 *
 * Hauteur 82 px safe area comprise, fond chaud avec filet haut, libellés en
 * majuscules 10 px poids 700, et surtout le **trait rouge de 26 × 2,5 px collé
 * au bord haut de la barre**, centré sur l'onglet actif — c'est ce détail qui
 * distingue la barre d'un composant par défaut.
 */
function GeoCrasTabBar({
  state,
  descriptors,
  navigation,
  badges = {},
}: BottomTabBarProps & { badges?: Record<string, number> }) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  // expo-router **consomme** le raccourci `href` : il le retire des options et
  // le traduit en `tabBarItemStyle: { display: 'none' }`. Chercher `href` ici
  // ne trouverait donc jamais rien, et l'onglet garagiste s'afficherait pour
  // tout le monde. On lit le signal qu'expo-router laisse réellement derrière
  // lui, ce qui garde ce filtre synchrone avec le `href` du layout.
  const visibleRoutes = state.routes.filter((route) => {
    const itemStyle = descriptors[route.key]?.options.tabBarItemStyle as
      | { display?: string }
      | undefined;
    return itemStyle?.display !== 'none';
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        height: tabBarHeight + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.rule,
      }}
    >
      {visibleRoutes.map((route) => {
        const isFocused = state.routes[state.index]?.key === route.key;
        const labelKey = LABELS[route.name];
        const Icon = ICONS[route.name];
        const tint = isFocused ? theme.colors.primary : theme.colors.tabInactive;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={labelKey ? t(labelKey) : route.name}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              // Resserré : l'icône et son libellé forment un seul bloc. Le pas
              // précédent séparait deux éléments qui n'ont plus rien entre eux.
              gap: theme.space.xs,
            }}
          >
            {isFocused ? (
              <View
                style={{
                  position: 'absolute',
                  // -1 pour couvrir le filet haut : le trait doit être collé au
                  // bord, pas posé en dessous.
                  top: -1,
                  width: tabIndicator.width,
                  height: tabIndicator.height,
                  backgroundColor: theme.colors.primary,
                }}
              />
            ) : null}

            {/*
              Le pictogramme porte son compteur : la pastille est positionnée
              par rapport à LUI, pas par rapport à l'onglet. Ancrée sur
              l'onglet, elle se serait décalée avec la largeur du libellé — donc
              différemment d'une langue à l'autre.
            */}
            <View>
              {Icon ? Icon({ color: tint, size: 23, active: isFocused }) : null}

              {/*
                Compteur de demandes en attente.

                Un SOS arrive pendant qu'on regarde la carte : sans ce chiffre,
                rien à l'écran ne dirait qu'il faut changer d'onglet. Chamfré et
                en mono, comme tous les badges chiffrés du produit — et masqué à
                zéro, parce qu'une pastille vide se lit comme une notification
                qu'on n'arrive pas à ouvrir.
              */}
              {(badges[route.name] ?? 0) > 0 ? (
                <ChamferView
                  fill={theme.colors.primary}
                  style={{ position: 'absolute', top: -7, left: 13 }}
                  contentStyle={{
                    minWidth: 17,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="numSm" tone="inverse">
                    {badges[route.name]}
                  </Text>
                </ChamferView>
              ) : null}
            </View>

            <Text
              variant="tab"
              style={{ color: isFocused ? theme.colors.primary : theme.colors.tabInactive }}
            >
              {labelKey ? t(labelKey) : route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
