import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { serverNow } from '../time/clock';

/**
 * Instant d'envoi d'un SOS à un garage donné.
 *
 * L'écran d'attente décompte depuis ce moment précis — pas depuis l'ouverture
 * du formulaire de panne, qui peut le précéder de vingt minutes de comparaison
 * entre garages. Le serveur le sait aussi (`selectedAt`, migration 0004), et
 * reste la référence : c'est lui qui date la notification réellement envoyée
 * au garage, et lui seul que voient les deux parties.
 *
 * Mais l'app n'a pas à attendre un aller-retour pour afficher un chiffre
 * qu'elle connaît déjà : c'est **elle** qui vient d'appuyer sur le bouton. On
 * retient donc l'instant localement au succès de la mutation, ce qui rend le
 * compteur exact dès la première image et indépendant d'un serveur qui n'aurait
 * pas encore la colonne.
 *
 * Persisté, parce que l'attente survit à l'application : quelqu'un en panne
 * range son téléphone, le système finit par tuer l'app, et le compteur doit
 * reprendre là où il en était plutôt que de repartir de zéro — ou pire, de
 * retomber sur l'heure de création de la demande.
 */

const STORAGE_PREFIX = 'geocras.sos-sent-at.';

/**
 * Copie mémoire, consultée avant le stockage.
 *
 * `AsyncStorage` est asynchrone : sans elle, l'écran d'attente afficherait un
 * tiret le temps d'une lecture disque, juste après un envoi dont il connaît
 * pourtant l'instant à la milliseconde près.
 */
const memory = new Map<string, string>();

/**
 * Retient l'instant d'envoi.
 *
 * Par défaut l'heure **du serveur** et non celle de l'appareil : le compteur
 * compare ensuite cette valeur à `serverNow()`, et mélanger les deux horloges
 * ferait démarrer l'attente à la dérive du téléphone.
 */
export function rememberSentAt(
  requestId: string,
  iso: string = new Date(serverNow()).toISOString(),
): void {
  memory.set(requestId, iso);
  void AsyncStorage.setItem(`${STORAGE_PREFIX}${requestId}`, iso);
}

/** Oublie une demande qui n'attend plus — acceptée, annulée, terminée. */
export function forgetSentAt(requestId: string): void {
  memory.delete(requestId);
  void AsyncStorage.removeItem(`${STORAGE_PREFIX}${requestId}`);
}

/** Instant d'envoi connu localement, ou `null` si cette app ne l'a pas vu partir. */
export function useSentAt(requestId: string | null): string | null {
  const [known, setKnown] = useState<string | null>(
    () => (requestId ? (memory.get(requestId) ?? null) : null),
  );

  useEffect(() => {
    if (!requestId) {
      setKnown(null);
      return;
    }

    const cached = memory.get(requestId);
    if (cached) {
      setKnown(cached);
      return;
    }

    let cancelled = false;

    void AsyncStorage.getItem(`${STORAGE_PREFIX}${requestId}`).then((stored) => {
      if (cancelled || !stored) return;
      memory.set(requestId, stored);
      setKnown(stored);
    });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  return known;
}
