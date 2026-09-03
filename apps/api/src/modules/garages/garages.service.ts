import { sql, type Kysely, type Transaction } from 'kysely';
import {
  estimateEtaMinutes,
  haversineMeters,
  type CreateMyGarageBody,
  type EditMyGarageBody,
  type GarageDetail,
  type GarageSummary,
  type MyGarage,
  type NearbyQuery,
  type NearbyResponse,
  type OpeningHours,
  type Service,
} from '@geocras/shared';
import { db } from '../../db/client';
import { latOf, lngOf, pointFromLatLng } from '../../db/geo';
import type { Database } from '../../db/types';
import { conflict, notFound } from '../../lib/errors';
import { findClosestGarage, findNearbyGarages, type NearbyRow } from './garages.repo';

function toSummary(row: NearbyRow): GarageSummary {
  return {
    rank: Number(row.rank),
    id: row.id,
    name: row.name,
    certified: row.certified,
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    distanceM: Math.round(Number(row.distance_m)),
    etaMin: estimateEtaMinutes(Number(row.distance_m), 'driving'),
    lat: Number(row.lat),
    lng: Number(row.lng),
    addressLabel: row.address_label,
    quarter: row.quarter,
    phone: row.phone,
    services: row.services as Service[],
    photos: row.photos,
    openNow: row.open_now,
  };
}

/**
 * Recherche de garages proches.
 *
 * Quand le rayon demandé ne rend rien, on ne renvoie pas une liste vide : on
 * remonte le garage le plus proche dans `fallback` avec `meta.widened = true`.
 * Le mobile affiche alors « aucun garage dans 15 km, voici le plus proche à
 * 23 km » plutôt qu'un écran vide — ce qui, au bord de la route, est la
 * différence entre une app utile et une app qu'on désinstalle.
 */
export async function searchNearby(
  query: NearbyQuery,
  /**
   * Options **non exposées au réseau**.
   *
   * Second paramètre plutôt qu'un champ de `NearbyQuery` : ce type est celui du
   * corps validé par zod, et y ajouter `excludeOwnedBy` permettrait à un client
   * de choisir qui exclure de sa propre recherche. Ici, la valeur ne peut venir
   * que du serveur.
   */
  options: { excludeOwnedBy?: string | null } = {},
): Promise<NearbyResponse> {
  const origin = { lat: query.lat, lng: query.lng };
  const params = {
    origin,
    radiusMeters: query.radiusKm * 1000,
    sort: query.sort,
    limit: query.limit,
    services: query.services as readonly Service[] | undefined,
    matchAny: query.matchAny,
    openNow: query.openNow,
    certifiedOnly: query.certifiedOnly,
    excludeOwnedBy: options.excludeOwnedBy ?? null,
  };

  const rows = await findNearbyGarages(db, params);

  if (rows.length > 0) {
    return {
      results: rows.map(toSummary),
      fallback: null,
      meta: {
        sort: query.sort,
        radiusKm: query.radiusKm,
        count: rows.length,
        widened: false,
      },
    };
  }

  const closest = await findClosestGarage(db, {
    origin,
    radiusMeters: params.radiusMeters,
    services: params.services,
    // Même sémantique que la recherche principale : un repli plus strict que
    // la requête qu'il remplace n'aurait aucun sens.
    matchAny: params.matchAny,
    // Le repli ignore volontairement les filtres de confort : un garage fermé,
    // ou non certifié, joignable à 20 km vaut mieux qu'un écran vide.
    openNow: false,
    certifiedOnly: false,
    /*
      L'exclusion du propriétaire, elle, **n'est pas un filtre de confort** et
      survit donc au repli.

      C'est même ici qu'elle compte le plus : le repli se déclenche quand rien
      n'a été trouvé dans le rayon, c'est-à-dire précisément la situation où le
      garage le plus proche d'un garagiste en panne est le sien. L'oublier
      aurait laissé le seul chemin par lequel le cas se produit vraiment.
    */
    excludeOwnedBy: params.excludeOwnedBy,
  });

  return {
    results: [],
    fallback: closest ? toSummary(closest) : null,
    meta: {
      sort: query.sort,
      radiusKm: query.radiusKm,
      count: 0,
      widened: closest !== null,
    },
  };
}

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Fiche complète d'un garage.
 *
 * `origin` est facultatif : la fiche est consultable depuis l'historique, où
 * l'utilisateur n'est plus au même endroit qu'au moment de la panne. Sans
 * origine, la distance vaut 0 et le mobile n'affiche simplement pas la ligne.
 */
