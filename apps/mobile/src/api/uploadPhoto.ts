import type { UploadFolder } from '@geocras/shared';
import { ApiError, TIMEOUTS } from './client';
import { api } from './endpoints';

/** Même budget que les autres envois lourds — voir {@link TIMEOUTS}. */
const UPLOAD_TIMEOUT_MS = TIMEOUTS.heavy;

/**
 * Envoi d'une photo.
 *
 * Le binaire **ne passe pas par notre API** : le serveur ne signe qu'une
 * autorisation, et le fichier part directement du téléphone vers Cloudinary.
 * C'est ce qui évite de faire transiter des mégaoctets par un serveur Node
 * qu'on paie à la seconde, et d'y ouvrir une surface d'attaque.
 *
 * Deux échecs sont **normaux** et ne doivent jamais bloquer un SOS :
 *
 * - `UPLOADS_NOT_CONFIGURED` — les clés Cloudinary ne sont pas renseignées sur
 *   le serveur. C'est l'état actuel de l'environnement de développement.
 * - `UNAUTHORIZED` — la signature exige un compte ; un invité n'en a pas.
 *
 * Dans les deux cas on renvoie `null` plutôt que de lever : la photo est un
 * confort, la demande d'assistance est l'essentiel. Refuser d'envoyer un SOS
 * parce qu'une image n'a pas pu partir serait un défaut grave sur un service
 * d'urgence.
 */
export type PhotoUploadResult =
  | { url: string; skipped: false }
  | { url: null; skipped: true; reason: 'not_configured' | 'unauthenticated' | 'failed' };

type CloudinaryResponse = { secure_url?: string };

export async function uploadPhoto(
  localUri: string,
  folder: UploadFolder,
): Promise<PhotoUploadResult> {
  let signature;
  try {
    signature = await api.uploads.sign(folder);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UPLOADS_NOT_CONFIGURED') {
      return { url: null, skipped: true, reason: 'not_configured' };
    }
    if (error instanceof ApiError && error.status === 401) {
      return { url: null, skipped: true, reason: 'unauthenticated' };
    }
    return { url: null, skipped: true, reason: 'failed' };
  }

  const form = new FormData();
  // React Native accepte cet objet en guise de fichier : il n'y a pas de `File`
  // ni de `Blob` lisible depuis un `file://` sans charger l'image en mémoire.
  form.append('file', {
    uri: localUri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  } as unknown as Blob);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('folder', signature.folder);
  form.append('upload_preset', signature.uploadPreset);

  /**
   * L'envoi a un plafond, comme tout le reste.
   *
   * Il n'en avait aucun : ce `fetch` partait vers Cloudinary sans minuteur, et
   * sur un lien mort il restait ouvert jusqu'à ce que le système d'exploitation
   * s'en lasse — plusieurs minutes sur Android. C'est ce qui faisait attendre
   * si longtemps avant « Impossible de joindre la photo ». Le message était
   * juste ; c'est le délai pour l'obtenir qui ne l'était pas.
   *
   * Vingt-cinq secondes, et non douze comme un appel ordinaire : on pousse un
   * binaire, pas du JSON, et sur un réseau lent une photo de deux mégaoctets
   * prend légitimement ce temps-là.
   */
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
      { method: 'POST', body: form, signal: abort.signal },
    );
    if (!response.ok) return { url: null, skipped: true, reason: 'failed' };

    const body = (await response.json()) as CloudinaryResponse;
    if (!body.secure_url) return { url: null, skipped: true, reason: 'failed' };

    return { url: body.secure_url, skipped: false };
  } catch {
    return { url: null, skipped: true, reason: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}
