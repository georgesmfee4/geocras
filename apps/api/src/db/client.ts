import { Kysely, PostgresDialect } from 'kysely';
import { Pool, types } from 'pg';
import { env, isProduction } from '../config/env';
import type { Database } from './types';

/**
 * `NUMERIC` (OID 1700) est rendu en chaîne par défaut pour préserver la
 * précision arbitraire. Nos seules colonnes NUMERIC sont des notes bornées
 * 0–5 avec une décimale : la précision d'un double est très largement
 * suffisante, et une note qui arrive en `"4.6"` au lieu de `4.6` casse
 * silencieusement toutes les comparaisons côté mobile.
 */
types.setTypeParser(types.builtins.NUMERIC, (value) => Number.parseFloat(value));

/** `INT8` (OID 20) — nos BIGSERIAL restent très loin de MAX_SAFE_INTEGER. */
types.setTypeParser(types.builtins.INT8, (value) => Number.parseInt(value, 10));

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Neon impose TLS. En local sans certificat de confiance, on accepte la
  // chaîne non vérifiée — jamais en production.
  ssl: env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: isProduction },
  max: isProduction ? 10 : 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export async function closeDatabase(): Promise<void> {
  await db.destroy();
}
