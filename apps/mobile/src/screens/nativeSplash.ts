import * as SplashScreen from 'expo-splash-screen';

/**
 * Effacement du splash **natif**.
 *
 * Le moment où on l'appelle est tout le sujet. `expo-splash-screen` fait
 * disparaître le splash en fondu ; pendant ce fondu, ce qui apparaît en
 * dessous est ce que l'application a déjà dessiné. Si on l'efface dès que les
 * polices sont prêtes — donc avant que le premier écran n'ait été peint — le
 * fondu découvre le fond de fenêtre Android, blanc par défaut. C'est
 * exactement la frame blanche qu'on observait entre le splash et l'accueil.
 *
 * On l'appelle donc depuis l'écran lui-même, une fois qu'il est réellement à
 * l'écran. Le fondu passe alors du splash natif rouge au splash JS rouge :
 * il n'y a plus rien à voir entre les deux.
 *
 * Idempotent, parce qu'il est déclenché de deux endroits : l'écran de
 * lancement en temps normal, et un garde-fou temporisé au cas où cet écran ne
 * serait jamais monté — un lien profond ouvre directement une autre route, et
 * un splash natif qui ne s'efface jamais est une app qui ne démarre pas.
 */
let hidden = false;

export function hideNativeSplash(): void {
  if (hidden) return;
  hidden = true;

  // L'échec est sans conséquence : il signifie que le splash est déjà parti.
  void SplashScreen.hideAsync().catch(() => undefined);
}

/**
 * Variante à appeler depuis un `onLayout`.
 *
 * `onLayout` signale que la vue est **mesurée**, pas encore dessinée. On laisse
 * donc passer une image avant d'effacer : sans ce report, on retombe sur le
 * problème d'origine à une frame près.
 */
export function hideNativeSplashAfterPaint(): void {
  requestAnimationFrame(() => hideNativeSplash());
}
