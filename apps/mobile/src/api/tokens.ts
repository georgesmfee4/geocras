import * as SecureStore from 'expo-secure-store';

/**
 * Stockage des jetons.
 *
 * `expo-secure-store` et non AsyncStorage : les jetons sont des identifiants de
 * session. AsyncStorage écrit en clair dans le sandbox de l'app, lisible sur un
 * appareil rooté — cas loin d'être marginal sur le parc Android camerounais.
 */
const ACCESS_KEY = 'geocras.accessToken';
const REFRESH_KEY = 'geocras.refreshToken';

export type TokenPair = { accessToken: string; refreshToken: string };

/**
 * Cache mémoire : `getItemAsync` traverse le pont natif à chaque appel, ce qui
 * est trop coûteux pour une opération faite avant chaque requête HTTP.
 */
let cachedAccess: string | null = null;

export async function loadTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);

  cachedAccess = accessToken;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  cachedAccess = tokens.accessToken;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function saveAccessToken(accessToken: string): Promise<void> {
  cachedAccess = accessToken;
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
}

export async function clearTokens(): Promise<void> {
  cachedAccess = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}

export function getCachedAccessToken(): string | null {
  return cachedAccess;
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}
