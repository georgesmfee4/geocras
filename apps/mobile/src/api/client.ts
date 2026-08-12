import type { ErrorCode, ErrorResponse } from '@geocras/shared';
import { env } from '../config/env';
import { noteServerDate } from '../time/clock';
import {
  clearTokens,
  getCachedAccessToken,
  getRefreshToken,
  loadTokens,
  saveAccessToken,
} from './tokens';

/** Erreur porteuse du code serveur — le mobile traduit sur le code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly fields: Record<string, string> | undefined;

  constructor(
    status: number,
    code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  /** Une erreur réseau se réessaie ; une erreur métier, non. */
  get isRetryable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.status >= 500;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Certaines routes sont publiques : ne pas exiger de jeton. */
  auth?: boolean;
  signal?: AbortSignal;
  /**
   * Plafond d'attente propre à cet appel.
   *
   * Le défaut de 20 s convient à une action que l'utilisateur attend. Il est
   * beaucoup trop long pour un appel **facultatif** : sur un réseau muet, il
   * fait patienter vingt secondes pour un service dont on peut se passer.
   */
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
  const { method = 'GET', body, query, auth = true, signal, timeoutMs = 20_000 } = options;

  const execute = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    // Un réseau 2G peut « répondre » pendant des minutes : sans plafond, un
    // écran de chargement resterait figé indéfiniment.
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);

    // On combine l'annulation de l'appelant et celle du délai.
    signal?.addEventListener('abort', () => timeout.abort(), { once: true });

    try {
      return await fetch(buildUrl(path, query), {
        method,
        headers,
        signal: timeout.signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let token = auth ? (getCachedAccessToken() ?? (await loadTokens())?.accessToken ?? null) : null;

  let response: Response;
  try {
    response = await execute(token);
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new ApiError(0, 'NETWORK_ERROR', 'Délai dépassé, réseau trop lent');
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Connexion impossible');
  }

  if (response.status === 401 && auth) {
    token = await refreshAccessToken();
    if (token) {
      try {
        response = await execute(token);
      } catch {
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
