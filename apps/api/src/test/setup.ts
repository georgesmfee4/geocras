/**
 * Environnement de test.
 *
 * Les tests géospatiaux ont besoin d'un vrai PostGIS : ni pg-mem ni SQLite ne
 * savent exécuter `ST_DWithin`, et tester la requête centrale du produit
 * contre une imitation ne prouverait rien.
 *
 * Renseigner `TEST_DATABASE_URL` (une branche Neon dédiée, jamais `dev` ni
 * `main`) pour activer ces tests. Sans elle, ils sont ignorés explicitement
 * plutôt que faussement verts.
 */
process.env.NODE_ENV = 'test';

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  // Espace réservé : permet à la validation d'environnement de passer pour les
  // tests qui ne touchent pas la base. Aucune connexion n'est ouverte.
  process.env.DATABASE_URL ??= 'postgresql://placeholder@localhost:5432/placeholder';
}

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters-long';
process.env.BCRYPT_ROUNDS ??= '10';
process.env.LOG_LEVEL ??= 'silent';

export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
