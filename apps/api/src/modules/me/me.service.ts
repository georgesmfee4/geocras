import type { PublicUser, UpdateMeBody, Vehicle, VehicleInput } from '@geocras/shared';
import { db } from '../../db/client';
import { conflict, notFound } from '../../lib/errors';
import { toPublicUser } from '../auth/auth.service';

export async function getMe(userId: string): Promise<PublicUser> {
  const row = await db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!row) throw notFound('NOT_FOUND', 'Utilisateur introuvable');
  return toPublicUser(row);
}

/**
 * Mise à jour du profil.
 *
 * Le numéro de téléphone en fait partie depuis qu'il est modifiable depuis
 * l'app. C'est le seul champ dont l'écriture peut échouer pour une raison
 * métier : il est unique en base, puisqu'il sert d'identifiant de connexion.
 * On traduit donc la violation d'unicité en `PHONE_TAKEN`, comme à
 * l'inscription — sans quoi le mobile recevrait un 500 sur un cas parfaitement
 * ordinaire, celui du numéro déjà rattaché à un autre compte.
 *
 * Les sessions ouvertes ne sont pas révoquées : le jeton porte l'identifiant
 * du compte, pas le numéro. Changer de numéro ne déconnecte donc personne, y
 * compris sur les autres appareils.
 */
export async function updateMe(userId: string, body: UpdateMeBody): Promise<PublicUser> {
  const patch: Record<string, unknown> = {};
  if (body.fullName !== undefined) patch.full_name = body.fullName;
  if (body.phone !== undefined) patch.phone = body.phone;
  if (body.email !== undefined) patch.email = body.email;
  if (body.avatarUrl !== undefined) patch.avatar_url = body.avatarUrl;
  if (body.city !== undefined) patch.city = body.city;
  if (body.locale !== undefined) patch.locale = body.locale;

  if (Object.keys(patch).length === 0) return getMe(userId);

  let row;
  try {
    row = await db
      .updateTable('users')
      .set(patch)
      .where('id', '=', userId)
      .returningAll()
      .executeTakeFirst();
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('users_phone_key')) {
      throw conflict('PHONE_TAKEN', 'Ce numéro est déjà utilisé');
    }
    if (message.includes('users_email_key')) {
      throw conflict('PHONE_TAKEN', 'Cet e-mail est déjà utilisé');
    }
    throw error;
  }

  if (!row) throw notFound('NOT_FOUND', 'Utilisateur introuvable');
  return toPublicUser(row);
}

function toVehicle(row: {
  id: string;
  type: 'car' | 'moto' | 'truck';
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  is_default: boolean;
}): Vehicle {
  return {
    id: row.id,
    type: row.type,
    brand: row.brand,
    model: row.model,
    year: row.year,
    plate: row.plate,
    isDefault: row.is_default,
  };
}

export async function listVehicles(userId: string): Promise<Vehicle[]> {
  const rows = await db
    .selectFrom('vehicles')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('is_default', 'desc')
    .orderBy('created_at', 'asc')
    .execute();

  return rows.map(toVehicle);
}

/**
 * Ajoute un véhicule.
 *
 * Le premier véhicule devient automatiquement le véhicule par défaut : sans ça,
 * un utilisateur qui n'a jamais visité l'écran Profil déclarerait une panne
 * sans véhicule rattaché.
 *
 * Le basculement du défaut se fait en transaction — l'index unique partiel
 * `vehicles_single_default_idx` rejetterait deux véhicules par défaut, et c'est
 * exactement ce qu'on veut : la contrainte protège même d'un bug ici.
 */
export async function addVehicle(userId: string, input: VehicleInput): Promise<Vehicle> {
  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('vehicles')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();

    const isFirst = Number(existing.count) === 0;

    const row = await trx
      .insertInto('vehicles')
      .values({
        user_id: userId,
        type: input.type,
        brand: input.brand,
        model: input.model,
        year: input.year,
        plate: input.plate,
        is_default: isFirst,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toVehicle(row);
  });
}

/**
 * Modification d'un véhicule.
 *
 * Remplacement complet plutôt que retouche champ par champ : la fiche tient en
 * cinq champs qu'un écran affiche tous en même temps, et un `PATCH` partiel
 * obligerait le mobile à distinguer « champ vidé » de « champ non modifié »
 * pour un gain nul.
 *
 * `is_default` n'en fait pas partie : il se change par sa propre route, qui
 * doit basculer l'ancien défaut dans la même transaction — l'index unique
 * partiel `vehicles_single_default_idx` rejetterait deux défauts.
 */
