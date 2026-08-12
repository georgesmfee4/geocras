import { memo, useEffect, useRef, useState } from 'react';
import { Dimensions, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { TIER_DEFINITIONS, type Tier, type TierDefinition } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { ChamferView } from '../ui/ChamferView';
import { CheckIcon, LoyaltyIcon, StarIcon } from '../ui/icons';
import { Text } from '../ui/Text';

/**
 * Largeur d'une carte de grade.
 *
 * Volontairement inférieure à la largeur d'écran : le bord de la carte suivante
 * dépasse, et c'est **ce débord qui dit qu'on peut faire défiler**. Une carte
 * pleine largeur donnerait exactement le même écran qu'un bloc statique, et
 * personne ne balaierait.
 */
const GUTTER = 20;
const PEEK = 34;

function cardWidth(): number {
  return Math.min(320, Dimensions.get('window').width - GUTTER * 2 - PEEK);
}

/**
 * Couleur d'un grade.
 *
 * L'échelle monte du discret vers l'encre en passant par le bronze, le jaune et
 * le rouge : elle se lit dans l'ordre même sans savoir lire les libellés, ce
 * qui est le but d'une échelle. Une seule couleur nouvelle a été ajoutée aux
 * jetons — le bronze ; tout le reste est déjà dans la charte.
 */
export function tierColor(id: Tier, colors: ReturnType<typeof useTheme>['colors']): string {
  switch (id) {
    case 'standard':
      return colors.muted;
    case 'bronze':
      return colors.tierBronze;
    case 'gold':
      return colors.highlight;
    case 'vip':
      return colors.primary;
    case 'vip_platinum':
      return colors.primaryDark;
    case 'vip_diamond':
      return colors.ink;
  }
}

/**
 * Les grades, carte par carte.
 *
 * Le choix du carrousel plutôt que d'une liste empilée n'est pas cosmétique :
 * six grades empilés font une page entière de texte comparatif qu'on parcourt
 * en diagonale. Côte à côte, ils se **comparent** — même gabarit, même
 * emplacement pour le seuil et la remise, donc le regard n'a qu'un chiffre à
 * suivre d'une carte à l'autre.
 *
 * Le bandeau de segments au-dessus reprend la grammaire des statuts : un
 * segment par grade, plein jusqu'à celui qu'on occupe. Il fait deux choses à la
 * fois — dire où l'on se situe dans l'échelle, et où l'on se situe dans le
 * défilement. Rien ne défile tout seul : sur un écran qui explique des règles,
 * un contenu qui s'échappe au bout de trois secondes se relit trois fois.
 */
export const TierCarousel = memo(function TierCarousel({ current }: { current: Tier }) {
  const theme = useTheme();
  const scroller = useRef<ScrollView>(null);
  const width = cardWidth();
  const step = width + theme.space.md;

  const currentIndex = Math.max(
    0,
    TIER_DEFINITIONS.findIndex((tier) => tier.id === current),
  );
  const [visible, setVisible] = useState(currentIndex);

  /**
   * On ouvre sur le grade de l'utilisateur, pas sur le premier.
   *
   * Quelqu'un qui est déjà VIP n'a rien à faire devant la carte « Membre » : sa
   * question est « qu'est-ce qui vient après », et elle se lit à droite de là
   * où il se trouve.
   */
  useEffect(() => {
    if (currentIndex === 0) return;
    const timer = setTimeout(
      () => scroller.current?.scrollTo({ x: currentIndex * step, animated: false }),
      0,
    );
    return () => clearTimeout(timer);
  }, [currentIndex, step]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const index = Math.round(event.nativeEvent.contentOffset.x / step);
    setVisible(Math.min(TIER_DEFINITIONS.length - 1, Math.max(0, index)));
  };

  return (
    <View style={{ gap: theme.space.md }}>
      {/* Segments : plein jusqu'au grade atteint, filet au-delà. */}
      <View
        style={{
          flexDirection: 'row',
          gap: 3,
          paddingHorizontal: GUTTER,
        }}
      >
        {TIER_DEFINITIONS.map((tier, index) => (
          <View
            key={tier.id}
            style={{
              flex: 1,
              height: 3,
              backgroundColor:
                index <= currentIndex ? tierColor(tier.id, theme.colors) : theme.colors.rule,
              // Le segment de la carte affichée est le seul à porter un
              // liseré : sans lui, on saurait où l'on est dans l'échelle mais
              // pas où l'on est dans le défilement.
              opacity: index === visible ? 1 : 0.45,
            }}
          />
        ))}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          gap: theme.space.md,
        }}
      >
        {TIER_DEFINITIONS.map((tier, index) => (
          <TierCard
            key={tier.id}
            tier={tier}
            width={width}
            state={
              index === currentIndex ? 'current' : index < currentIndex ? 'reached' : 'locked'
            }
          />
        ))}
      </ScrollView>
    </View>
  );
});

function TierCard({
  tier,
  width,
  state,
}: {
  tier: TierDefinition;
  width: number;
  state: 'reached' | 'current' | 'locked';
}) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  const color = tierColor(tier.id, theme.colors);
  const Icon = state === 'reached' ? CheckIcon : state === 'current' ? StarIcon : LoyaltyIcon;

  return (
    <View
      style={{
        width,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        // Le grade occupé est cerné de sa propre couleur : c'est le seul repère
        // dont on a besoin en revenant sur l'écran.
        borderColor: state === 'current' ? color : theme.colors.rule,
        borderLeftWidth: 3,
        borderLeftColor: color,
        padding: theme.space.lg,
        gap: theme.space.md,
        // Un grade non atteint reste parfaitement lisible : il est le but, pas
        // un élément désactivé. On le retire seulement du premier plan.
        opacity: state === 'locked' ? 0.72 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        {/* L'angle coupé appartient aux badges de fidélité — c'est écrit dans la charte. */}
        <ChamferView
          fill={color}
          style={{ width: 44, height: 44 }}
          contentStyle={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon color={tier.id === 'gold' ? theme.colors.onHighlight : '#FFFFFF'} size={20} />
        </ChamferView>

        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>
            {tier.label[locale]}
          </Text>
          <Text variant="numSm" tone="muted">
            {t(
              state === 'current'
                ? 'loyalty.stateCurrent'
                : state === 'reached'
                  ? 'loyalty.stateReached'
                  : 'loyalty.stateLocked',
            )}
          </Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: theme.colors.rule }} />

      <View style={{ gap: theme.space.sm }}>
        <Row
          label={t('loyalty.condition')}
          value={
            tier.threshold === 0
              ? t('loyalty.fromStart')
              : `${tier.threshold} ${t(
                  tier.threshold === 1 ? 'loyalty.repairOne' : 'loyalty.repairMany',
                )}`
          }
        />
        <Row
          label={t('loyalty.discount')}
          value={tier.discountPct === 0 ? '—' : `−${tier.discountPct} %`}
          strong={tier.discountPct > 0}
        />
      </View>
    </View>
  );
}

/** Une ligne « intitulé → valeur », la valeur toujours en mono : c'est une mesure. */
function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space.md,
      }}
    >
      <Text variant="txt" tone="secondary" style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text variant={strong ? 'monoStrong' : 'mono'} tone={strong ? 'ink' : 'secondary'}>
        {value}
      </Text>
    </View>
  );
}
