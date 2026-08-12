import { sql } from 'kysely';
import type { Service } from '@geocras/shared';
import { db, pool } from '../db/client';
import { pointFromLatLng } from '../db/geo';
import { env } from '../config/env';

/**
 * Jeu de données de développement : 30 garages répartis sur les quartiers réels
 * de Yaoundé, du centre (Bastos, Nlongkak) à la périphérie (Nkolbisson,
 * Emana, Odza).
 *
 * La dispersion est volontaire : elle permet de tester les trois tris, le
 * repli « aucun garage dans le rayon » depuis un point excentré, et la
 * numérotation des marqueurs sur une vraie carte plutôt que sur trois points
 * alignés.
 *
 * Les coordonnées sont plausibles à l'échelle du quartier, pas relevées sur le
 * terrain — c'est un jeu de développement, pas un référentiel.
 */

type SeedGarage = {
  name: string;
  quarter: string;
  lat: number;
  lng: number;
  certified: boolean;
  rating: number;
  reviewCount: number;
  services: Service[];
  phone: string;
  yearsInBusiness: number;
  description: string;
  hours: 'standard' | 'extended' | 'always' | 'weekday';
};

const HOURS = {
  standard: {
    mon: '08:00-18:00', tue: '08:00-18:00', wed: '08:00-18:00', thu: '08:00-18:00',
    fri: '08:00-18:00', sat: '08:00-14:00', sun: 'closed',
  },
  extended: {
    mon: '07:00-20:00', tue: '07:00-20:00', wed: '07:00-20:00', thu: '07:00-20:00',
    fri: '07:00-20:00', sat: '07:00-18:00', sun: '09:00-14:00',
  },
  always: {
    mon: '24h', tue: '24h', wed: '24h', thu: '24h', fri: '24h', sat: '24h', sun: '24h',
  },
  weekday: {
    mon: '08:00-17:00', tue: '08:00-17:00', wed: '08:00-17:00', thu: '08:00-17:00',
    fri: '08:00-17:00', sat: 'closed', sun: 'closed',
  },
} as const;