export async function getGarageDetail(
  garageId: string,
  origin: { lat: number; lng: number } | null,
): Promise<GarageDetail> {
  const garage = await db
    .selectFrom('garages as g')
    .select([
      'g.id',
      'g.name',
      'g.description',
      'g.certified',
      'g.phone',
      'g.address_label',
      'g.quarter',
      'g.services',
      'g.photos',
      'g.review_count',
      'g.opening_hours',
      'g.years_in_business',
      sql<number>`g.rating::float8`.as('rating'),
      latOf('g.location').as('lat'),
      lngOf('g.location').as('lng'),
      sql<boolean>`garage_is_open(g.opening_hours, now())`.as('open_now'),
    ])
    .where('g.id', '=', garageId)
    .where('g.is_active', '=', true)
    .executeTakeFirst();

  if (!garage) throw notFound('GARAGE_NOT_FOUND', 'Garage introuvable');

  const reviews = await db
    .selectFrom('reviews as rev')
    .innerJoin('users as u', 'u.id', 'rev.user_id')
    .select(['rev.id', 'rev.rating', 'rev.comment', 'rev.created_at', 'u.full_name'])
    .where('rev.garage_id', '=', garageId)
    .orderBy('rev.created_at', 'desc')
    .limit(3)
    .execute();

  const lat = Number(garage.lat);
  const lng = Number(garage.lng);
  const distanceM = origin ? Math.round(haversineMeters(origin, { lat, lng })) : 0;

  return {
    id: garage.id,
    name: garage.name,
    description: garage.description,
    certified: garage.certified,
    rating: Number(garage.rating),
    reviewCount: garage.review_count,
    distanceM,
    etaMin: estimateEtaMinutes(distanceM, 'driving'),
    lat,
    lng,
    addressLabel: garage.address_label,
    quarter: garage.quarter,
    phone: garage.phone,
    services: garage.services as Service[],
    photos: garage.photos,
    openNow: garage.open_now,
    openingHours: (garage.opening_hours as OpeningHours | null) ?? null,
    yearsInBusiness: garage.years_in_business,
    recentReviews: reviews.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      authorName: row.full_name,
      authorInitials: initialsOf(row.full_name),
      createdAt: new Date(row.created_at).toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Le garage vu par son propriétaire
// ---------------------------------------------------------------------------

/**
 * Sélection commune aux trois opérations propriétaire.
 *
 * `is_active` en fait partie, contrairement à la fiche publique : c'est le
 * réglage que le garagiste vient consulter et changer. Et aucun filtre
 * `is_active = true` ici — un garage fermé doit rester visible **de son
 * propriétaire**, sinon il ne pourrait plus le rouvrir.
 */
const MY_GARAGE_COLUMNS = [
  'g.id',
  'g.name',
  'g.phone',
  'g.email',
  'g.description',
  'g.address_label',
  'g.quarter',
  'g.city',
  'g.certified',
  'g.review_count',
  'g.services',
  'g.photos',
  'g.opening_hours',
  'g.years_in_business',
  'g.verified_at',
  'g.is_active',
] as const;

type MyGarageRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  address_label: string | null;
  quarter: string | null;
  city: string;
  certified: boolean;
  review_count: number;
  services: string[];
  photos: string[];
  opening_hours: Record<string, string> | null;
  years_in_business: number | null;
  verified_at: Date | null;
  is_active: boolean;
  rating: number;
  lat: number;
  lng: number;
};

function toMyGarage(row: MyGarageRow): MyGarage {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    description: row.description,
    addressLabel: row.address_label,
    quarter: row.quarter,
    city: row.city,
    lat: Number(row.lat),
    lng: Number(row.lng),
    services: row.services as Service[],
    photos: row.photos,
    openingHours: (row.opening_hours as OpeningHours | null) ?? null,
    yearsInBusiness: row.years_in_business,
    certified: row.certified,
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    verifiedAt: row.verified_at === null ? null : new Date(row.verified_at).toISOString(),
    isActive: row.is_active,
  };
}

