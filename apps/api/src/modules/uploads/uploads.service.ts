import { createHash } from 'node:crypto';
import type { SignUploadResponse, UploadFolder } from '@geocras/shared';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';

/**
 * Preset d'upload signé, à créer côté Cloudinary.
 *
 * C'est LUI qui borne le type et la taille du fichier — pas le serveur. Une
 * signature qui ne couvre que `timestamp` et `folder`, comme le proposait
 * l'ancien dossier, laisse un compte volé téléverser n'importe quoi et vider le
 * quota : le preset est le seul endroit où Cloudinary applique des limites.
 */
export const UPLOAD_PRESET = 'geocras_signed';

/**
 * Les photos sont-elles utilisables sur cette instance ?
 *
 * Exporté pour que le démarrage puisse le dire à voix haute. Une fonctionnalité
 * silencieusement absente se découvre par un utilisateur qui essaie, pas par
 * l'équipe qui déploie — c'est exactement comme ça que « Envoi impossible » a
 * été pris pour une panne réseau alors qu'il manquait trois variables.
 */
export function uploadsConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );
}

/**
 * Génère une signature Cloudinary.
 *
 * Le binaire ne transite jamais par ce serveur : il ne signe que l'autorisation.
 * L'algorithme est imposé par Cloudinary — paramètres triés par nom, joints en
 * query string, concaténés au secret, puis SHA-1.
 */
export function signUpload(folder: UploadFolder): SignUploadResponse {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new AppError(
      503,
      'UPLOADS_NOT_CONFIGURED',
      "L'envoi de photos n'est pas configuré sur ce serveur",
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const scopedFolder = `geocras/${folder}`;

  const params: Record<string, string | number> = {
    folder: scopedFolder,
    timestamp,
    upload_preset: UPLOAD_PRESET,
  };

  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  const signature = createHash('sha1')
    .update(`${toSign}${CLOUDINARY_API_SECRET}`)
    .digest('hex');

  return {
    signature,
    timestamp,
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    folder: scopedFolder,
    uploadPreset: UPLOAD_PRESET,
  };
}