const GARAGES: SeedGarage[] = [
  { name: 'Garage Central Bastos', quarter: 'Bastos', lat: 3.8869, lng: 11.5089, certified: true, rating: 4.6, reviewCount: 128, services: ['engine', 'electrical', 'brakes', 'towing', 'general'], phone: '+237677101201', yearsInBusiness: 12, description: 'Atelier généraliste avec banc de diagnostic électronique et service de remorquage 24h.', hours: 'extended' },
  { name: 'Auto Bonne Route', quarter: 'Nlongkak', lat: 3.8767, lng: 11.5178, certified: true, rating: 4.4, reviewCount: 86, services: ['engine', 'transmission', 'brakes', 'general'], phone: '+237699202302', yearsInBusiness: 9, description: 'Spécialiste boîtes de vitesses et embrayages toutes marques.', hours: 'standard' },
  { name: 'Mécanique Tsinga', quarter: 'Tsinga', lat: 3.8801, lng: 11.4995, certified: false, rating: 3.9, reviewCount: 41, services: ['engine', 'tyre', 'general'], phone: '+237677303403', yearsInBusiness: 6, description: 'Petit atelier de quartier, dépannage rapide et pneumatiques.', hours: 'standard' },
  { name: 'Garage Elig-Essono', quarter: 'Elig-Essono', lat: 3.8712, lng: 11.5164, certified: true, rating: 4.7, reviewCount: 152, services: ['engine', 'electrical', 'bodywork', 'brakes', 'towing'], phone: '+237655404504', yearsInBusiness: 15, description: 'Carrosserie et mécanique lourde, cabine de peinture sur place.', hours: 'extended' },
  { name: 'Auto Service Mvog-Mbi', quarter: 'Mvog-Mbi', lat: 3.8443, lng: 11.5233, certified: false, rating: 3.6, reviewCount: 27, services: ['tyre', 'battery', 'general'], phone: '+237677505605', yearsInBusiness: 4, description: 'Pneus, batteries et petites réparations.', hours: 'standard' },
  { name: 'Garage Essos Auto', quarter: 'Essos', lat: 3.8746, lng: 11.5395, certified: true, rating: 4.3, reviewCount: 94, services: ['engine', 'electrical', 'fuel', 'general'], phone: '+237699606706', yearsInBusiness: 11, description: 'Injection diesel et essence, diagnostic assisté par ordinateur.', hours: 'extended' },
  { name: 'Omnisport Motors', quarter: 'Mfandena', lat: 3.8823, lng: 11.5289, certified: true, rating: 4.8, reviewCount: 203, services: ['engine', 'transmission', 'electrical', 'brakes', 'bodywork', 'towing', 'general'], phone: '+237677707807', yearsInBusiness: 18, description: 'Le plus grand atelier du secteur Omnisport, toutes prestations.', hours: 'always' },
  { name: 'Garage Nkoldongo', quarter: 'Nkoldongo', lat: 3.8636, lng: 11.5389, certified: false, rating: 3.4, reviewCount: 19, services: ['general', 'tyre'], phone: '+237655808908', yearsInBusiness: 3, description: 'Dépannage de proximité, interventions simples.', hours: 'standard' },
  { name: 'Mimboman Auto Clinic', quarter: 'Mimboman', lat: 3.8567, lng: 11.5455, certified: false, rating: 4.0, reviewCount: 58, services: ['engine', 'brakes', 'general'], phone: '+237677909109', yearsInBusiness: 7, description: 'Freinage, suspension et révisions périodiques.', hours: 'standard' },
  { name: 'Garage Kondengui', quarter: 'Kondengui', lat: 3.8451, lng: 11.5401, certified: false, rating: 3.7, reviewCount: 33, services: ['general', 'battery', 'electrical'], phone: '+237699010210', yearsInBusiness: 5, description: 'Électricité automobile et démarrage.', hours: 'weekday' },
  { name: 'Mokolo Pneus & Services', quarter: 'Mokolo', lat: 3.8724, lng: 11.5061, certified: true, rating: 4.2, reviewCount: 117, services: ['tyre', 'battery', 'brakes', 'general'], phone: '+237677111311', yearsInBusiness: 10, description: 'Pneumatiques neufs et occasion, équilibrage et géométrie.', hours: 'extended' },
  { name: 'Briqueterie Auto', quarter: 'Briqueterie', lat: 3.8687, lng: 11.5121, certified: false, rating: 3.5, reviewCount: 22, services: ['general', 'engine'], phone: '+237655212412', yearsInBusiness: 4, description: 'Atelier familial, mécanique générale.', hours: 'standard' },
  { name: 'Garage Madagascar', quarter: 'Madagascar', lat: 3.8564, lng: 11.5162, certified: true, rating: 4.5, reviewCount: 141, services: ['engine', 'transmission', 'electrical', 'towing', 'general'], phone: '+237677313513', yearsInBusiness: 13, description: 'Remorquage 24h et réparation toutes marques.', hours: 'always' },
  { name: 'Nsam Auto Répar', quarter: 'Nsam', lat: 3.8301, lng: 11.5099, certified: false, rating: 3.8, reviewCount: 46, services: ['engine', 'fuel', 'general'], phone: '+237699414614', yearsInBusiness: 8, description: 'Spécialiste moteurs diesel et pompes à injection.', hours: 'standard' },
  { name: 'Mvan Poids Lourds', quarter: 'Mvan', lat: 3.8158, lng: 11.5215, certified: true, rating: 4.4, reviewCount: 78, services: ['engine', 'brakes', 'transmission', 'towing', 'general'], phone: '+237677515715', yearsInBusiness: 16, description: 'Camions et véhicules utilitaires, circuits pneumatiques.', hours: 'extended' },
  { name: 'Odza Motors', quarter: 'Odza', lat: 3.8005, lng: 11.5433, certified: true, rating: 4.1, reviewCount: 64, services: ['engine', 'electrical', 'tyre', 'general'], phone: '+237655616816', yearsInBusiness: 7, description: 'Proche de l’aéroport, ouvert tôt et tard.', hours: 'extended' },
  { name: 'Garage Ahala', quarter: 'Ahala', lat: 3.7899, lng: 11.5045, certified: false, rating: 3.3, reviewCount: 15, services: ['general', 'tyre'], phone: '+237677717917', yearsInBusiness: 2, description: 'Dépannage sur l’axe sud.', hours: 'standard' },
  { name: 'Nkomo Auto Center', quarter: 'Nkomo', lat: 3.8064, lng: 11.5348, certified: false, rating: 3.9, reviewCount: 37, services: ['engine', 'battery', 'general'], phone: '+237699818118', yearsInBusiness: 6, description: 'Entretien courant et diagnostic.', hours: 'standard' },
  { name: 'Ekounou Mécanique', quarter: 'Ekounou', lat: 3.8305, lng: 11.5455, certified: false, rating: 3.6, reviewCount: 24, services: ['general', 'brakes'], phone: '+237677919219', yearsInBusiness: 5, description: 'Freins, embrayage et suspension.', hours: 'weekday' },
  { name: 'Awae Escalier Auto', quarter: 'Awae', lat: 3.8402, lng: 11.5544, certified: false, rating: 4.0, reviewCount: 51, services: ['engine', 'electrical', 'general'], phone: '+237655020320', yearsInBusiness: 9, description: 'Réparation électrique et mécanique.', hours: 'standard' },
  { name: 'Ngoa-Ekelle Auto', quarter: 'Ngoa-Ekelle', lat: 3.8611, lng: 11.4988, certified: true, rating: 4.6, reviewCount: 109, services: ['engine', 'electrical', 'brakes', 'general'], phone: '+237677121421', yearsInBusiness: 14, description: 'Atelier universitaire, tarifs étudiants.', hours: 'extended' },
  { name: 'Melen Garage Moderne', quarter: 'Melen', lat: 3.8595, lng: 11.4831, certified: true, rating: 4.2, reviewCount: 72, services: ['engine', 'transmission', 'general'], phone: '+237699222522', yearsInBusiness: 8, description: 'Boîtes automatiques et transmissions.', hours: 'standard' },
  { name: 'Obili Auto Express', quarter: 'Obili', lat: 3.8556, lng: 11.4903, certified: false, rating: 3.8, reviewCount: 39, services: ['tyre', 'battery', 'general'], phone: '+237677323623', yearsInBusiness: 5, description: 'Service rapide, vidange en 30 minutes.', hours: 'extended' },
  { name: 'Biyem-Assi Motors', quarter: 'Biyem-Assi', lat: 3.8402, lng: 11.4772, certified: true, rating: 4.5, reviewCount: 134, services: ['engine', 'electrical', 'bodywork', 'towing', 'general'], phone: '+237655424724', yearsInBusiness: 12, description: 'Carrosserie, peinture et remorquage.', hours: 'extended' },
  { name: 'Mendong Auto Plus', quarter: 'Mendong', lat: 3.8455, lng: 11.4577, certified: false, rating: 3.5, reviewCount: 28, services: ['general', 'engine'], phone: '+237677525825', yearsInBusiness: 4, description: 'Mécanique générale de quartier.', hours: 'standard' },
  { name: 'Nkolbisson Garage', quarter: 'Nkolbisson', lat: 3.8677, lng: 11.4361, certified: false, rating: 3.7, reviewCount: 31, services: ['general', 'tyre', 'battery'], phone: '+237699626926', yearsInBusiness: 6, description: 'Dernier atelier avant la sortie ouest.', hours: 'standard' },
  { name: 'Etoudi Auto Prestige', quarter: 'Etoudi', lat: 3.9068, lng: 11.5188, certified: true, rating: 4.9, reviewCount: 187, services: ['engine', 'electrical', 'transmission', 'brakes', 'bodywork', 'general'], phone: '+237677727127', yearsInBusiness: 17, description: 'Haut de gamme, véhicules récents et véhicules de fonction.', hours: 'extended' },
  { name: 'Emana Mécanique', quarter: 'Emana', lat: 3.9223, lng: 11.5089, certified: false, rating: 3.4, reviewCount: 18, services: ['general'], phone: '+237655828328', yearsInBusiness: 3, description: 'Petit atelier au nord de la ville.', hours: 'weekday' },
  { name: 'Damas Service Auto', quarter: 'Damas', lat: 3.8321, lng: 11.4899, certified: true, rating: 4.3, reviewCount: 97, services: ['engine', 'fuel', 'electrical', 'general'], phone: '+237677929529', yearsInBusiness: 10, description: 'Diagnostic électronique et injection.', hours: 'standard' },
  { name: 'Simbock Auto', quarter: 'Simbock', lat: 3.8225, lng: 11.4711, certified: false, rating: 3.2, reviewCount: 12, services: ['general', 'tyre'], phone: '+237699030730', yearsInBusiness: 2, description: 'Réparations courantes et pneumatiques.', hours: 'standard' },
];

