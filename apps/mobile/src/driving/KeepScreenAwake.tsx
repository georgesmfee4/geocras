import { useKeepAwake } from 'expo-keep-awake';

/** Verrou nommé : il ne doit jamais être relâché par un autre écran. */
const TAG = 'geocras-driving';

/**
 * Empêche l'écran de s'éteindre tant que ce composant est monté.
 *
 * Un mode conduite qui s'éteint au bout de trente secondes n'est pas un mode
 * conduite : le téléphone est sur un support, personne ne le touche pendant
 * qu'il roule, et c'est exactement la condition qui déclenche la veille du
 * système.
 *
 * **Un composant plutôt qu'un appel conditionnel.** `useKeepAwake` tient le
 * verrou pendant toute la vie de son composant hôte : le monter et le démonter
 * est donc la seule façon de l'activer par intermittence sans piloter à la main
 * une paire activer/désactiver qu'un rendu interrompu laisserait déséquilibrée.
 * L'écran l'affiche pendant la session et le retire à l'arrêt, et le verrou
 * suit sans qu'aucun effet n'ait à être écrit.
 */
export function KeepScreenAwake() {
  useKeepAwake(TAG);
  return null;
}
