import { useEffect, useState } from 'react';
import { isNear, isPositionFresh, type TrackingEta } from '@geocras/shared';
import { serverNow } from '../time/clock';

/**
 * Cadence de réévaluation de la fraîcheur.
 *
 * La distance ne change que lorsqu'un point arrive ; **la fraîcheur, elle,
 * s'use toute seule**. Sans ce battement, une liaison qui se coupe pile au
 * moment où les deux parties se rapprochent laisserait la fenêtre ouverte
 * indéfiniment sur une position figée — c'est-à-dire proposerait de confirmer
 * une arrivée sur la foi d'une donnée que l'app affiche par ailleurs comme
 * périmée.
 *
 * Cinq secondes : un quart de la fenêtre de péremption, assez fin pour que la
 * fermeture suive de près, assez lâche pour ne rien coûter.
 */
const FRESHNESS_POLL_MS = 5_000;

export type Proximity = {
  /** Les deux parties sont proches, la mesure est fraîche, et rien n'a été écarté. */
  near: boolean;
  /** Distance mesurée entre les deux parties, en mètres. */
  distanceM: number | null;
  /** Écarte la fenêtre jusqu'au prochain rapprochement. */
  dismiss: () => void;
};

/**
 * « Est-ce qu'on est arrivé ? », posée en continu et de la même façon des deux
 * côtés.
 *
 * Le hook lit **le même champ que l'autre partie** — la distance calculée par
 * le serveur entre le dernier point du garagiste et le lieu de la panne. C'est
 * la règle du produit pour tout ce qui touche au suivi : l'ETA et la distance
 * sont calculés en un seul endroit, sinon les deux écrans annoncent deux
 * vérités et personne ne peut arbitrer. Un calcul local sur le GPS de chaque
 * appareil aurait été plus réactif de quelques secondes, au prix d'un garagiste
 * à qui l'on demande « vous le voyez ? » pendant que son client ne voit rien
 * venir.
 *
 * Trois portes, dans cet ordre : le moment doit s'y prêter (`enabled`), la
 * mesure doit être fraîche, et la distance doit être sous le seuil — avec
 * hystérésis, pour qu'un dépanneur qui tourne pour se garer ne fasse pas
 * clignoter la feuille.
 */
export function useProximity(eta: TrackingEta | null, enabled: boolean): Proximity {
  const [near, setNear] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const distanceM = eta?.distanceM ?? null;
  const updatedAt = eta?.updatedAt ?? null;

  useEffect(() => {
    if (!enabled) {
      setNear(false);
      return;
    }

    /*
      La forme fonctionnelle de `setNear` porte l'hystérésis : l'état précédent
      décide du seuil à appliquer, sans que `near` ait à figurer dans les
      dépendances — il s'y relancerait en boucle.

      Reposer la même valeur ne provoque aucun rendu : React s'arrête sur
      l'égalité. Le battement de cinq secondes ne coûte donc rien tant que rien
      ne change, ce qui est le cas la plupart du temps.
    */
    const evaluate = (): void => {
      setNear((was) => isPositionFresh(updatedAt, serverNow()) && isNear(distanceM, was));
    };

    evaluate();
    const timer = setInterval(evaluate, FRESHNESS_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, distanceM, updatedAt]);

  /**
   * La fenêtre écartée se rouvre au prochain rapprochement.
   *
   * « Pas encore » veut dire « pas maintenant », pas « plus jamais » : un
   * garagiste qui passe devant sans voir le véhicule, fait le tour et revient
   * doit se voir reproposer la question. Mais tant qu'il reste dans la zone,
   * elle ne revient pas — une feuille qui se rouvre toutes les cinq secondes
   * après avoir été fermée est un harcèlement, pas une aide.
   */
  useEffect(() => {
    if (!near) setDismissed(false);
  }, [near]);

  return {
    near: near && !dismissed,
    distanceM,
    dismiss: () => setDismissed(true),
  };
}