async function seed(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Le seed est interdit en production');
  }

  const existing = await db
    .selectFrom('garages')
    .select(db.fn.countAll().as('count'))
    .executeTakeFirstOrThrow();

  if (Number(existing.count) > 0) {
    process.stdout.write(
      `${existing.count} garage(s) déjà en base — suppression avant réinsertion.\n`,
    );
    // Les demandes référencent les garages : ON DELETE SET NULL s'applique,
    // les demandes de test survivent sans garage.
    await db.deleteFrom('garages').execute();
  }

  for (const garage of GARAGES) {
    await db
      .insertInto('garages')
      .values({
        name: garage.name,
        description: garage.description,
        phone: garage.phone,
        location: pointFromLatLng({ lat: garage.lat, lng: garage.lng }),
        address_label: `${garage.quarter}, Yaoundé`,
        quarter: garage.quarter,
        city: 'Yaoundé',
        certified: garage.certified,
        certified_at: garage.certified ? new Date() : null,
        rating: garage.rating,
        review_count: garage.reviewCount,
        services: garage.services,
        specialties: [],
        photos: [],
        opening_hours: JSON.stringify(HOURS[garage.hours]),
        years_in_business: garage.yearsInBusiness,
        // Le seed est une liste vérifiée à la main : elle entre en base
        // déjà validée, sans quoi la contrainte `active_requires_verification`
        // la rejetterait.
        verified_at: new Date(),
        is_active: true,
      })
      .execute();
  }

  const certified = GARAGES.filter((g) => g.certified).length;
  process.stdout.write(
    `${GARAGES.length} garages insérés à Yaoundé ` +
      `(${certified} certifiés, ${GARAGES.length - certified} non certifiés).\n`,
  );

  // Vérification immédiate : si l'index GIST n'est pas utilisé, tout le reste
  // du produit est bâti sur une requête qui ne tiendra pas la charge.
  const plan = await sql<{ 'QUERY PLAN': string }>`
    EXPLAIN SELECT id FROM garages
    WHERE ST_DWithin(location, ${pointFromLatLng({ lat: 3.848, lng: 11.5021 })}, 5000)
  `.execute(db);

  const planText = plan.rows.map((r) => r['QUERY PLAN']).join('\n');
  process.stdout.write(
    planText.includes('garages_location_idx')
      ? 'Index géospatial GIST bien utilisé.\n'
      : `⚠ Index GIST NON utilisé — plan :\n${planText}\n`,
  );
}

seed()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    await pool.end();
    process.exit(1);
  });