export async function updateVehicle(
  userId: string,
  vehicleId: string,
  input: VehicleInput,
): Promise<Vehicle> {
  const row = await db
    .updateTable('vehicles')
    .set({
      type: input.type,
      brand: input.brand,
      model: input.model,
      year: input.year,
      plate: input.plate,
    })
    .where('id', '=', vehicleId)
    // La propriété est dans le WHERE : impossible de modifier le véhicule d'un
    // autre compte, même en forgeant l'identifiant.
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();

  if (!row) throw notFound('VEHICLE_NOT_FOUND', 'Véhicule introuvable');
  return toVehicle(row);
}

export async function setDefaultVehicle(userId: string, vehicleId: string): Promise<Vehicle[]> {
  return db.transaction().execute(async (trx) => {
    const target = await trx
      .selectFrom('vehicles')
      .select('id')
      .where('id', '=', vehicleId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!target) throw notFound('VEHICLE_NOT_FOUND', 'Véhicule introuvable');

    // Retirer l'ancien défaut AVANT de poser le nouveau : l'ordre inverse
    // violerait momentanément l'index unique partiel.
    await trx
      .updateTable('vehicles')
      .set({ is_default: false })
      .where('user_id', '=', userId)
      .where('is_default', '=', true)
      .execute();

    await trx
      .updateTable('vehicles')
      .set({ is_default: true })
      .where('id', '=', vehicleId)
      .execute();

    const rows = await trx
      .selectFrom('vehicles')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('is_default', 'desc')
      .orderBy('created_at', 'asc')
      .execute();

    return rows.map(toVehicle);
  });
}

export async function deleteVehicle(userId: string, vehicleId: string): Promise<void> {
  const deleted = await db
    .deleteFrom('vehicles')
    .where('id', '=', vehicleId)
    .where('user_id', '=', userId)
    .returning('id')
    .executeTakeFirst();

  if (!deleted) throw notFound('VEHICLE_NOT_FOUND', 'Véhicule introuvable');
}

/**
 * Suppression définitive du compte.
 *
 * Vraie suppression, pas un drapeau `deleted_at` : le schéma est construit pour
 * ça — `ON DELETE CASCADE` emporte véhicules, jetons, demandes, avis et
 * écritures de fidélité, et le trigger `refresh_garage_rating` recalcule la
 * note des garages concernés (son commentaire mentionne explicitement la
 * suppression de compte). Un compte que l'utilisateur croit supprimé et qui
 * dort en base est une promesse non tenue.
 *
 * Deux garde-fous avant :
 *
 * 1. **Aucune intervention en cours**, côté client comme côté garage. Un
 *    garagiste déjà en route vers le véhicule verrait la demande s'évaporer,
 *    et le client n'aurait plus personne à appeler. On refuse, on dit
 *    pourquoi ; la demande s'annule en un geste sur l'écran de suivi.
 *
 * 2. **Le garage cesse d'être proposé.** La ligne n'est pas supprimée — les
 *    avis et l'historique des interventions passées la référencent, et
 *    l'effacer réécrirait le passé d'autres comptes. Mais sans propriétaire,
 *    plus personne ne peut accepter un SOS en son nom : le laisser dans les
 *    recherches enverrait des clients vers un garage qui ne répondra jamais.
 */
export async function deleteMe(userId: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const asClient = await trx
      .selectFrom('assistance_requests')
      .select('id')
      .where('client_id', '=', userId)
      .where('status', 'not in', ['closed', 'cancelled'])
      .executeTakeFirst();

    if (asClient) {
      throw conflict(
        'ACCOUNT_HAS_ACTIVE_REQUEST',
        'Une demande est en cours sur ce compte',
      );
    }

    const asGarage = await trx
      .selectFrom('assistance_requests as r')
      .innerJoin('garages as g', 'g.id', 'r.garage_id')
      .select('r.id')
      .where('g.owner_user_id', '=', userId)
      .where('r.status', 'not in', ['closed', 'cancelled'])
      .executeTakeFirst();

    if (asGarage) {
      throw conflict(
        'ACCOUNT_HAS_ACTIVE_REQUEST',
        'Une intervention est en cours sur votre garage',
      );
    }

    // Avant le DELETE, tant qu'on peut encore retrouver le garage par son
    // propriétaire : la clé étrangère le passera à NULL une ligne plus bas.
    await trx
      .updateTable('garages')
      .set({ is_active: false })
      .where('owner_user_id', '=', userId)
      .execute();

    const deleted = await trx
      .deleteFrom('users')
      .where('id', '=', userId)
      .returning('id')
      .executeTakeFirst();

    if (!deleted) throw notFound('NOT_FOUND', 'Utilisateur introuvable');
  });
}
