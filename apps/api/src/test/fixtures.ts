import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Service } from '@geocras/shared';
import { db, pool } from '../db/client';
import { pointFromLatLng } from '../db/geo';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

/** Applique le schéma sur une base vierge. */
export async function resetSchema(): Promise<void> {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
}

export async function truncateAll(): Promise<void> {
  await pool.query(`
    TRUNCATE garages, users, vehicles, assistance_requests, request_events,
             position_pings, reviews, loyalty_ledger, user_badges,
             driving_sessions, driving_alerts, refresh_tokens
    RESTART IDENTITY CASCADE
  `);
}

export type GarageFixture = {
  name: string;
  lat: number;
  lng: number;
  certified?: boolean;
  rating?: number;
  reviewCount?: number;
  services?: Service[];
  openingHours?: Record<string, string> | null;
  isActive?: boolean;
  /** `false` simule un dossier encore en attente de vérification. */
  verified?: boolean;
};

export async function insertGarage(fixture: GarageFixture): Promise<string> {
  const row = await db
    .insertInto('garages')
    .values({
      name: fixture.name,
      location: pointFromLatLng({ lat: fixture.lat, lng: fixture.lng }),
      certified: fixture.certified ?? false,
      certified_at: fixture.certified ? new Date() : null,
      rating: fixture.rating ?? 0,
      review_count: fixture.reviewCount ?? 0,
      services: fixture.services ?? [],
      quarter: 'Test',
      address_label: 'Test, Yaoundé',
      opening_hours:
        fixture.openingHours === undefined
          ? null
          : fixture.openingHours === null
            ? null
            : JSON.stringify(fixture.openingHours),
      // Un garage de test est vérifié sauf mention contraire : la contrainte
      // `active_requires_verification` interdit l'actif non vérifié.
      verified_at: (fixture.verified ?? true) ? new Date() : null,
      is_active: fixture.isActive ?? true,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

export async function insertGarages(fixtures: GarageFixture[]): Promise<string[]> {
  const ids: string[] = [];
  for (const fixture of fixtures) ids.push(await insertGarage(fixture));
  return ids;
}

/** Centre de Yaoundé — origine de référence de tous les tests. */
export const ORIGIN = { lat: 3.848, lng: 11.5021 };

/**
 * Décale un point d'une distance approximative vers le nord.
 * 1° de latitude ≈ 111,32 km ; suffisant pour placer des points de test à des
 * distances contrôlées sans dépendre d'un calcul exact.
 */
export function northOf(origin: { lat: number; lng: number }, meters: number) {
  return { lat: origin.lat + meters / 111_320, lng: origin.lng };
}
