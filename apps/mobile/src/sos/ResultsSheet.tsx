import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import type { GarageSummary } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { chromeShadow, MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChevronRightIcon } from '../ui/icons';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';
import { GarageResultRow } from './GarageResultRow';
import { PinnedGarageNotice } from './PinnedGarageNotice';

/**
 * Hauteur visible au repos, hors barre système.
 *
 * Calée pour montrer l'en-tête, la première ligne entière et l'amorce de la
 * suivante : c'est cette amorce coupée qui dit qu'il y a une liste, sans quoi
 * personne ne pense à tirer la feuille.
 */
export const SHEET_PEEK_HEIGHT = 268;

/** Part de l'écran occupée par la feuille déployée. */
const EXPANDED_RATIO = 0.74;

/** Plafond absolu : au-delà, la carte n'est plus qu'un bandeau inutile. */
const EXPANDED_MAX = 640;

export type ResultsSheetProps = {
  garages: GarageSummary[];
  /** Libellé du tri actif, repris de la puce sélectionnée. */
  sortLabel: string;
  selectedId: string | null;
  /** Garage dont l'itinéraire est tracé sur la carte, s'il y en a un. */
  routedId: string | null;
  /**
   * Garage demandé depuis sa fiche, remonté en tête de liste.
   *
   * La feuille se contente de le désigner : le classement, lui, est fait par
   * l’écran, qui est déjà le seul endroit où l’ordre affiché se décide.
   */
  pinnedId: string | null;
  /** Rappel jaune affiché au-dessus de la ligne épinglée. */
  showPinnedNotice: boolean;
  onDismissPinnedNotice: () => void;
  safeAreaBottom: number;
  onSelect: (garage: GarageSummary) => void;
  onDetails: (garage: GarageSummary) => void;
  onRoute: (garage: GarageSummary) => void;
  onSos: (garage: GarageSummary) => void;
  /**
   * Hauteur réellement occupée à l'écran.
   *
   * Elle alimente le rembourrage de la caméra et la position des bandeaux :
   * une constante devinée ferait atterrir un garage sélectionné derrière la
   * feuille sur tout appareil qui ne fait pas la taille de la maquette.
   */
  onHeightChange: (height: number) => void;
};

type Snap = 'peek' | 'full';

export type ResultsSheetRef = {
  /**
   * Ramène la feuille à son cran bas.
   *
   * Appelé quand l’écran a quelque chose à montrer **sur la carte** — le tracé
   * d’un itinéraire. Sans ça, on répond à « montre-moi le trajet » par un
   * trajet caché sous la feuille déployée.
   */
  collapse: () => void;
};

/**
 * Feuille des résultats.
 *
 * Elle liste les mêmes garages que la carte, **dans l'ordre du tri actif** :
 * les deux vues montrent le même classement, et le numéro d'une ligne est
 * celui de son écusson. Toucher un écusson fait défiler la liste jusqu'à sa
 * ligne, toucher une ligne recentre la carte — c'est la même sélection, vue de
 * deux endroits.
 *
 * Le geste de glissement est capté **par l'en-tête seul**, pas par la feuille
 * entière : posé sur la liste, il entrerait en concurrence avec le défilement,
 * et une liste qui referme la feuille au lieu de défiler est le défaut le plus
 * commun des feuilles du bas maison. L'en-tête reste par ailleurs cliquable —
 * le panneau ne se déclenche qu'au-delà de quatre points de déplacement.
 */
