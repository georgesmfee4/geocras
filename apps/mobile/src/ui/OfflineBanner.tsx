import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { forceProbe, useReachability } from '../api/reachability';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

/**
 * Hauteur de la bande, en points.
 *
 * Fixe, et exportée : la racine s'en sert pour **réserver la place** au-dessus
 * de la pile. Sans cette valeur partagée, le bandeau se poserait par-dessus les
 * titres d'écran — ce qu'il faisait, et qui le rendait illisible en même temps
 * qu'il rendait le titre illisible.
 */
export const OFFLINE_BANNER_HEIGHT = 30;

/**
 * Le bandeau « hors ligne ».
 *
 * **Il existe pour que l'écran n'ait plus à le dire.** Sans lui, chaque page
 * devait choisir entre effacer ce qu'elle montrait pour afficher une erreur —
 * et punir l'utilisateur d'être resté — ou taire la panne et le laisser croire
 * que ses données sont fraîches. Le bandeau règle l'arbitrage une fois : le
 * contenu reste, même périmé, et l'état de la connexion vit au-dessus de lui.
 *
 * Il apparaît **dès le premier échec réseau**, c'est-à-dire environ douze
 * secondes après le début de la panne au lieu des quatre-vingt-sept d'avant, et
 * disparaît de lui-même à la première requête qui aboutit.
 *
 * Ambre et non rouge : le rouge appartient au SOS et aux échecs d'action. Une
 * connexion perdue mérite qu'on le signale, pas qu'on le dramatise — et
 * l'utilisateur en panne au bord d'une route a besoin que le rouge veuille
 * encore dire quelque chose.
 *
 * Il se touche : c'est le geste le plus direct pour relancer, et l'utilisateur
 * sait souvent avant l'application qu'il vient de retrouver du réseau.
 */
export function OfflineBanner() {
  const theme = useTheme();
  const { t } = useI18n();
  const reachability = useReachability();
  const reducedMotion = useReducedMotion();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();

  const visible = reachability === 'offline';
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      slide.setValue(visible ? 1 : 0);
      return;
    }

    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [visible, slide, reducedMotion]);

  // Démonté quand il n'y a rien à dire : un bandeau replié garde une hauteur
  // nulle mais continue d'exister dans l'arbre, et son animation de sortie
  // doit avoir le temps de jouer. Le rendu est conditionné à l'état, pas à la
  // fin de l'animation — la sortie est assez brève pour ne pas se remarquer.
  if (!visible) return null;

  return (
    <Animated.View
      style={{
        // Superposé et non inséré : voir la note du layout racine. Il ne
        // déplace jamais rien, il se pose.
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        opacity: slide,
        transform: [
          { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
        ],
      }}
    >
      <Pressable
        onPress={() => {
          // Deux gestes en un : rouvrir le circuit, puis relancer ce que
          // l'écran courant avait abandonné. Sans le second, le bandeau
          // disparaîtrait sans que rien ne se recharge.
          forceProbe();
          void client.refetchQueries({ type: 'active' });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t('state.offlineBanner')}. ${t('state.retry')}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <View
          style={{
            // Hauteur **fixe** et non déduite du texte : c'est elle que la
            // racine réserve au-dessus de la pile, et une bande qui grandirait
            // d'un point recouvrirait à nouveau le haut de l'écran.
            height: OFFLINE_BANNER_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space.sm,
            paddingHorizontal: theme.space.lg,
            backgroundColor: theme.colors.highlight,
          }}
        >
          <Text
            variant="lblb"
            style={{ color: theme.colors.onHighlight }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {t('state.offlineBanner')}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
