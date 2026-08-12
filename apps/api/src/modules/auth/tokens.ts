import { createHash, randomBytes, randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@geocras/shared';
import { env } from '../../config/env';
import { unauthorized } from '../../lib/errors';

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: 'geocras',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'geocras' });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw unauthorized('Jeton invalide');
    }
    return { sub: decoded.sub, role: (decoded as { role: UserRole }).role };
  } catch {
    throw unauthorized('Jeton invalide ou expiré');
  }
}

/**
 * Jeton de rafraîchissement opaque, aléatoire — pas un JWT.
 *
 * Un JWT de rafraîchissement reste valide jusqu'à expiration même après une
 * déconnexion : impossible à révoquer sans liste de blocage. Ici la vérité est
 * en base, donc « déconnecter cet appareil » est un UPDATE.
 *
 * Seul le HACHÉ est stocké : une fuite de la table ne donne aucune session.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return expiry;
}

/**
 * Code de parrainage : alphabet sans caractères ambigus (ni O/0, ni I/1/L).
 * Il est dicté au téléphone et recopié à la main — chaque ambiguïté est un
 * parrainage perdu.
 */
const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 7): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += REFERRAL_ALPHABET[randomInt(REFERRAL_ALPHABET.length)];
  }
  return code;
}