function selectMyGarage(executor: Kysely<Database> | Transaction<Database>) {
  return executor.selectFrom('garages as g').select([
    ...MY_GARAGE_COLUMNS,
    sql<number>`g.rating::float8`.as('rating'),
    latOf('g.location').as('lat'),
    lngOf('g.location').as('lng'),
  ]);
}

/**
 * Garage rattaché à un compte, ou `null`.
 *
 * `null` n'est pas une erreur : c'est la réponse pour l'immense majorité des
 * comptes, qui sont des clients.
 */
export async function getOwnedGarage(userId: string): Promise<MyGarage | null> {
  const row = await selectMyGarage(db)
    .where('g.owner_user_id', '=', userId)
    .executeTakeFirst();

  return row ? toMyGarage(row as MyGarageRow) : null;
}

/**
 * Inscription d'un garage, et promotion du compte qui le crée.
 *
 * Les deux vont ensemble et dans la même transaction : un garage sans
 * propriétaire promu serait invisible dans « Mon garage », et un compte promu
 * sans garage ouvrirait un onglet Interventions qui ne recevrait jamais rien.
 *
 * Le garage entre **en attente de vérification** : `verified_at` est nul, donc
 * `is_active` doit l'être aussi — la contrainte SQL ne laisse pas le choix. Il
 * n'apparaît dans aucune recherche tant que le dossier n'est pas contrôlé, ce
 * qui est la seule façon d'empêcher qu'un garage déclaré depuis un canapé
 * reçoive un SOS.
 *
 * La certification, elle, ne se joue pas ici : vérifier, c'est constater que le
 * garage existe ; certifier, c'est répondre de sa qualité.
 *
 * Le rôle `admin` n'est pas écrasé : un administrateur qui inscrit un garage
 * reste administrateur.
 */
export async function createOwnedGarage(
  userId: string,
  body: CreateMyGarageBody,
): Promise<MyGarage> {
  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('garages')
      .select('id')
      .where('owner_user_id', '=', userId)
      .executeTakeFirst();

    if (existing) {
      throw conflict('GARAGE_ALREADY_OWNED', 'Ce compte gère déjà un garage');
    }

    const inserted = await trx
      .insertInto('garages')
      .values({
        owner_user_id: userId,
        name: body.name,
        description: body.description,
        phone: body.phone,
        location: pointFromLatLng({ lat: body.lat, lng: body.lng }),
        address_label: body.addressLabel,
        quarter: body.quarter,
        city: body.city,
        email: body.email,
        services: body.services as string[],
        photos: body.photos,
        opening_hours: body.openingHours === null ? null : JSON.stringify(body.openingHours),
        years_in_business: body.yearsInBusiness,
        is_active: false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('users')
      .set({ role: 'garage_owner' })
      .where('id', '=', userId)
      .where('role', '=', 'client')
      .execute();

    const row = await selectMyGarage(trx)
      .where('g.id', '=', inserted.id)
      .executeTakeFirstOrThrow();

    return toMyGarage(row as MyGarageRow);
  });
}

/**
 * Dossier en cours d'examen, verrou de toute correction.
 *
 * Les deux opérations qui suivent — corriger, retirer — ne valent que **tant
 * que la vérification n'a pas eu lieu**. C'est la seule fenêtre où le dossier
 * n'engage personne : le garage n'est visible de personne, aucun client ne
 * l'a choisi, aucun avis ne s'y rattache.
 *
 * Après, le refus n'est pas une gêne administrative : l'adresse et le numéro
 * ont été contrôlés un par un, et des clients les voient. Un garagiste vérifié
 * qui veut fermer boutique ferme sa détection — ses avis, sa note et son
 * historique lui restent, et le lien reste valide pour les demandes passées.
 */
async function ownedPendingGarage(
  trx: Transaction<Database>,
  userId: string,
): Promise<{ id: string }> {
  const owned = await trx
    .selectFrom('garages')
    .select(['id', 'verified_at'])
    .where('owner_user_id', '=', userId)
    .executeTakeFirst();

  if (!owned) throw notFound('GARAGE_NOT_FOUND', 'Aucun garage rattaché à ce compte');

  if (owned.verified_at !== null) {
    throw conflict(
      'GARAGE_ALREADY_VERIFIED',
      'Votre garage est déjà vérifié : son dossier ne se modifie plus depuis l’application',
    );
  }

  return { id: owned.id };
}

