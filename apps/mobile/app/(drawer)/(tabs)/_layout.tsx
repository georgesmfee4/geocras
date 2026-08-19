import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useMyGarage } from '../../../src/api/hooks';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useI18n } from '../../../src/i18n/I18nProvider';
import { useJobFeed } from '../../../src/realtime/useJobFeed';
import { useDrivingStore } from '../../../src/stores/driving';
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
import { useReducedMotion } from '../../../src/ui/useReducedMotion';
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
const ICONS: Record<string, (props: TabIconProps) => ReactNode> = {
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

  /**
   * Session de conduite en cours : la barre d'onglets se retire.
   *
   * Le cahier de reprise l'impose en une phrase — « rien de tapotable pendant
   * la conduite sauf Pause et Stop » — et la maquette de l'état actif ne montre
   * effectivement aucune barre : sa place est prise par les contrôles de
   * session. Trois cibles de navigation posées sous le pouce, à portée d'un
   * geste réflexe, sont exactement ce qu'on ne veut pas à 60 km/h.
   *
   * La pause ne la ramène pas non plus. Une barre qui réapparaît fait remonter
   * tout l'écran de quatre-vingts points au moment précis où le conducteur
   * s'arrête à un feu et cherche son bouton Stop du regard. Le mode conduite se
   * quitte par Stop, et par lui seul : c'est un mode, pas un onglet parmi
   * d'autres, tant qu'il tourne.
   */
  const driving = useDrivingStore((state) => state.phase !== 'idle');

  return (
    <Tabs
      tabBar={(props) =>
        driving ? null : <GeoCrasTabBar {...props} badges={{ interventions: waiting }} />
      }
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
 * Hauteur du halo posé sous le trait de l'onglet actif.
 *
 * Il s'éteint aux deux tiers de la barre : plus bas, il touche les libellés et
 * la colonne devient une pastille de fond ; plus haut, on ne voit plus qu'une
 * bavure sous le trait.
 */
const TAB_GLOW = 52;

/**
 * Barre d'onglets GeoCras.
 *
 * Le trait rouge de 26 × 2,5 px collé au bord haut reste la signature — c'est
 * lui qui distingue la barre d'un composant par défaut. Ce qui change, c'est
 * qu'il **ne se téléporte plus** : il glisse d'un onglet à l'autre sur un
 * ressort, et emmène avec lui un halo de teinte primaire qui s'éteint vers le
 * bas.
 *
 * Ce n'est pas de l'ornement. Un indicateur qui saute n'est qu'un état de plus
 * à constater ; un indicateur qui se déplace **relie** l'onglet qu'on quitte à
 * celui qu'on ouvre, et c'est exactement l'information dont on a besoin dans
 * une app où l'on passe sa journée à faire l'aller-retour entre la carte et sa
 * file de travail.
 *
 * Le halo va de `primaryTint` au fond de page, jamais vers « transparent » : un
 * dégradé qui s'éteint dans le vide s'assombrit d'un gris au passage sur iOS,
 * et ce gris trahirait le parti pris du blanc chaud sur toute la largeur de
 * l'onglet actif.
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
  const reducedMotion = useReducedMotion();

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

  const focusedKey = state.routes[state.index]?.key;
  const activeIndex = visibleRoutes.findIndex((route) => route.key === focusedKey);

  /**
   * Largeur d'un onglet, mesurée et non calculée d'avance.
   *
   * Elle change à deux moments qu'aucune constante ne pourrait prévoir : quand
   * le dossier d'un garagiste est vérifié et qu'un troisième onglet apparaît,
   * et sur les appareils dont la barre système ne fait pas la même largeur
   * qu'ailleurs.
   */
  const [barWidth, setBarWidth] = useState(0);
  const itemWidth = visibleRoutes.length > 0 ? barWidth / visibleRoutes.length : 0;

  const slide = useRef(new Animated.Value(0)).current;
  /** Le premier placement se pose, il ne s'anime pas : rien n'a été quitté. */
  const placed = useRef(false);

  useEffect(() => {
    if (itemWidth === 0 || activeIndex < 0) return;
    const target = activeIndex * itemWidth;

    if (!placed.current || reducedMotion) {
      placed.current = true;
      slide.setValue(target);
      return;
    }

    const glide = Animated.spring(slide, {
      toValue: target,
      useNativeDriver: true,
      stiffness: 260,
      damping: 28,
      mass: 0.9,
    });
    glide.start();
    return () => glide.stop();
  }, [activeIndex, itemWidth, reducedMotion, slide]);

  return (
    <View
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        height: tabBarHeight + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.rule,
      }}
    >
      {itemWidth > 0 && activeIndex >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: itemWidth,
            height: tabBarHeight,
            alignItems: 'center',
            transform: [{ translateX: slide }],
          }}
        >
          <LinearGradient
            colors={[theme.colors.primaryTint, theme.colors.background]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TAB_GLOW }}
          />
          {/* −1 pour couvrir le filet haut : le trait doit être collé au bord,
              pas posé en dessous. */}
          <View
            style={{
              marginTop: -1,
              width: tabIndicator.width,
              height: tabIndicator.height,
              backgroundColor: theme.colors.primary,
            }}
          />
        </Animated.View>
      ) : null}

      {visibleRoutes.map((route) => {
        const isFocused = focusedKey === route.key;
        const labelKey = LABELS[route.name];
        const Icon = ICONS[route.name];

        return (
          <TabItem
            key={route.key}
            focused={isFocused}
            label={labelKey ? t(labelKey) : route.name}
            badge={badges[route.name] ?? 0}
            badgeUnit={t('jobs.queueLabel')}
            icon={Icon}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (isFocused || event.defaultPrevented) return;

              /*
                Un cran de vibration au changement d'onglet, et seulement là.
                Le téléphone d'un garagiste est souvent posé sur un établi, dans
                le bruit : le retour tactile confirme le geste quand le retour
                visuel arrive une fraction de seconde plus tard, le temps que
                l'écran suivant se monte. Rien sur un ré-appui de l'onglet
                courant — il ne se passe rien, il ne doit rien se sentir.
              */
              void Haptics.selectionAsync();
              navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * Un onglet.
 *
 * Composant à part parce qu'il tient **ses propres** valeurs animées : l'appui
 * et l'apparition de la pastille. Les mutualiser dans la barre aurait obligé à
 * indexer trois ressorts par nom de route, pour le même résultat en moins
 * lisible.
 */
function TabItem({
  focused,
  label,
  badge,
  badgeUnit,
  icon: Icon,
  onPress,
}: {
  focused: boolean;
  label: string;
  /** Demandes en attente. Zéro n'affiche rien. */
  badge: number;
  /** Ce que le nombre compte, pour le lecteur d'écran. */
  badgeUnit: string;
  icon: ((props: TabIconProps) => ReactNode) | undefined;
  onPress: () => void;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  const press = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const hasBadge = badge > 0;

  useEffect(() => {
    if (!hasBadge) return;

    if (reducedMotion) {
      pop.setValue(1);
      return;
    }

    const entrance = Animated.spring(pop, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 380,
      damping: 14,
      mass: 0.6,
    });
    entrance.start();
    return () => entrance.stop();
  }, [hasBadge, pop, reducedMotion]);

  const springPress = (toValue: number) => {
    if (reducedMotion) return;
    Animated.spring(press, {
      toValue,
      useNativeDriver: true,
      stiffness: 420,
      damping: 22,
      mass: 0.5,
    }).start();
  };

  const tint = focused ? theme.colors.primary : theme.colors.tabInactive;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={hasBadge ? `${label}, ${badge} ${badgeUnit}` : label}
      onPress={onPress}
      onPressIn={() => springPress(0.9)}
      onPressOut={() => springPress(1)}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        // Resserré : l'icône et son libellé forment un seul bloc.
        gap: theme.space.xs,
        opacity: pressed && reducedMotion ? 0.6 : 1,
      })}
    >
      {/*
        Le pictogramme porte son compteur : la pastille est positionnée par
        rapport à LUI, pas par rapport à l'onglet. Ancrée sur l'onglet, elle se
        serait décalée avec la largeur du libellé — donc différemment d'une
        langue à l'autre.
      */}
      <Animated.View style={{ transform: [{ scale: press }] }}>
        {Icon ? Icon({ color: tint, size: 23, active: focused }) : null}

        {/*
          Compteur de demandes en attente.

          Un SOS arrive pendant qu'on regarde la carte : sans ce chiffre, rien à
          l'écran ne dirait qu'il faut changer d'onglet. Il entre au ressort —
          une pastille qui se pose sans bruit sur une icône qu'on ne regardait
          pas ne se remarque pas davantage qu'un chiffre qui change.

          Chamfré et en mono, comme tous les badges chiffrés du produit, et
          masqué à zéro : une pastille vide se lit comme une notification qu'on
          n'arrive pas à ouvrir.
        */}
        {hasBadge ? (
          <Animated.View
            style={{
              position: 'absolute',
              top: -7,
              left: 13,
              opacity: pop,
              transform: [{ scale: pop }],
            }}
          >
            <ChamferView
              fill={theme.colors.primary}
              contentStyle={{
                minWidth: 17,
                paddingHorizontal: 4,
                paddingVertical: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="numSm" tone="inverse">
                {badge}
              </Text>
            </ChamferView>
          </Animated.View>
        ) : null}
      </Animated.View>

      <Text variant="tab" style={{ color: tint }}>
        {label}
      </Text>
    </Pressable>
  );
}
