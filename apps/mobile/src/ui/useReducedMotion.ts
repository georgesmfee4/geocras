import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Réglage système « réduire les animations ».
 *
 * Les boucles du splash — ondes concentriques, barre de progression, pastille
 * clignotante — sont exactement le type de mouvement continu que ce réglage
 * existe pour supprimer. On les fige alors sur un état lisible plutôt que de
 * les arrêter net sur une image vide.
 *
 * **Un seul abonnement pour toute l'app**, et non un par composant. La version
 * précédente ouvrait, à chaque montage, un appel natif asynchrone et un
 * écouteur : sur un écran qui pose douze blocs d'attente d'un coup, cela faisait
 * douze allers-retours vers le module d'accessibilité au moment précis où la
 * transition d'ouverture avait besoin du fil JavaScript. Le réglage est global
 * et change une fois par an : il se lit une fois, et tout le monde partage la
 * réponse.
 */
let reduced = false;
let started = false;
const subscribers = new Set<() => void>();

function publish(next: boolean): void {
  if (next === reduced) return;
  reduced = next;
  for (const notify of subscribers) notify();
}

function subscribe(onChange: () => void): () => void {
  subscribers.add(onChange);

  // La première demande amorce la lecture et l'écoute, une fois pour toutes.
  if (!started) {
    started = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(publish);
    AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
  }

  return () => {
    subscribers.delete(onChange);
  };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduced);
}
