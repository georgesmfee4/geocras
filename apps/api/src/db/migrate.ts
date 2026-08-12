import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from './client';

/**
 * Exécuteur de migrations SQL.
 *
 * Les migrations sont du SQL brut, écrit à la main. C'est le remplacement direct
 * du pattern « générer avec Prisma puis éditer le fichier à la main pour
 * remettre les types PostGIS » : ici il n'y a rien à corriger après coup, et
 * `GEOGRAPHY`, les index GIST, les triggers plpgsql et les contraintes CHECK
 * s'écrivent tels quels.
 *
 * Chaque fichier est appliqué dans une transaction : une migration qui échoue
 * ne laisse jamais la base à moitié migrée.
 */

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

type MigrationFile = { name: string; sql: string; checksum: string };

function loadMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function up(): Promise<void> {
  await ensureMigrationsTable();

  const applied = new Map<string, string>(
    (await pool.query<{ name: string; checksum: string }>('SELECT name, checksum FROM _migrations'))
      .rows.map((row) => [row.name, row.checksum]),
  );

  let count = 0;

  for (const migration of loadMigrations()) {
    const previous = applied.get(migration.name);

    if (previous !== undefined) {
      // Une migration déjà appliquée qui change de contenu signifie que
      // l'historique a été réécrit : les bases dev et prod ont divergé.
      if (previous !== migration.checksum) {
        throw new Error(
          `La migration ${migration.name} a été modifiée après application.\n` +
            `Créer une nouvelle migration plutôt que d'éditer une migration passée.`,
        );
      }
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('INSERT INTO _migrations (name, checksum) VALUES ($1, $2)', [
        migration.name,
        migration.checksum,
      ]);
      await client.query('COMMIT');
      count += 1;
      process.stdout.write(`  appliquée  ${migration.name}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Échec de la migration ${migration.name} : ${(error as Error).message}`, {
        cause: error,
      });
    } finally {
      client.release();
    }
  }

  process.stdout.write(
    count === 0 ? 'Base déjà à jour.\n' : `${count} migration(s) appliquée(s).\n`,
  );
}

async function reset(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('reset est interdit en production');
  }
  process.stdout.write('Suppression du schéma public…\n');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await up();
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  if (command === 'up') await up();
  else if (command === 'reset') await reset();
  else throw new Error(`Commande inconnue : ${command} (attendu : up | reset)`);
}

main()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    await pool.end();
    process.exit(1);
  });
