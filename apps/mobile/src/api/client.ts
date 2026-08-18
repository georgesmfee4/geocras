import type { ErrorResponse } from '@geocras/shared';
export { ApiError } from './ApiError';
import { ApiError } from './ApiError';
import { env } from '../config/env';
import { noteServerDate } from '../time/clock';
import { throughGate } from './gate';
import { circuitIsOpen, noteReachable, noteUnreachable } from './reachability';
import {
  clearTokens,
  getCachedAccessToken,
  getRefreshToken,
  loadTokens,
  saveAccessToken,
} from './tokens';

export const TIMEOUTS = { instant: 6_000, normal: 12_000, heavy: 25_000 } as const;
export type RequestSpeed = keyof typeof TIMEOUTS;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Certaines routes sont publiques : ne pas exiger de jeton. */
  auth?: boolean;
  signal?: AbortSignal;
  /** Classe d'attente. `normal` par défaut — voir {@link TIMEOUTS}. */
  speed?: RequestSpeed;
  /** Plafond explicite, quand aucune des trois classes ne convient. */
  timeoutMs?: number;
};

/**
 * Rafraîchissement en vol unique.
 *
 * Sans ce verrou, un écran qui lance quatre requêtes en parallèle avec un jeton
 * expiré déclencherait quatre rafraîchissements concurrents. Comme le serveur
 * fait tourner les jetons, trois d'entre eux échoueraient et déconnecteraient
 * l'utilisateur — au pire moment, c'est-à-dire quand il est en panne.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      const response = await fetch(`${env.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await clearTokens();
        return null;
      }

      const { accessToken } = (await response.json()) as { accessToken: string };
      await saveAccessToken(accessToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      // Libéré au tour de boucle suivant pour que les appels concurrents déjà
      // en attente partagent bien ce résultat.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('/') ? path.slice(1) : path, `${env.apiUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ErrorResponse;
    return new ApiError(
      response.status,
      body.error.code,
      body.error.message,
      body.error.fields,
    );
  } catch {
    return new ApiError(response.status, 'INTERNAL_ERROR', 'Réponse serveur illisible');
  }
}

/**
 * Point d'entrée unique des appels réseau.
 *
 * Règle du projet : **aucun `fetch` dans un composant**. Tout passe par ici,
 * ce qui garantit un seul endroit pour l'authentification, le rafraîchissement,
 * la forme des erreurs et le délai d'expiration.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    auth = true,
    signal,
    speed = 'normal',
    timeoutMs = TIMEOUTS[speed],
  } = options;

  /**
   * Échec immédiat quand le serveur est déjà connu injoignable.
   *
   * Aucune socket n'est ouverte : l'écran reçoit son erreur dans la frame
   * courante et affiche « hors ligne » au lieu de faire tourner une roue. C'est
   * ce qui empêche le deuxième écran de repayer l'attente du premier.
   */
  if (circuitIsOpen()) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Serveur injoignable');
  }

  const execute = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    // Un réseau 2G peut « répondre » pendant des minutes : sans plafond, un
    // écran de chargement resterait figé indéfiniment.
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);

    // On combine l'annulation de l'appelant et celle du délai. L'écouteur est
    // **retiré au retour** : sans cela, chaque tentative en ajoutait un de plus
    // sur le signal de l'appelant, et un écran qui remonte souvent finissait
    // par en accumuler des dizaines sur un signal qu'il garde en vie.
    const relay = () => timeout.abort();
    signal?.addEventListener('abort', relay, { once: true });

    try {
      return await fetch(buildUrl(path, query), {
        method,
        headers,
        signal: timeout.signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', relay);
    }
  };

  let token = auth ? (getCachedAccessToken() ?? (await loadTokens())?.accessToken ?? null) : null;

  let response: Response;
  try {
    // Le créneau est pris ici, et non autour de tout l'appel : la lecture du
    // jeton touche le stockage sécurisé, pas le réseau, et n'a rien à faire
    // dans la file.
    response = await throughGate(() => execute(token));
  } catch (error) {
    // L'annulation demandée par l'appelant — écran démonté, requête remplacée —
    // n'est pas une panne de réseau et ne doit surtout pas ouvrir le circuit.
    if (signal?.aborted) throw new ApiError(0, 'NETWORK_ERROR', 'Requête annulée');

    noteUnreachable();
    if ((error as Error).name === 'AbortError') {
      throw new ApiError(0, 'NETWORK_ERROR', 'Délai dépassé, réseau trop lent');
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Connexion impossible');
  }

  // Le serveur a répondu : le réseau fonctionne, quel que soit le code renvoyé.
  noteReachable();

  if (response.status === 401 && auth) {
    token = await refreshAccessToken();
    if (token) {
      try {
        response = await throughGate(() => execute(token));
      } catch {
        noteUnreachable();
        throw new ApiError(0, 'NETWORK_ERROR', 'Connexion impossible');
      }
    }
  }

  /**
   * On relève l'heure du serveur au passage.
   *
   * C'est le seul endroit de l'app qui voit toutes les réponses, donc le seul
   * qui puisse tenir l'écart entre l'horloge de l'appareil et celle du
   * serveur. Sans lui, tout compteur bâti sur un horodatage serveur mesure en
   * réalité la dérive du téléphone — un écran d'attente démarrait ainsi à
   * plusieurs minutes sur une demande qui venait de partir. Voir
   * `src/time/clock.ts`.
   *
   * Relevé y compris sur une réponse d'erreur : une horloge fausse ne se
   * corrige pas moins bien parce que la requête a échoué.
   */
  noteServerDate(response.headers.get('date'));

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
