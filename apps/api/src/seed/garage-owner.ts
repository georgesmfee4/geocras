import bcrypt from 'bcryptjs';
import { db, pool } from '../db/client';
import { env } from '../config/env';
import { generateReferralCode } from '../modules/auth/tokens';

/**
 * Compte garagiste rattaché à un garage du seed.
 *
 * Les garages du seed n'ont **pas de propriétaire** : `owner_user_id` y est
 * NULL, ce qui est cohérent — ce sont des fiches montées à la main, pas des
 * inscriptions. Mais c'est aussi ce qui rendait le parcours garage
 * inobservable : `resolveParty` ne reconnaît le garagiste qu'à travers
 * `garages.owner_user_id`, donc un SOS adressé à l'un de ces garages
 * n'appartenait à personne. Le client attendait une réponse que **aucun compte
 * au monde** ne pouvait donner.
 *
 * Ce script comble ce trou pour les essais : il crée un compte, le promeut
 * `garage_owner` et l'attache au garage nommé. Rien d'autre — pas de dossier de
 * vérification à instruire, le garage du seed est déjà vérifié.
 *
 *   npm run db:seed:garagiste                          Ebolowa Auto Secours
 *   npm run db:seed:garagiste -- "Garage Central Elat"  un autre
 *
 * Le mot de passe est en clair ici et c'est assumé : c'est un jeu d'essai de
 * développement, refusé en production par la garde ci-dessous. Aucun de ces
 * comptes ne doit exister sur la base de lancement.
 */

const DEFAULT_GARAGE = 'Ebolowa Auto Secours';

/**
 * Le compte se connecte avec le **numéro public du garage**.
 *
 * C'est le numéro que le garagiste connaît par cœur et que ses clients
 * composent déjà ; lui en inventer un second pour se connecter serait un
 * identifiant de plus à retenir, au bénéfice de personne.
 */
const PASSWORD = 'garage2026';

async function seed(garageName: string): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Le seed est interdit en production');
  }

  const garage = await db
    .selectFrom('garages')
    .select(['id', 'name', 'phone', 'city', 'owner_user_id', 'verified_at'])
    .where('name', '=', garageName)
    .executeTakeFirst();

  if (!garage) {
    throw new Error(`Aucun garage nommé « ${garageName} » en base. Lancer d'abord le seed.`);
  }
  if (!garage.phone) {
    throw new Error(`Le garage « ${garageName} » n'a pas de numéro : pas d'identifiant possible.`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, env.BCRYPT_ROUNDS);

  const userId = await db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('users')
      .select(['id'])
      .where('phone', '=', garage.phone)
      .executeTakeFirst();

    /**
     * Réexécutable sans état : on remet le mot de passe et le rôle plutôt que
     * de s'arrêter sur « ce numéro existe déjà ». Un jeu d'essai qui échoue à
     * la deuxième exécution oblige à nettoyer à la main avant chaque test.
     */
    const user = existing
      ? await trx
          .updateTable('users')
          .set({ password_hash: passwordHash, role: 'garage_owner', city: garage.city })
          .where('id', '=', existing.id)
          .returning('id')
          .executeTakeFirstOrThrow()
      : await trx
          .insertInto('users')
          .values({
            full_name: garage.name,
            phone: garage.phone as string,
            email: null,
            password_hash: passwordHash,
            role: 'garage_owner',
            city: garage.city,
            referral_code: generateReferralCode(),
          })
          .returning('id')
          .executeTakeFirstOrThrow();

    /**
     * Un compte, un garage — `garages_owner_idx` l'impose.
     *
     * On détache donc d'abord ce que ce compte détiendrait déjà : sans ça, une
     * exécution sur un second garage échouerait sur violation d'index, avec un
     * message qui ne dirait pas pourquoi.
     */
    await trx
      .updateTable('garages')
      .set({ owner_user_id: null })
      .where('owner_user_id', '=', user.id)
      .where('id', '!=', garage.id)
      .execute();

    await trx
      .updateTable('garages')
      .set({ owner_user_id: user.id })
      .where('id', '=', garage.id)
      .execute();

    return user.id;
  });

  const pending = await db
    .selectFrom('assistance_requests')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('garage_id', '=', garage.id)
    .where('status', 'in', ['selected', 'accepted', 'en_route', 'awaiting_confirmation'])
    .executeTakeFirstOrThrow();

  process.stdout.write(
    [
      `Garagiste rattaché à « ${garage.name} » (${garage.city})`,
      ``,
      `  Numéro     ${garage.phone}`,
      `  Mot de passe  ${PASSWORD}`,
      `  Compte     ${userId}`,
      `  Vérifié    ${garage.verified_at ? 'oui' : 'NON — l’onglet Interventions restera masqué'}`,
      ``,
      `  ${pending.count} demande(s) en attente dans sa file.`,
      ``,
    ].join('\n'),
  );
}

/** Détache le compte du garage sans supprimer ni l'un ni l'autre. */
async function clear(garageName: string): Promise<void> {
  const result = await db
    .updateTable('garages')
    .set({ owner_user_id: null })
    .where('name', '=', garageName)
    .executeTakeFirst();

  process.stdout.write(
    `${Number(result.numUpdatedRows ?? 0)} garage(s) détaché(s) de leur propriétaire\n`,
  );
}

const [action, name] = process.argv[2] === 'clear' ? ['clear', process.argv[3]] : ['seed', process.argv[2]];
const garageName = name ?? DEFAULT_GARAGE;

(action === 'clear' ? clear(garageName) : seed(garageName))
  .then(() => pool.end())
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
    return pool.end();
  });
