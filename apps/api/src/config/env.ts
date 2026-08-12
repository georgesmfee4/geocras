import 'dotenv/config';
import { z } from 'zod';

/**
 * Validation de l'environnement au démarrage.
 *
 * Le processus refuse de démarrer si une variable manque ou est douteuse.
 * Une API qui démarre avec un secret JWT par défaut est pire qu'une API qui
 * ne démarre pas : la panne est silencieuse et la faille est en production.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

  DATABASE_URL: z.string().url().startsWith('postgres'),

  JWT_ACCESS_SECRET: z.string().min(32, 'Au moins 32 caractères'),
  JWT_REFRESH_SECRET: z.string().min(32, 'Au moins 32 caractères'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  LOG_LEVEL: z
    .enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Configuration d'environnement invalide :\n${details}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/**
 * Les deux secrets doivent différer : réutiliser le même signifie qu'un jeton
 * d'accès volé peut être présenté comme jeton de rafraîchissement.
 */
if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être différents');
}