export const ResultsSheet = forwardRef<ResultsSheetRef, ResultsSheetProps>(function ResultsSheet(
  {
    garages,
    sortLabel,
    selectedId,
    routedId,
    pinnedId,
    showPinnedNotice,
    onDismissPinnedNotice,
    safeAreaBottom,
    onSelect,
    onDetails,
    onRoute,
    onSos,
    onHeightChange,
  },
  ref,
) {
  const theme = useTheme();
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  const collapsed = SHEET_PEEK_HEIGHT + safeAreaBottom;
  const expanded = Math.max(
    collapsed + 80,
    Math.min(windowHeight * EXPANDED_RATIO, EXPANDED_MAX + safeAreaBottom),
  );
  const delta = expanded - collapsed;

  const [full, setFull] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  /** Ordonnée de chaque ligne dans la liste, pour pouvoir l'amener à l'écran. */
  const rowOffsets = useRef<Record<string, number>>({});

  /**
   * Décalage vertical de la feuille : 0 déployée, `delta` au repos.
   *
   * On translate une feuille de hauteur fixe au lieu d'animer sa hauteur —
   * `transform` part sur le pilote natif, `height` non, et la différence se
   * voit immédiatement sur un Android d'entrée de gamme.
   */
  const offset = useRef(new Animated.Value(expanded)).current;
  const snap = useRef<Snap>('peek');

  // Les valeurs vivantes sont lues par le `PanResponder`, créé une seule fois :
  // sans ces refs, il capturerait les valeurs du premier rendu et calculerait
  // ses bornes avec la hauteur d'écran d'avant la rotation.
  const deltaRef = useRef(delta);
  deltaRef.current = delta;

  const settle = useCallback(
    (target: Snap) => {
      snap.current = target;
      setFull(target === 'full');
      onHeightChange(target === 'full' ? expanded : collapsed);

      Animated.spring(offset, {
        toValue: target === 'full' ? 0 : deltaRef.current,
        useNativeDriver: true,
        damping: 22,
        stiffness: 210,
        mass: 0.9,
      }).start();
    },
    [collapsed, expanded, offset, onHeightChange],
  );

  const settleRef = useRef(settle);
  settleRef.current = settle;

  useImperativeHandle(ref, () => ({ collapse: () => settleRef.current('peek') }), []);

  /** Entrée par le bas, une seule fois, quand les garages arrivent. */
  const entered = useRef(false);

  useEffect(() => {
    if (entered.current) return;
    entered.current = true;
    onHeightChange(collapsed);

    if (reducedMotion) {
      offset.setValue(deltaRef.current);
      return;
    }

    Animated.spring(offset, {
      toValue: deltaRef.current,
      useNativeDriver: true,
      damping: 24,
      stiffness: 170,
      mass: 1,
    }).start();
  }, [collapsed, offset, onHeightChange, reducedMotion]);

  /**
   * Rotation ou changement de zone sûre : on se recale sur le cran courant.
   *
   * La garde sur la valeur précédente n'est pas décorative : cet effet se
   * déclenche aussi au montage, juste après celui de l'entrée, et sans elle il
   * poserait la feuille à sa place finale au premier rendu — l'animation
   * d'arrivée serait écrite puis effacée dans la même frame.
   */
  const appliedDelta = useRef(delta);

  useEffect(() => {
    if (!entered.current || appliedDelta.current === delta) return;
    appliedDelta.current = delta;

    offset.setValue(snap.current === 'full' ? 0 : delta);
    onHeightChange(snap.current === 'full' ? expanded : collapsed);
  }, [delta, collapsed, expanded, offset, onHeightChange]);

  /**
   * Sélection venue de la carte : la ligne correspondante doit être visible.
   *
   * Sans ça, toucher l'écusson n° 7 met en évidence une ligne qui se trouve
   * hors du cadre, et la feuille a l'air de n'avoir rien fait.
   */
  useEffect(() => {
    if (!selectedId) return;
    const y = rowOffsets.current[selectedId];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: true });
  }, [selectedId]);

  const pan = useRef(
    PanResponder.create({
      // Seuil de quatre points : en dessous, un appui un peu tremblant sur
      // l'en-tête serait pris pour un glissement et mangerait le clic.
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderMove: (_event, gesture) => {
        const base = snap.current === 'full' ? 0 : deltaRef.current;
        const next = Math.min(Math.max(base + gesture.dy, 0), deltaRef.current);
        offset.setValue(next);
      },
      onPanResponderRelease: (_event, gesture) => {
        const base = snap.current === 'full' ? 0 : deltaRef.current;
        const position = base + gesture.dy;

        // Un geste franc l'emporte sur la position : lancer la feuille vers le
        // haut doit la déployer même si le doigt s'est arrêté à mi-course.
        const target: Snap =
          gesture.vy < -0.5
            ? 'full'
            : gesture.vy > 0.5
              ? 'peek'
              : position < deltaRef.current / 2
                ? 'full'
                : 'peek';

        settleRef.current(target);
      },
    }),
  ).current;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: expanded,
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: theme.radius.sheet,
        borderTopRightRadius: theme.radius.sheet,
        shadowColor: theme.colors.shadow,
        ...chromeShadow,
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 12,
        transform: [{ translateY: offset }],
      }}
    >
      <View {...pan.panHandlers}>
        <Pressable
          onPress={() => settle(snap.current === 'full' ? 'peek' : 'full')}
          accessibilityRole="button"
          accessibilityLabel={t(full ? 'results.collapseList' : 'results.expandList')}
          accessibilityState={{ expanded: full }}
        >
          <View style={{ alignItems: 'center', paddingVertical: theme.space.md }}>
            <View style={{ width: 34, height: 3, backgroundColor: theme.colors.rule }} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
              paddingHorizontal: theme.space.lg,
              paddingBottom: theme.space.md,
            }}
          >
            <SectionLabel>{t('results.sheetTitle')}</SectionLabel>

            <View style={{ flex: 1 }} />

            {/* Le décompte et le tri sont la légende de la liste : ils disent
                sur quoi porte ce qu'on lit juste en dessous. Le nombre est en
                mono, c'est une mesure. */}
            <Text variant="num">{garages.length}</Text>
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {t('results.sortedBy')} {sortLabel.toLowerCase()}
            </Text>

            <View
              style={{
                width: MIN_TOUCH_TARGET - theme.space.md,
                height: MIN_TOUCH_TARGET - theme.space.md,
                alignItems: 'center',
                justifyContent: 'center',
                // Le chevron pointe vers le geste à faire : vers le haut au
                // repos, vers le bas une fois la feuille déployée.
                transform: [{ rotate: full ? '90deg' : '-90deg' }],
              }}
            >
              <ChevronRightIcon color={theme.colors.inkSecondary} size={16} />
            </View>
          </View>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: theme.space.xl + safeAreaBottom,
          gap: theme.space.md,
        }}
      >
        {garages.map((garage) => (
          <View
            key={garage.id}
            onLayout={(event) => {
              rowOffsets.current[garage.id] = event.nativeEvent.layout.y;
            }}
          >
            {/* Le rappel voyage avec la ligne qu’il désigne : il défile avec
                elle plutôt que de rester collé en haut de la feuille à
                pointer vers le vide. */}
            {showPinnedNotice && garage.id === pinnedId ? (
              <PinnedGarageNotice pointing onDismiss={onDismissPinnedNotice} />
            ) : null}

            <GarageResultRow
              garage={garage}
              selected={garage.id === selectedId}
              routed={garage.id === routedId}
              pinned={garage.id === pinnedId}
              onPress={() => onSelect(garage)}
              onDetails={() => onDetails(garage)}
              onRoute={() => onRoute(garage)}
              onSos={() => onSos(garage)}
            />
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
