import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../lib/errors';

/**
 * Validation systématique avant d'atteindre un handler.
 *
 * La valeur *parsée* remplace la valeur brute : le handler reçoit des types
 * corrects (nombres coercés, valeurs par défaut appliquées) et ne fait plus
 * aucune conversion. Sans ce remplacement, `req.query.radiusKm` reste une
 * chaîne et les défauts zod ne servent à rien.
 */
function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(badRequest('Corps de requête invalide', fieldErrors(result.error.issues)));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(badRequest('Paramètres de requête invalides', fieldErrors(result.error.issues)));
      return;
    }
    // Express 5 expose `req.query` en lecture seule : on stocke la version
    // validée à côté plutôt que d'écraser la propriété.
    (req as Request & { valid: unknown }).valid = result.data;
    next();
  };
}

/** Récupère la query validée avec son type, sans cast dans le handler. */
export function validated<T>(req: Request): T {
  return (req as Request & { valid: T }).valid;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Extrait un paramètre de route en garantissant que c'est un UUID.
 *
 * Express 5 type `req.params.x` en `string | string[] | undefined`. Le caster
 * en `string` ferait passer un identifiant malformé jusqu'à Postgres, qui
 * répondrait « invalid input syntax for type uuid » — soit un 500 pour ce qui
 * est en réalité une faute de l'appelant.
 */
export function uuidParam(req: Request, name: string): string {
  const value = req.params[name as keyof typeof req.params];

  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw badRequest('Identifiant invalide', { [name]: 'UUID attendu' });
  }

  return value;
}
