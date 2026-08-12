import { useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChevronRightSmallIcon } from './icons';
import { SectionLabel } from './SectionLabel';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

/**
 * Section dépliable.
 *
 * Elle existe pour une raison précise : les règles d'un programme de fidélité
 * tiennent en trois paragraphes que personne ne lit deux fois. Les laisser
 * ouverts pousserait vers le bas ce qu'on vient réellement consulter — le
 * solde et le grade — sous un mur de texte parcouru une seule fois dans la vie
 * du compte.
 *
 * L'intitulé garde son filet rouge : replié ou déplié, c'est un intitulé de
 * section comme les autres, et l'identité ne s'interrompt pas parce qu'un bloc
 * est fermé. Le chevron pivote d'un quart de tour — c'est le seul mouvement, et
 * il est coupé si le système demande de réduire les animations.
 *
 * Le contenu n'est pas monté tant qu'il est replié : une section fermée ne doit
 * rien coûter, ni en rendu ni en requêtes.
 */
export function Accordion({
  title,
  /** Valeur résumée affichée à droite quand la section est fermée — un solde, un code. */
  summary,
  defaultOpen = false,
  onToggle,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  /**
   * Notifie l'ouverture, pour que l'appelant ne charge sa donnée qu'à ce
   * moment-là. C'est ce qui permet à une section « historique » de ne rien
   * coûter tant qu'on ne l'ouvre pas.
   */
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const spin = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    onToggle?.(next);

    if (reducedMotion) {
      spin.setValue(next ? 1 : 0);
      return;
    }

    Animated.timing(spin, {
      toValue: next ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.colors.rule,
      }}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
          minHeight: MIN_TOUCH_TARGET + 6,
          paddingVertical: theme.space.md,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <SectionLabel>{title}</SectionLabel>
        </View>

        {summary && !open ? (
          <Text variant="numSm" tone="muted">
            {summary}
          </Text>
        ) : null}

        <Animated.View
          style={{
            transform: [
              {
                rotate: spin.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '90deg'],
                }),
              },
            ],
          }}
        >
          <ChevronRightSmallIcon color={theme.colors.muted} size={16} />
        </Animated.View>
      </Pressable>

      {open ? <View style={{ paddingBottom: theme.space.lg }}>{children}</View> : null}
    </View>
  );
}
