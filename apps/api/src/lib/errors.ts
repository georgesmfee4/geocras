import type { ErrorCode } from '@geocras/shared';

/**
 * Erreur métier porteuse d'un code stable.
 *
 * Le mobile traduit sur le CODE, jamais sur le message : le message est un
 * secours de journalisation, le code est le contrat. C'est ce qui permet
 * d'ajouter l'anglais sans retoucher au serveur.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields: Record<string, string> | undefined;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (message: string, fields?: Record<string, string>): AppError =>
  new AppError(400, 'VALIDATION_ERROR', message, fields);

export const unauthorized = (message = 'Authentification requise'): AppError =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Action non autorisée'): AppError =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (code: ErrorCode, message: string): AppError =>
  new AppError(404, code, message);

export const conflict = (code: ErrorCode, message: string): AppError =>
  new AppError(409, code, message);
