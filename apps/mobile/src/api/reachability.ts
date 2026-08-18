import { useSyncExternalStore } from 'react';

/**
 * Le serveur est-il joignable ?
 *
 * `unknown` tant qu'aucune requête n'a abouti ni échoué — au démarrage, on ne
 * sait rien, et prétendre le contraire ferait clignoter un bandeau « hors
 * ligne » sur chaque lancement.
 */
export type Reachability = 'unknown' | 'online' | 'offline';

/**
 * Coupe-circuit réseau.
 *
 * **Le défaut qu'il corrige.** Sans lui, chaque écran découvre l'injoignabilité
 * pour son propre compte : il ouvre une socket, attend son délai plein, la
 * ferme, recommence. Trois écrans ouverts, c'est trois fois la même attente
 * pour la même réponse — déjà connue depuis la première. C'est ce qui
 * transforme « le serveur est arrêté » en « l'application charge pendant des
 * minutes ».
 *
 * **Ce qu'il fait.** Un échec réseau ouvre le circuit. Tant qu'il est ouvert,
 * `apiFetch` échoue **immédiatement**, sans ouvrir de socket : l'écran affiche
 * `offline` en une frame au lieu d'attendre. Passé le délai de refroidissement,
 * une seule requête est laissée passer — la sonde. Si elle réussit, le circuit
 * se referme et tout repart ; si elle échoue, le délai double.
 *
 * **Pourquoi pas une bibliothèque de connectivité.** `expo-network` ou
 * `NetInfo` répondent à « le Wi-Fi est-il allumé », qui n'est pas la question :
 * un téléphone parfaitement connecté à un point d'accès sans Internet, ou à un
 * réseau où *notre* serveur est arrêté — le cas de ce matin — y est déclaré en
 * ligne. Ce coupe-circuit mesure la seule chose qui compte : est-ce que nos
 * requêtes aboutissent. Et il ne demande aucun module natif.
 */

/** Refroidissements successifs, en millisecondes. Le dernier est le plafond. */
const COOLDOWNS = [5_000, 15_000, 30_000] as const;

let state: Reachability = 'unknown';
let consecutiveFailures = 0;
/** Date à partir de laquelle une sonde est autorisée. `0` = circuit fermé. */
let openUntil = 0;
/** Une sonde est déjà en vol : les autres continuent d'échouer vite. */
let probing = false;

const listeners = new Set<() => void>();

function publish(next: Reachability): void {
  if (next === state) return;
  state = next;
  for (const notify of listeners) notify();
}

/** Le circuit refuse-t-il les requêtes à cet instant ? */
export function circuitIsOpen(): boolean {
  if (openUntil === 0) return false;

  // Refroidissement écoulé : on laisse passer **une** sonde et une seule.
  if (Date.now() >= openUntil) {
    if (probing) return true;
    probing = true;
    return false;
  }

  return true;
}

/** Une requête a abouti — quel que soit son code HTTP. Le réseau fonctionne. */
export function noteReachable(): void {
  consecutiveFailures = 0;
  openUntil = 0;
  probing = false;
  publish('online');
}

/** Une requête n'a pas atteint le serveur : délai dépassé, socket refusée. */
export function noteUnreachable(): void {
  probing = false;
  consecutiveFailures += 1;

  const cooldown = COOLDOWNS[Math.min(consecutiveFailures - 1, COOLDOWNS.length - 1)]!;
  openUntil = Date.now() + cooldown;
  publish('offline');
}

/**
 * Force la réouverture du circuit.
 *
 * Le geste explicite de l'utilisateur — appuyer sur « Réessayer » — vaut plus
 * que n'importe quel minuteur : il sait souvent avant nous qu'il vient de
 * retrouver du réseau, ou de rallumer son serveur.
 */
export function forceProbe(): void {
  openUntil = 0;
  probing = false;
}

/** Millisecondes restantes avant la prochaine sonde automatique. */
export function msUntilProbe(): number {
  return openUntil === 0 ? 0 : Math.max(0, openUntil - Date.now());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** État de joignabilité, abonnable depuis un composant. */
export function useReachability(): Reachability {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** Réinitialisation — réservée aux tests. */
export function resetReachability(): void {
  state = 'unknown';
  consecutiveFailures = 0;
  openUntil = 0;
  probing = false;
}
