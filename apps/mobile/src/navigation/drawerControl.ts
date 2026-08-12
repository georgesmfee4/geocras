/**
 * Fermeture du tiroir depuis l'extérieur de son navigateur.
 *
 * Les écrans du menu s'empilent **au-dessus** du tiroir resté ouvert : c'est ce
 * qui rend leur ouverture instantanée, puisque rien ne se referme et que
 * l'accueil n'est jamais traversé. Revenir en arrière ramène donc au menu, là
 * où l'on était — le comportement qu'on attend d'une pile.
 *
 * Restent deux sorties où le menu n'a plus lieu d'être ouvert : la déconnexion
 * et la suppression du compte. Elles renvoient à la carte, et retrouver le menu
 * par-dessus serait absurde.
 *
 * Or React Navigation ne permet pas de viser ce navigateur-là : une action
 * remonte la hiérarchie, elle ne redescend pas. Le tiroir est un enfant d'un
 * écran **frère** de celui qui veut le fermer, donc hors d'atteinte. D'où ce
 * relais explicite : le contenu du tiroir dépose sa fonction de fermeture au
 * montage, et qui en a besoin l'appelle. Une seule référence, remplacée à
 * chaque montage — il n'existe jamais deux tiroirs à la fois.
 */
let closer: (() => void) | null = null;

/** Appelé par le tiroir. Rend la fonction de désinscription. */
export function registerDrawerCloser(close: () => void): () => void {
  closer = close;
  return () => {
    if (closer === close) closer = null;
  };
}

/** Sans effet si aucun tiroir n'est monté — le cas d'un lien profond. */
export function closeDrawerFromAnywhere(): void {
  closer?.();
}
