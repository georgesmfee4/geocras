import Constants from 'expo-constants';

/**
 * Configuration côté mobile.
 *
 * Les variables `EXPO_PUBLIC_*` sont inlinées dans le bundle : elles sont
 * **publiques**. On n'y met jamais de secret — la clé MapTiler y a sa place
 * (elle se restreint par domaine/bundle id côté fournisseur), un secret
 * Cloudinary non.
 */
function readHostFromExpo(): string | null {
  // En développement, l'app tourne sur un téléphone : « localhost » y désigne
  // le téléphone lui-même, pas la machine de développement. On récupère l'IP
  // du serveur Metro, qui est la bonne adresse dans 99 % des cas.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;

  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host ? `http://${host}:3000` : null;
}

/**
 * `.env` livre `EXPO_PUBLIC_API_URL=` **vide** en développement, pour que l'IP
 * soit déduite du serveur Metro. Or une chaîne vide n'est pas nullish : avec
 * `??`, elle l'emporterait sur la déduction et toutes les requêtes partiraient
 * vers une URL vide — l'app afficherait « connexion impossible » sans qu'aucune
 * variable ne paraisse mal réglée. D'où le `||`.
 */
const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const env = {
  apiUrl: configuredUrl || readHostFromExpo() || 'http://localhost:3000',
  maptilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '',
  supportPhone: process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '+237800000000',
} as const;

export const isApiConfigured = Boolean(env.apiUrl);
