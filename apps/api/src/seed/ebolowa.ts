import type { Service } from '@geocras/shared';
import { db, pool } from '../db/client';
import { pointFromLatLng } from '../db/geo';

/**
 * Trois garages à Ebolowa, pour les essais sur le terrain.
 *
 * Le parc de développement est entièrement à Yaoundé, à cent kilomètres d'ici :
 * depuis Ebolowa, **tous** les écrans tombaient sur le repli « aucun garage
 * dans ce rayon », et il fallait simuler une position pour voir quoi que ce
 * soit. Ces trois-là permettent de tester avec le vrai GPS.
 *
 * Script **séparé** de `yaounde.ts`, et non des lignes ajoutées dedans : ce
 * sont deux jeux de données de nature différente. Yaoundé est le parc de
 * lancement, Ebolowa est un jeu d'essai qu'on voudra retirer — voir `clear()`
 * plus bas. Les mélanger rendrait la suppression impossible sans trier à la
 * main.
 *
 * Les trois profils de services sont choisis pour couvrir des pannes
 * différentes, afin que le filtrage par services soit réellement observable :
 * une panne donnée ne doit pas faire remonter les trois.
 *
 *   npm run db:seed:ebolowa          insère (ou remplace)
 *   npm run db:seed:ebolowa -- clear retire uniquement ces trois garages
 */

const CITY = 'Ebolowa';

const HOURS = {
  /** Ouvert tard, fermé le dimanche après-midi. */
  extended: {
    mon: '07:00-20:00', tue: '07:00-20:00', wed: '07:00-20:00', thu: '07:00-20:00',
    fri: '07:00-20:00', sat: '07:00-18:00', sun: '09:00-14:00',
  },
  /** Horaires de bureau : sert à vérifier que le filtre « Ouverts » exclut bien. */
  weekday: {
    mon: '08:00-17:00', tue: '08:00-17:00', wed: '08:00-17:00', thu: '08:00-17:00',
    fri: '08:00-17:00', sat: 'closed', sun: 'closed',
  },
  always: {
    mon: '24h', tue: '24h', wed: '24h', thu: '24h', fri: '24h', sat: '24h', sun: '24h',
  },
} as const;

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
  hours: keyof typeof HOURS;
};

/**
 * Coordonnées plausibles à l'échelle du quartier, réparties autour du centre
 * d'Ebolowa (≈ 2,923 N / 11,161 E) à 0,8, 1,3 et 2,3 km. Assez proches pour
 * tomber dans le rayon de 15 km, assez écartées pour que la numérotation des
 * marqueurs et le tri par distance soient visibles.
 */
const GARAGES: SeedGarage[] = [
  {
    name: 'Ebolowa Auto Secours',
    quarter: "Nko'ovos",
    lat: 2.9285,
    lng: 11.165,
    certified: true,
    rating: 4.5,
    reviewCount: 63,
    // Le seul à couvrir carrosserie ET remorquage : c'est donc le seul qui
    // remonte sur une panne « Accident ».
    services: ['bodywork', 'towing', 'engine', 'electrical', 'general'],
    phone: '+237677880011',
    yearsInBusiness: 10,
    description: 'Carrosserie, remorquage et mécanique générale. Intervention sur la route de Kribi.',
    hours: 'always',
  },
  {
    name: 'Pneus & Batteries du Sud',
    quarter: 'Angalé',
    lat: 2.915,
    lng: 11.152,
    certified: false,
    rating: 3.8,
    reviewCount: 24,
    // Aucun recouvrement avec les deux autres : une crevaison ou une batterie
    // à plat ne doit faire remonter que celui-ci.
    services: ['tyre', 'battery', 'electrical'],
    phone: '+237699880022',
    yearsInBusiness: 5,
    description: 'Pneumatiques neufs et occasion, batteries, alternateurs et démarreurs.',
    hours: 'weekday',
  },
  {
    name: 'Garage Central Elat',
    quarter: 'Elat',
    lat: 2.935,
    lng: 11.178,
    certified: true,
    rating: 4.2,
    reviewCount: 41,
    services: ['engine', 'transmission', 'brakes', 'fuel', 'general'],
    phone: '+237655880033',
    yearsInBusiness: 8,
    description: 'Moteur, boîte de vitesses, freinage et injection. Banc de diagnostic.',
    hours: 'extended',
  },
];

async function seed(): Promise<void> {
  // Idempotent : on retire d'abord, pour qu'une seconde exécution ne crée pas
  // de doublons et reflète toujours le contenu du fichier.
  await clear({ silent: true });

  for (const garage of GARAGES) {
    await db
      .insertInto('garages')
      .values({
        name: garage.name,
        description: garage.description,
        phone: garage.phone,
        location: pointFromLatLng({ lat: garage.lat, lng: garage.lng }),
        address_label: `${garage.quarter}, ${CITY}`,
        quarter: garage.quarter,
        city: CITY,
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

  process.stdout.write(
    `${GARAGES.length} garages insérés à ${CITY} ` +
      `(${GARAGES.filter((g) => g.certified).length} certifiés)\n`,
  );
}

/**
 * Retire les garages d'Ebolowa, et eux seuls.
 *
 * Le filtre porte sur `city` : c'est ce qui permet de nettoyer le jeu d'essai
 * sans toucher au parc de Yaoundé, et c'est la raison pour laquelle ces
 * garages ne sont pas mélangés au seed principal.
 */
async function clear({ silent = false } = {}): Promise<void> {
  const result = await db.deleteFrom('garages').where('city', '=', CITY).executeTakeFirst();
  if (!silent) {
    process.stdout.write(`${Number(result.numDeletedRows ?? 0)} garages retirés de ${CITY}\n`);
  }
}

const action = process.argv[2] === 'clear' ? clear : seed;

action()
  .then(() => pool.end())
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
    return pool.end();
  });
