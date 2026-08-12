import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { pool } from '../../db/client';

/**
 * Tests de contrat HTTP.
 *
 * Ils ne touchent PAS la base : la validation rejette avant d'atteindre le
 * service, donc ces cas tournent partout, y compris en intégration continue
 * sans Postgres. Le comportement au-delà de la validation est couvert par
 * `garages.repo.test.ts`.
 */
const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('GET /garages/nearby — validation', () => {
  it('exige une latitude et une longitude', async () => {
    const response = await request(app).get('/garages/nearby');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(response.body.error.fields)).toEqual(
      expect.arrayContaining(['lat', 'lng']),
    );
  });

  it('rejette une position hors du Cameroun', async () => {
    // Paris : symptôme d'un GPS mal initialisé ou d'un appel malveillant.
    const response = await request(app)
      .get('/garages/nearby')
      .query({ lat: 48.8566, lng: 2.3522 });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toHaveProperty('lng');
  });

  it('rejette le point nul, qui n’est jamais une vraie position', async () => {
    const response = await request(app).get('/garages/nearby').query({ lat: 0, lng: 0 });

    expect(response.status).toBe(400);
  });

  it('rejette un tri inconnu plutôt que de retomber silencieusement sur un défaut', async () => {
    const response = await request(app)
      .get('/garages/nearby')
      .query({ lat: 3.848, lng: 11.5021, sort: 'le_moins_cher' });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toHaveProperty('sort');
  });

  it('rejette un rayon aberrant', async () => {
    const response = await request(app)
      .get('/garages/nearby')
      .query({ lat: 3.848, lng: 11.5021, radiusKm: 5000 });

    expect(response.status).toBe(400);
  });

  it('rejette une limite au-delà du plafond', async () => {
    const response = await request(app)
      .get('/garages/nearby')
      .query({ lat: 3.848, lng: 11.5021, limit: 10_000 });

    expect(response.status).toBe(400);
  });

  it('rejette un service inconnu', async () => {
    const response = await request(app)
      .get('/garages/nearby')
      .query({ lat: 3.848, lng: 11.5021, services: 'teleportation' });

    expect(response.status).toBe(400);
  });
});

describe('enveloppe d’erreur', () => {
  it('renvoie un code d’erreur structuré, jamais une chaîne brute', async () => {
    const response = await request(app).get('/route-inexistante');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
  });
});

describe('GET /health', () => {
  it('répond sans authentification', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
