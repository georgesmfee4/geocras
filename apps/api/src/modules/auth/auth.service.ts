import bcrypt from 'bcryptjs';
import type {
  AuthResponse,
  AuthSession,
  ChangePasswordBody,
  LoginBody,
  PublicUser,
  SignupBody,
  UserRole,
} from '@geocras/shared';
import { db } from '../../db/client';
import { env } from '../../config/env';
import { AppError, conflict, unauthorized } from '../../lib/errors';
import type { UsersTable } from '../../db/types';
import type { Selectable } from 'kysely';
import {
  generateRefreshToken,
  generateReferralCode,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from './tokens';

type UserRow = Selectable<UsersTable>;

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    city: row.city,
    locale: row.locale,
    loyaltyPoints: row.loyalty_points,
    referralCode: row.referral_code,
  };
}

async function issueTokens(user: UserRow): Promise<AuthResponse> {
  const { token, hash } = generateRefreshToken();

  await db
    .insertInto('refresh_tokens')
    .values({ user_id: user.id, token_hash: hash, expires_at: refreshTokenExpiry() })
    .execute();

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken: token,
  };
}

/** Réessaie sur collision de code de parrainage — improbable, pas impossible. */
async function insertUserWithReferralCode(
  body: SignupBody,
  passwordHash: string,
  referredBy: string | null,
): Promise<UserRow> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await db
        .insertInto('users')
        .values({
          full_name: body.fullName,
          phone: body.phone,
          email: body.email,
          password_hash: passwordHash,
          city: body.city,
          locale: body.locale,
          referral_code: generateReferralCode(),
          referred_by: referredBy,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('users_referral_code_key')) continue;
      if (message.includes('users_phone_key')) {
        throw conflict('PHONE_TAKEN', 'Ce numéro est déjà utilisé');
      }
      if (message.includes('users_email_key')) {
        throw conflict('PHONE_TAKEN', 'Cet e-mail est déjà utilisé');
      }
      throw error;
    }
  }
  throw new Error('Impossible de générer un code de parrainage unique');
}

export async function signup(body: SignupBody): Promise<AuthResponse> {
  const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);

  let referredBy: string | null = null;
  if (body.referredByCode) {
    const sponsor = await db
      .selectFrom('users')
      .select('id')
      .where('referral_code', '=', body.referredByCode.toUpperCase())
      .executeTakeFirst();
    // Un code de parrainage erroné ne doit pas bloquer une inscription faite
    // au bord de la route : on l'ignore silencieusement.
    referredBy = sponsor?.id ?? null;
  }

  const user = await insertUserWithReferralCode(body, passwordHash, referredBy);

  if (body.vehicle) {
    await db
      .insertInto('vehicles')
      .values({
        user_id: user.id,
        type: body.vehicle.type,
        brand: body.vehicle.brand,
        model: body.vehicle.model,
        year: body.vehicle.year,
        plate: body.vehicle.plate,
        is_default: true,
      })
      .execute();
  }

  return issueTokens(user);
}

export async function login(body: LoginBody): Promise<AuthResponse> {
  const user = await db
    .selectFrom('users')
    .selectAll()
    .where('phone', '=', body.phone)
    .executeTakeFirst();

  /**
   * On hache même quand l'utilisateur n'existe pas.
   *
   * Sans ça, une réponse instantanée signale « ce numéro n'est pas inscrit » et
   * la base d'utilisateurs devient énumérable au chronomètre.
   */
  const hash = user?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const valid = await bcrypt.compare(body.password, hash);

  if (!user || !valid) {
    throw unauthorized('Numéro ou mot de passe incorrect');
  }

  return issueTokens(user);
}

/**
 * Rotation du jeton de rafraîchissement : l'ancien est révoqué à l'usage.
 * Un jeton rejoué (donc volé) ne fonctionne qu'une fois, et la victime est
 * déconnectée — ce qui rend l'attaque visible.
 */
export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  const hash = hashRefreshToken(refreshToken);

  const row = await db
    .selectFrom('refresh_tokens')
    .innerJoin('users', 'users.id', 'refresh_tokens.user_id')
    .select(['refresh_tokens.id as token_id', 'users.id as user_id', 'users.role as role'])
    .where('refresh_tokens.token_hash', '=', hash)
    .where('refresh_tokens.revoked_at', 'is', null)
    .where('refresh_tokens.expires_at', '>', new Date())
    .executeTakeFirst();

  if (!row) throw unauthorized('Session expirée, reconnectez-vous');

  return { accessToken: signAccessToken({ sub: row.user_id, role: row.role as UserRole }) };
}

export async function logout(refreshToken: string): Promise<void> {
  await db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('token_hash', '=', hashRefreshToken(refreshToken))
    .where('revoked_at', 'is', null)
    .execute();
}

/**
 * Sessions ouvertes d'un compte.
 *
 * Une ligne = un appareil qui peut renouveler son accès sans mot de passe. Les
 * jetons révoqués ou expirés n'en font pas partie : ils ne donnent plus rien,
 * les afficher ne ferait qu'inquiéter sans raison.
 */
export async function listSessions(userId: string): Promise<AuthSession[]> {
  const rows = await db
    .selectFrom('refresh_tokens')
    .select(['id', 'created_at', 'expires_at'])
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', new Date())
    .orderBy('created_at', 'desc')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  }));
}

/**
 * Ferme toutes les sessions sauf celle qui le demande.
 *
 * Révocation et non suppression : la ligne reste, horodatée, ce qui laisse une
 * trace si le compte est contesté plus tard.
 */
export async function revokeOtherSessions(
  userId: string,
  keptRefreshToken: string,
): Promise<number> {
  const result = await db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .where('token_hash', '!=', hashRefreshToken(keptRefreshToken))
    .executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0n);
}

/**
 * Changement de mot de passe.
 *
 * Trois choses dans une seule transaction, et l'ordre importe peu tant qu'elles
 * sont indivisibles : vérifier l'ancien, poser le nouveau, fermer les autres
 * sessions. Une empreinte changée sans révocation laisserait un intrus connecté
 * avec un compte dont le propriétaire croirait avoir repris le contrôle.
 */
export async function changePassword(
  userId: string,
  body: ChangePasswordBody,
): Promise<{ revoked: number }> {
  const row = await db
    .selectFrom('users')
    .select(['password_hash'])
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!row) throw unauthorized('Session expirée, reconnectez-vous');

  const valid = await bcrypt.compare(body.currentPassword, row.password_hash);
  // Même code que sur l'écran de connexion : le mobile sait déjà le traduire,
  // et « mot de passe actuel incorrect » est exactement ce qu'il dit.
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Mot de passe actuel incorrect');

  const passwordHash = await bcrypt.hash(body.newPassword, env.BCRYPT_ROUNDS);

  return db.transaction().execute(async (trx) => {
    await trx
      .updateTable('users')
      .set({ password_hash: passwordHash })
      .where('id', '=', userId)
      .execute();

    const result = await trx
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .$if(body.refreshToken !== null, (qb) =>
        qb.where('token_hash', '!=', hashRefreshToken(body.refreshToken as string)),
      )
      .executeTakeFirst();

    return { revoked: Number(result.numUpdatedRows ?? 0n) };
  });
}
