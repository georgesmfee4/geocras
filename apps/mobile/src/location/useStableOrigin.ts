import { useRef } from 'react';
import { haversineMeters, type LatLng } from '@geocras/shared';

/**
 * Point d'ancrage de la recherche de garages.
 *
 * Le problème que ce module résout se voit en restant **immobile** : avec une
 * précision de ±100 m — ordinaire à Yaoundé comme à Ebolowa — le GPS republie
 * une position légèrement différente toutes les cinq secondes. Chaque saut
 * franchit la grille d'arrondi de la clé de cache, et l'app relance une
 * recherche complète sur le réseau. Trois requêtes en trois minutes, pour un
 * téléphone posé sur une table.
 *
 * On ancre donc la recherche : elle ne se déplace que lorsque l'utilisateur a
 * **réellement** bougé. Le seuil est choisi au-dessus du bruit GPS typique, de
 * sorte qu'un point qui tremble ne coûte rien, alors qu'un déplacement franc
 * met bien les distances à jour.
 *
 * Volontairement réservé à la **consultation**. La déclaration de panne et le
 * suivi temps réel doivent partir de la position exacte, au mètre près : c'est
 * cette position-là qu'on envoie au garagiste, et elle sert de preuve
 * anti-fraude.
 */

/**
 * Distance à parcourir avant de relancer la recherche.
 *
 * 150 m dépasse la dérive habituelle sans masquer un vrai déplacement : à cette
 * échelle, l'erreur commise sur un garage annoncé à « 1,2 km » reste invisible,
 * alors qu'un utilisateur qui change de quartier voit bien sa liste changer.
 */
export const SEARCH_ANCHOR_THRESHOLD_M = 150;

/** Extrait pour être testable sans monter de composant. */
export function shouldReanchor(
  anchor: LatLng | null,
  position: LatLng,
  thresholdM: number = SEARCH_ANCHOR_THRESHOLD_M,
): boolean {
  if (anchor === null) return true;
  return haversineMeters(anchor, position) >= thresholdM;
}

/**
 * Renvoie une origine de recherche stable.
 *
 * L'identité de l'objet ne change que quand l'ancre bouge : les consommateurs
 * en dépendance de `useEffect` ou de clé de requête ne se réveillent donc pas
 * à chaque point GPS.
 */
export function useStableOrigin(
  position: LatLng | null,
  thresholdM: number = SEARCH_ANCHOR_THRESHOLD_M,
): LatLng | null {
  const anchor = useRef<LatLng | null>(null);

  if (position === null) {
    // Perte de position : on lâche l'ancre. La garder ferait afficher des
    // distances calculées depuis un endroit où l'utilisateur n'est plus.
    anchor.current = null;
    return null;
  }

  if (shouldReanchor(anchor.current, position, thresholdM)) {
    anchor.current = { lat: position.lat, lng: position.lng };
  }

  return anchor.current;
}
