import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

/** Filet de sécurité — plus long qu'une transition d'écran normale. */
const SAFETY_MS = 600;

/**
 * Forme minimale de l'objet de navigation dont ce hook a besoin.
 *
 * `transitionEnd` est émis par la pile native (react-native-screens) mais
 * n'apparaît pas dans le type générique renvoyé par `useNavigation()`, qui ne
 * connaît que les événements communs à tous les navigateurs. D'où ce contrat
 * étroit plutôt qu'un `any`.
 */
type TransitionAware = {
  addListener: (
    type: 'transitionEnd',
    listener: (event: { data?: { closing?: boolean } }) => void,
  ) => () => void;
};

/**
 * `false` pendant l'animation d'ouverture de l'écran, `true` une fois posée.
 *
 * Sert à **ne pas monter les sous-arbres coûteux dans la première frame**. La
 * pile ne commence à animer qu'une fois l'écran poussé rendu : tout ce que
 * contient ce premier rendu retarde le départ de la transition, puis lui
 * dispute le fil JavaScript pendant qu'elle joue.
 *
 * Le signal est l'événement `transitionEnd` de la pile, et non
 * `InteractionManager` comme dans une première version de ce hook. La raison
 * vaut d'être écrite : sur la pile **native**, l'animation est jouée par la
 * plateforme et n'ouvre aucun jeton d'interaction côté JavaScript.
 * `runAfterInteractions` se déclenchait donc au tour de boucle suivant, c'est-à-
 * dire au beau milieu de la transition — précisément ce qu'on voulait éviter.
 *
 * Le `setTimeout` reste en filet : un écran ouvert sans animation (`animation:
 * 'none'`, remplacement de pile, lien profond au démarrage) n'émet pas
 * forcément `transitionEnd`, et le contenu différé ne doit jamais rester
 * absent.
 */
export function useScreenReady(): boolean {
  const navigation = useNavigation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stack = navigation as unknown as TransitionAware;

    const unsubscribe = stack.addListener('transitionEnd', (event) => {
      // `closing` marque la sortie de l'écran, pas son arrivée.
      if (event?.data?.closing === true) return;
      setReady(true);
    });

    const safety = setTimeout(() => setReady(true), SAFETY_MS);

    return () => {
      unsubscribe();
      clearTimeout(safety);
    };
  }, [navigation]);

  return ready;
}
