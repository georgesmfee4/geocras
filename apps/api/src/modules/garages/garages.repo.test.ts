import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hasDatabase } from '../../test/setup';
import { db, pool } from '../../db/client';
import {
  insertGarages,
  northOf,
  ORIGIN,
  resetSchema,
  truncateAll,
} from '../../test/fixtures';
import { explainNearby, findClosestGarage, findNearbyGarages } from './garages.repo';

/**
 * Tests de la requête géospatiale — « écris les tests des requêtes
 * géospatiales, c'est le cœur du produit » (handoff/04-BACKEND-API.md).
 *
 * Ils exigent un vrai PostGIS : voir `src/test/setup.ts`.
 */
describe.skipIf(!hasDatabase)('recherche de garages à proximité', () => {
  beforeAll(async () => {
    await resetSchema();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await db.destroy();
    await pool.end();
  });

  const baseParams = {
    origin: ORIGIN,
    radiusMeters: 15_000,
    limit: 20,
    sort: 'distance' as const,
  };

  describe('utilisation de l’index', () => {
    it('consomme l’index GIST plutôt que de parcourir la table', async () => {
      await insertGarages([
        { name: 'A', ...northOf(ORIGIN, 500) },
        { name: 'B', ...northOf(ORIGIN, 1500) },
      ]);

      const plan = await explainNearby(db, baseParams);

      // Si ce test tombe, tout le produit repose sur une requête qui
      // s'effondrera en charge : ST_DWithin doit filtrer AVANT le tri.
      expect(plan).toContain('garages_location_idx');
      expect(plan).not.toMatch(/Seq Scan on garages/);
    });
  });

  describe('numérotation des marqueurs', () => {
    it('renvoie des rangs contigus commençant à 1', async () => {
      await insertGarages([
        { name: 'A', ...northOf(ORIGIN, 3000) },
        { name: 'B', ...northOf(ORIGIN, 1000) },
        { name: 'C', ...northOf(ORIGIN, 2000) },
      ]);

      const rows = await findNearbyGarages(db, baseParams);

      expect(rows.map((r) => Number(r.rank))).toEqual([1, 2, 3]);
    });

    it('attribue le rang 1 au plus proche en tri « distance »', async () => {
      await insertGarages([
        { name: 'Loin', ...northOf(ORIGIN, 5000) },
        { name: 'Proche', ...northOf(ORIGIN, 300) },
      ]);

      const rows = await findNearbyGarages(db, baseParams);

      expect(rows[0]?.name).toBe('Proche');
      expect(Number(rows[0]?.rank)).toBe(1);
    });

    it('reste déterministe à distance égale', async () => {
      await insertGarages([
        { name: 'Jumeau A', ...northOf(ORIGIN, 1000) },
        { name: 'Jumeau B', ...northOf(ORIGIN, 1000) },
      ]);

      const first = await findNearbyGarages(db, baseParams);
      const second = await findNearbyGarages(db, baseParams);

      expect(first.map((r) => r.id)).toEqual(second.map((r) => r.id));
    });
  });

  describe('tri « certifié »', () => {
    it('place tous les certifiés avant les non certifiés', async () => {
      await insertGarages([
        { name: 'Non certifié proche', ...northOf(ORIGIN, 200), certified: false },
        { name: 'Certifié loin', ...northOf(ORIGIN, 8000), certified: true },
        { name: 'Certifié moyen', ...northOf(ORIGIN, 4000), certified: true },
      ]);

      const rows = await findNearbyGarages(db, { ...baseParams, sort: 'certified' });

      expect(rows.map((r) => r.certified)).toEqual([true, true, false]);
      // À certification égale, la distance départage.
      expect(rows[0]?.name).toBe('Certifié moyen');
    });
  });

  describe('tri « mieux noté »', () => {
    it('ne laisse pas un 5,0 à deux avis devancer un 4,6 à 128 avis', async () => {
      await insertGarages([
        { name: 'Suspect', ...northOf(ORIGIN, 500), rating: 5.0, reviewCount: 2 },
        { name: 'Établi', ...northOf(ORIGIN, 500), rating: 4.6, reviewCount: 128 },
      ]);

      const rows = await findNearbyGarages(db, { ...baseParams, sort: 'rating' });

      // C'est tout l'objet de la pondération bayésienne : deux avis
      // complaisants ne doivent pas valoir cent vingt-huit avis réels.
      expect(rows[0]?.name).toBe('Établi');
    });

    it('respecte l’ordre des notes à volume d’avis comparable', async () => {
      await insertGarages([
        { name: 'Moyen', ...northOf(ORIGIN, 500), rating: 3.5, reviewCount: 100 },
        { name: 'Excellent', ...northOf(ORIGIN, 500), rating: 4.8, reviewCount: 100 },
        { name: 'Correct', ...northOf(ORIGIN, 500), rating: 4.1, reviewCount: 100 },
      ]);

      const rows = await findNearbyGarages(db, { ...baseParams, sort: 'rating' });

      expect(rows.map((r) => r.name)).toEqual(['Excellent', 'Correct', 'Moyen']);
    });

    it('départage deux notes identiques par la distance', async () => {
      await insertGarages([
        { name: 'Même note loin', ...northOf(ORIGIN, 6000), rating: 4.5, reviewCount: 50 },
        { name: 'Même note près', ...northOf(ORIGIN, 600), rating: 4.5, reviewCount: 50 },
      ]);

      const rows = await findNearbyGarages(db, { ...baseParams, sort: 'rating' });

      expect(rows[0]?.name).toBe('Même note près');
    });
  });

  describe('changement de tri', () => {
    it('renumérote les marqueurs : le rang dépend du tri, pas du garage', async () => {
      await insertGarages([
        { name: 'Proche non certifié', ...northOf(ORIGIN, 300), certified: false, rating: 3.0, reviewCount: 50 },
        { name: 'Loin certifié bien noté', ...northOf(ORIGIN, 9000), certified: true, rating: 4.9, reviewCount: 200 },
      ]);

      const byDistance = await findNearbyGarages(db, { ...baseParams, sort: 'distance' });
      const byCertified = await findNearbyGarages(db, { ...baseParams, sort: 'certified' });
      const byRating = await findNearbyGarages(db, { ...baseParams, sort: 'rating' });

      expect(byDistance[0]?.name).toBe('Proche non certifié');
      expect(byCertified[0]?.name).toBe('Loin certifié bien noté');
      expect(byRating[0]?.name).toBe('Loin certifié bien noté');
    });
  });

  describe('rayon de recherche', () => {
    it('exclut ce qui est hors du rayon', async () => {
      await insertGarages([
        { name: 'Dedans', ...northOf(ORIGIN, 4000) },
        { name: 'Dehors', ...northOf(ORIGIN, 20_000) },
      ]);

      const rows = await findNearbyGarages(db, { ...baseParams, radiusMeters: 5000 });

      expect(rows.map((r) => r.name)).toEqual(['Dedans']);
    });

    it('mesure une distance cohérente avec la position insérée', async () => {
      await insertGarages([{ name: 'À 2 km', ...northOf(ORIGIN, 2000) }]);

      const rows = await findNearbyGarages(db, baseParams);

      expect(Number(rows[0]?.distance_m)).toBeGreaterThan(1900);
      expect(Number(rows[0]?.distance_m)).toBeLessThan(2100);
    });

    it('respecte la limite demandée', async () => {
      await insertGarages(
        Array.from({ length: 12 }, (_, i) => ({
          name: `Garage ${i}`,
          ...northOf(ORIGIN, 500 + i * 100),
        })),
      );

      const rows = await findNearbyGarages(db, { ...baseParams, limit: 5 });

      expect(rows).toHaveLength(5);
      expect(rows.map((r) => Number(r.rank))).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('garages inactifs', () => {
    it('ne renvoie jamais un garage désactivé', async () => {
      await insertGarages([
        { name: 'Actif', ...northOf(ORIGIN, 1000), isActive: true },
        { name: 'Désactivé', ...northOf(ORIGIN, 200), isActive: false },
      ]);

      const rows = await findNearbyGarages(db, baseParams);

      expect(rows.map((r) => r.name)).toEqual(['Actif']);
    });
  });

  describe('filtre « certifiés »', () => {
    it('retire les non certifiés, au lieu de les reléguer', async () => {
      await insertGarages([
        { name: 'Non certifié', ...northOf(ORIGIN, 200), certified: false },
        { name: 'Certifié', ...northOf(ORIGIN, 4000), certified: true },
      ]);

      const filtered = await findNearbyGarages(db, { ...baseParams, certifiedOnly: true });
      const sorted = await findNearbyGarages(db, { ...baseParams, sort: 'certified' });

      expect(filtered.map((r) => r.name)).toEqual(['Certifié']);
      // Le tri, lui, garde les deux.
      expect(sorted).toHaveLength(2);
    });

    it('renumérote de façon contiguë après filtrage', async () => {
      await insertGarages([
        { name: 'A', ...northOf(ORIGIN, 200), certified: false },
        { name: 'B', ...northOf(ORIGIN, 400), certified: true },
        { name: 'C', ...northOf(ORIGIN, 600), certified: false },
        { name: 'D', ...northOf(ORIGIN, 800), certified: true },
      ]);

      const rows = await findNearbyGarages(db, { ...baseParams, certifiedOnly: true });

      // Sans renumérotation serveur, les marqueurs porteraient 2 et 4.
      expect(rows.map((r) => Number(r.rank))).toEqual([1, 2]);
      expect(rows.map((r) => r.name)).toEqual(['B', 'D']);
    });
  });

  describe('filtre par service', () => {
    it('ne garde que les garages offrant TOUS les services demandés', async () => {
      await insertGarages([
        { name: 'Remorquage seul', ...northOf(ORIGIN, 500), services: ['towing'] },
        { name: 'Remorquage + batterie', ...northOf(ORIGIN, 800), services: ['towing', 'battery'] },
        { name: 'Batterie seule', ...northOf(ORIGIN, 300), services: ['battery'] },
      ]);

      const rows = await findNearbyGarages(db, {
        ...baseParams,
        services: ['towing', 'battery'],
      });

      expect(rows.map((r) => r.name)).toEqual(['Remorquage + batterie']);
    });
  });

  describe('repli quand rien n’est trouvé', () => {
    it('remonte le garage le plus proche hors rayon', async () => {
      await insertGarages([{ name: 'Très loin', ...northOf(ORIGIN, 40_000) }]);

      const inRadius = await findNearbyGarages(db, { ...baseParams, radiusMeters: 5000 });
      expect(inRadius).toHaveLength(0);

      const fallback = await findClosestGarage(db, {
        origin: ORIGIN,
        radiusMeters: 5000,
      });

      expect(fallback?.name).toBe('Très loin');
      expect(Number(fallback?.distance_m)).toBeGreaterThan(35_000);
    });

    it('renvoie null quand la base ne contient aucun garage', async () => {
      const fallback = await findClosestGarage(db, { origin: ORIGIN, radiusMeters: 5000 });
      expect(fallback).toBeNull();
    });
  });

  describe('horaires d’ouverture', () => {
    it('considère un garage sans horaires comme ouvert plutôt que de le masquer', async () => {
      await insertGarages([{ name: 'Sans horaires', ...northOf(ORIGIN, 500), openingHours: null }]);

      const rows = await findNearbyGarages(db, { ...baseParams, openNow: true });

      expect(rows.map((r) => r.name)).toEqual(['Sans horaires']);
    });

    it('exclut un garage fermé toute la semaine quand le filtre est actif', async () => {
      await insertGarages([
        {
          name: 'Toujours fermé',
          ...northOf(ORIGIN, 500),
          openingHours: {
            mon: 'closed', tue: 'closed', wed: 'closed', thu: 'closed',
            fri: 'closed', sat: 'closed', sun: 'closed',
          },
        },
        {
          name: 'Toujours ouvert',
          ...northOf(ORIGIN, 900),
          openingHours: {
            mon: '24h', tue: '24h', wed: '24h', thu: '24h',
            fri: '24h', sat: '24h', sun: '24h',
          },
        },
      ]);

      const rows = await findNearbyGarages(db, { ...baseParams, openNow: true });

      expect(rows.map((r) => r.name)).toEqual(['Toujours ouvert']);
    });

    it('ne filtre pas sur les horaires quand openNow est désactivé', async () => {
      await insertGarages([
        {
          name: 'Fermé',
          ...northOf(ORIGIN, 500),
          openingHours: {
            mon: 'closed', tue: 'closed', wed: 'closed', thu: 'closed',
            fri: 'closed', sat: 'closed', sun: 'closed',
          },
        },
      ]);

      const rows = await findNearbyGarages(db, { ...baseParams, openNow: false });

      expect(rows).toHaveLength(1);
      expect(rows[0]?.open_now).toBe(false);
    });
  });
});
