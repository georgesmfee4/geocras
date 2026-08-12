import { z } from 'zod';

/**
 * Signature d'upload Cloudinary.
 *
 * Le binaire ne transite jamais par le serveur : il demande une signature, le
 * mobile envoie le fichier directement à Cloudinary, puis renvoie l'URL
 * obtenue dans la requête suivante (`photoUrl` d'un SOS, `photos` d'un garage).
 */
export const UPLOAD_FOLDERS = ['sos', 'garages', 'avatars'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const signUploadBodySchema = z.object({
  folder: z.enum(UPLOAD_FOLDERS),
});
export type SignUploadBody = z.infer<typeof signUploadBodySchema>;

export const signUploadResponseSchema = z.object({
  signature: z.string(),
  timestamp: z.number().int(),
  cloudName: z.string(),
  apiKey: z.string(),
  folder: z.string(),
  /**
   * Preset signé côté Cloudinary : c'est LUI qui borne le type et la taille du
   * fichier. Sans preset, une signature ouverte laisse un compte volé
   * téléverser n'importe quoi et vider le quota.
   */
  uploadPreset: z.string(),
});
export type SignUploadResponse = z.infer<typeof signUploadResponseSchema>;