/**
 * Correction du dossier.
 *
 * Remplacement complet et non retouche champ par champ : le formulaire renvoie
 * ce qu'il affiche, ce qui évite d'avoir à deviner côté serveur ce que
 * l'utilisateur a voulu effacer — un champ vidé et un champ non transmis se
 * ressemblent trop.
 *
 * `is_active` n'est pas touché, et ne peut pas l'être : la contrainte
 * `active_requires_verification` l'interdit tant que `verified_at` est nul.
 * Corriger son dossier ne rend donc jamais un garage visible par mégarde.
 */
export async function updateOwnedGarage(
  userId: string,
  body: EditMyGarageBody,
): Promise<MyGarage> {
  return db.transaction().execute(async (trx) => {
    const owned = await ownedPendingGarage(trx, userId);

    await trx
      .updateTable('garages')
      .set({
        name: body.name,
        description: body.description,
        phone: body.phone,
        location: pointFromLatLng({ lat: body.lat, lng: body.lng }),
        address_label: body.addressLabel,
        quarter: body.quarter,
        city: body.city,
        email: body.email,
        services: body.services as string[],
        photos: body.photos,
        opening_hours: body.openingHours === null ? null : JSON.stringify(body.openingHours),
        years_in_business: body.yearsInBusiness,
      })
      .where('id', '=', owned.id)
      .execute();

    const row = await selectMyGarage(trx).where('g.id', '=', owned.id).executeTakeFirstOrThrow();

    return toMyGarage(row as MyGarageRow);
  });
}

/**
 * Retrait du dossier, et retour du compte à son état de client.
 *
 * Les deux vont ensemble, dans la même transaction : un compte resté
 * `garage_owner` sans garage se verrait proposer « Mon garage » sur un garage
 * qui n'existe plus, et l'invitation à s'inscrire ne reviendrait jamais.
 *
 * Le rôle `admin` n'est pas rétrogradé — symétrique de l'inscription, qui ne
 * l'écrase pas non plus.
 *
 * Suppression sèche, sans archive : un dossier jamais vérifié n'a produit
 * aucune donnée à conserver. Les deux clés étrangères qui pointent vers un
 * garage — demandes et avis — ne peuvent rien contenir ici, puisqu'il n'a
 * jamais été proposé à personne.
 */
export async function deleteOwnedGarage(userId: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const owned = await ownedPendingGarage(trx, userId);

    await trx.deleteFrom('garages').where('id', '=', owned.id).execute();

    await trx
      .updateTable('users')
      .set({ role: 'client' })
      .where('id', '=', userId)
      .where('role', '=', 'garage_owner')
      .execute();
  });
}

/**
 * Ouverture ou fermeture de la détection.
 *
 * C'est le seul réglage modifiable depuis le mobile aujourd'hui, et il est
 * réversible d'un geste : le garagiste qui ferme à midi rouvre à 14 h. Rien
 * n'est supprimé, l'historique et les avis restent.
 *
 * Le filtre porte sur le propriétaire et non sur l'identifiant du garage :
 * impossible de fermer la détection de quelqu'un d'autre, même en forgeant la
 * requête.
 *
 * Tant que le dossier n'est pas vérifié, l'interrupteur n'a rien à commander :
 * on répond `GARAGE_NOT_VERIFIED` plutôt que de laisser la contrainte SQL
 * renvoyer une erreur de base illisible pour le mobile.
 */
export async function setOwnedGarageActive(userId: string, isActive: boolean): Promise<MyGarage> {
  const owned = await db
    .selectFrom('garages')
    .select(['id', 'verified_at'])
    .where('owner_user_id', '=', userId)
    .executeTakeFirst();

  if (!owned) throw notFound('GARAGE_NOT_FOUND', 'Aucun garage rattaché à ce compte');

  if (owned.verified_at === null) {
    throw conflict('GARAGE_NOT_VERIFIED', 'Votre garage est en cours de vérification');
  }

  const updated = await db
    .updateTable('garages')
    .set({ is_active: isActive })
    .where('owner_user_id', '=', userId)
    .returning('id')
    .executeTakeFirst();

  if (!updated) throw notFound('GARAGE_NOT_FOUND', 'Aucun garage rattaché à ce compte');

  const row = await selectMyGarage(db)
    .where('g.id', '=', updated.id)
    .executeTakeFirstOrThrow();

  return toMyGarage(row as MyGarageRow);
}
