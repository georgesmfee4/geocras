import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { sectionRule } from '../theme/tokens';
import { Skeleton } from '../ui/Skeleton';

/** Hauteur du panneau SOS, relevée sur son état le plus courant. */
const SLAB = 228;

/** Hauteur d'une ligne d'engagement, bande d'action comprise. */
const ROW = 110;

/**
 * La forme du poste de travail pendant qu'il arrive.
 *
 * Une roue centrée aurait tenu moins de lignes, mais elle ne dit rien de ce
 * qu'on attend et elle laisse la page sauter au moment où les données
 * tombent — sur un écran où le premier geste est de viser le panneau SOS, un
 * bloc qui se déplace sous le pouce est un vrai défaut.
 *
 * Le squelette reprend donc les largeurs réelles : le panneau à fond perdu, les
 * engagements en retrait. On voit la composition avant de voir les chiffres,
 * ce qui est exactement l'ordre dans lequel on la lira ensuite.
 */
export function DeskSkeleton() {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ gap: theme.space.xl }}
    >
      <Skeleton width="100%" height={SLAB} />

      <View style={{ paddingHorizontal: theme.space.lg, gap: theme.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          {/* Le filet de section, lui, n'est pas en attente : il est peint tout
              de suite. C'est un élément d'identité, pas une donnée. */}
          <View
            style={{
              width: sectionRule.width,
              height: sectionRule.height,
              backgroundColor: theme.colors.primary,
            }}
          />
          <Skeleton width={104} height={11} />
        </View>

        <Skeleton width="100%" height={ROW} />
        <Skeleton width="100%" height={ROW} />
      </View>
    </View>
  );
}
