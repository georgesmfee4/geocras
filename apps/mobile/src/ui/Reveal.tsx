import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

export type RevealProps = {
  /**
   * Retard d'entrée, en millisecondes.
   *
   * Ce qui fait la valeur du composant : trois blocs qui apparaissent à
   * 0 / 70 / 140 ms se lisent **dans leur ordre d'importance**, alors que trois
   * blocs apparus ensemble se lisent de haut en bas sans hiérarchie. Le décalage
   * doit rester sous le quart de seconde au total — au-delà, ce n'est plus une
   * entrée, c'est une attente.
   */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Course de l'entrée, en points. Assez pour se voir, trop peu pour se remarquer. */
const LIFT = 8;

/**
 * Entrée en fondu montant, jouée **une fois**, au montage.
 *
 * Les dépendances de l'effet sont volontairement vides : la file de travail
 * arrive par socket et se remet à jour plusieurs fois par minute, et rejouer
 * l'entrée à chaque poussée ferait clignoter l'écran d'un garagiste qui essaie
 * justement de lire un compteur d'attente.
 *
 * Sous « réduire les animations », le contenu est posé à sa place finale sans
 * qu'aucune valeur animée ne démarre : le réglage existe pour supprimer ce
 * mouvement, pas pour l'accélérer.
 */
export function Reveal({ delay = 0, style, children }: RevealProps) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();

    // Dépendances volontairement vides — c'est la règle du composant, pas un
    // oubli. `delay` et `reducedMotion` sont lus au montage et n'ont plus de
    // sens ensuite : l'entrée est finie.
  }, []);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [LIFT, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
