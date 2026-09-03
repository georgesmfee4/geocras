import { afterAll, describe, expect, it } from 'vitest';
import { db, pool } from '../../db/client';
import { buildNearbyQuery, type NearbySearchParams } from './garages.repo';

/**
 * Vérification de la requête SQL **sans base**.
 *
 * Kysely sait compiler un fragment en (texte SQL, paramètres) sans l'exécuter.
 * Ça ne remplace pas les tests contre PostGIS — le plan d'exécution, lui,
 * exige un vrai serveur — mais ça verrouille tout ce qui peut l'être
 * localement : présence du filtre indexé, paramétrage effectif, application
 * conditionnelle des filtres.
 */
afterAll(async () => {
  await pool.end();
});

const base: NearbySearchParams = {
  origin: { lat: 3.848, lng: 11.5021 },
  radiusMeters: 15_000,
  sort: 'distance',
  limit: 20,
};

function compile(params: NearbySearchParams) {
  return buildNearbyQuery(params).compile(db);
}

describe('forme de la requête de proximité', () => {
  it('filtre avec ST_DWithin — c’est ce qui consomme l’index GIST', () => {
    expect(compile(base).sql).toContain('ST_DWithin');
  });

  it('calcule le rang côté serveur avec ROW_NUMBER', () => {
    const { sql: text } = compile(base);
    expect(text).toContain('ROW_NUMBER() OVER');
    expect(text).toContain('AS rank');
  });

  it('projette la distance en mètres', () => {
    expect(compile(base).sql).toContain('ST_Distance');
  });

  it('projette la latitude et la longitude explicitement', () => {
    const { sql: text } = compile(base);
    expect(text).toContain('ST_Y');
    expect(text).toContain('ST_X');
  });

  it('écarte les garages désactivés', () => {
    expect(compile(base).sql).toContain('g.is_active');
  });
});

describe('paramétrage', () => {
  it('passe les coordonnées en paramètres liés, jamais dans le texte SQL', () => {
    const { sql: text, parameters } = compile(base);

    // Si une coordonnée apparaissait littéralement dans la chaîne, c'est que
    // la valeur serait concaténée — donc injectable.
    expect(text).not.toContain('11.5021');
    expect(text).not.toContain('3.848');
    expect(parameters).toContain(11.5021);
    expect(parameters).toContain(3.848);
  });

  it('passe le tri en paramètre lié plutôt qu’en SQL concaténé', () => {
    const { sql: text, parameters } = compile({ ...base, sort: 'certified' });

    // La valeur venue du client est liée ($n). Les littéraux 'certified' et
    // 'rating' présents dans le texte sont les constantes de comparaison des
    // CASE — elles sont écrites par nous, jamais par l'appelant.
    expect(parameters).toContain('certified');
    expect(text).toMatch(/CASE WHEN \$\d+ = 'certified'/);
    expect(text).toMatch(/CASE WHEN \$\d+ = 'rating'/);
  });

  it('lie le rayon et la limite', () => {
    const { parameters } = compile({ ...base, radiusMeters: 7500, limit: 12 });
    expect(parameters).toContain(7500);
    expect(parameters).toContain(12);
  });

  it('produit le MÊME texte SQL quel que soit le tri', () => {
    // Un seul plan de requête couvre les trois tris : seule la valeur du
    // paramètre change. C'est l'intérêt des CASE neutralisés.
    const distance = compile({ ...base, sort: 'distance' }).sql;
    const rating = compile({ ...base, sort: 'rating' }).sql;
    const certified = compile({ ...base, sort: 'certified' }).sql;

    expect(rating).toBe(distance);
    expect(certified).toBe(distance);
  });
});

describe('filtres conditionnels', () => {
  it('n’ajoute pas de filtre de services quand aucun n’est demandé', () => {
    expect(compile(base).sql).not.toContain('services @>');
  });

  it('ajoute le filtre de services quand ils sont demandés', () => {
    const { sql: text, parameters } = compile({ ...base, services: ['towing', 'battery'] });

    expect(text).toContain('g.services @>');
    expect(parameters).toContainEqual(['towing', 'battery']);
  });

  it('n’ajoute pas le filtre d’ouverture quand openNow est faux', () => {
    const { sql: text } = compile({ ...base, openNow: false });
    // `garage_is_open` reste dans la projection, mais pas dans le WHERE.
    expect(text).not.toMatch(/AND\s+garage_is_open/);
  });

  it('ajoute le filtre d’ouverture quand openNow est vrai', () => {
    expect(compile({ ...base, openNow: true }).sql).toMatch(/AND\s+garage_is_open/);
  });

  it('n’ajoute pas de filtre de certification par défaut', () => {
    expect(compile(base).sql).not.toMatch(/AND\s+g\.certified/);
  });

  it('filtre sur la certification quand certifiedOnly est vrai', () => {
    // À ne pas confondre avec `sort: 'certified'`, qui relègue les non
    // certifiés au lieu de les retirer.
    expect(compile({ ...base, certifiedOnly: true }).sql).toMatch(/AND\s+g\.certified/);
  });

  it('distingue bien le filtre du tri', () => {
    const filtered = compile({ ...base, certifiedOnly: true }).sql;
    const sorted = compile({ ...base, sort: 'certified' }).sql;
    expect(filtered).not.toBe(sorted);
  });
});

describe('note bayésienne', () => {
  it('pondère la note par le nombre d’avis', () => {
    const { sql: text } = compile(base);
    expect(text).toContain('score_note');
    expect(text).toContain('review_count');
  });
});

describe('exclusion du propriétaire', () => {
  const MOI = '11111111-1111-4111-8111-111111111111';

  /**
   * Un garagiste ne se dépanne pas lui-même.
   *
   * Le filtre entre **dans la requête** et non après elle : le rang est calculé
   * par `ROW_NUMBER()`, donc écarter la ligne une fois les résultats rendus
   * laisserait un trou dans la numérotation des écussons — or le rang vient du
   * serveur et le mobile ne le recalcule jamais.
   */
  it('écarte les garages du demandeur, dans la requête elle-même', () => {
    const { sql: texte, parameters } = compile({ ...base, excludeOwnedBy: MOI });

    expect(texte).toContain('owner_user_id');
    expect(parameters).toContain(MOI);
  });

  /**
   * `IS DISTINCT FROM` et non `<>`.
   *
   * `owner_user_id` est nullable : une comparaison ordinaire rendrait NULL —
   * donc faux — sur tous les garages sans propriétaire, c'est-à-dire la
   * totalité de ceux du seed. Le filtre les aurait tous écartés et un SOS
   * n'aurait plus rien renvoyé.
   */
  it('laisse passer les garages sans propriétaire', () => {
    expect(compile({ ...base, excludeOwnedBy: MOI }).sql).toContain('IS DISTINCT FROM');
  });

  it('n’ajoute rien quand personne n’est à exclure', () => {
    expect(compile(base).sql).not.toContain('owner_user_id');
    expect(compile({ ...base, excludeOwnedBy: null }).sql).not.toContain('owner_user_id');
  });
});
