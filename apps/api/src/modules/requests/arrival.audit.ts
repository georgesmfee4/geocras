import { PROOF_LEVELS, type ProofLevel } from '@geocras/shared';
import { db, pool } from '../../db/client';
import { logger } from '../../lib/logger';
import { arrivalProofFor } from './arrival';

/**
 * Étalonnage rétroactif de la preuve d'arrivée.
 *
 * `npm run audit:arrivals`
 *
 * C'est le critère d'acceptation du Lot 1, et la raison de l'avoir construit
 * avant tout le reste : la dérivation se juge sur des interventions **déjà
 * terminées**, dont on sait par ailleurs qu'un garagiste s'est déplacé. On
 * connaît donc son comportement réel avant qu'un franc en dépende.
 *
 * Deux populations, et ce sont les deux colonnes qui comptent :
 *
 *  - les demandes **closes** — les deux parties ont confirmé une arrivée. Toute
 *    preuve qui n'y atteint pas `trail` est un **faux négatif** : un dépannage
 *    réel que l'on ne saurait pas facturer. C'est l'erreur coûteuse, celle qui
 *    fait fuir les garages honnêtes ;
 *  - les demandes **annulées** avec un garage retenu — personne n'est censé être
 *    venu. Toute preuve facturable y est un **faux positif**, c'est-à-dire une
 *    facture indue. C'est l'erreur qui casse la confiance.
 *
 * Le script ne modifie rien. Il lit, compte, et se tait sur le reste.
 */

type Bucket = Record<ProofLevel, number>;

function emptyBucket(): Bucket {
  return { none: 0, weak: 0, trail: 0, mutual: 0 };
}

function share(count: number, total: number): string {
  if (total === 0) return '   —  ';
  return `${((count / total) * 100).toFixed(1).padStart(5)} %`;
}

function render(title: string, bucket: Bucket, total: number): void {
  process.stdout.write(`\n${title} — ${total} demande(s)\n`);
  for (const level of PROOF_LEVELS) {
    const bar = '█'.repeat(Math.round((bucket[level] / Math.max(total, 1)) * 40));
    process.stdout.write(
      `  ${level.padEnd(7)} ${String(bucket[level]).padStart(5)}  ${share(bucket[level], total)}  ${bar}\n`,
    );
  }
}

async function audit(): Promise<void> {
  /*
    On lit les demandes qui ont eu un garage et qui sont terminées, dans un sens
    ou dans l'autre. Les demandes vivantes n'ont pas de fin connue : leur preuve
    serait vide par construction, et les compter fausserait les proportions.
  */
  const requests = await db
    .selectFrom('assistance_requests')
    .select(['id', 'status'])
    .where('garage_id', 'is not', null)
    .where('status', 'in', ['closed', 'cancelled'])
    .orderBy('created_at', 'asc')
    .execute();

  const closed = emptyBucket();
  const cancelled = emptyBucket();
  let closedTotal = 0;
  let cancelledTotal = 0;

  /** Les cas à regarder à la main : ils désignent une règle à revoir. */
  const falseNegatives: string[] = [];
  const falsePositives: string[] = [];

  for (const request of requests) {
    const proof = await arrivalProofFor(request.id);
    if (!proof) continue;

    if (request.status === 'closed') {
      closed[proof.level] += 1;
      closedTotal += 1;
      if (!proof.billable) falseNegatives.push(request.id);
    } else {
      cancelled[proof.level] += 1;
      cancelledTotal += 1;
      if (proof.billable) falsePositives.push(request.id);
    }
  }

  render('DEMANDES CLOSES (une arrivée a eu lieu)', closed, closedTotal);
  render('DEMANDES ANNULÉES (personne ne devrait être venu)', cancelled, cancelledTotal);

  process.stdout.write('\nCE QUI COMPTE\n');
  process.stdout.write(
    `  faux négatifs  ${String(falseNegatives.length).padStart(5)}  ${share(falseNegatives.length, closedTotal)}  dépannages réels non facturables\n`,
  );
  process.stdout.write(
    `  faux positifs  ${String(falsePositives.length).padStart(5)}  ${share(falsePositives.length, cancelledTotal)}  factures indues\n`,
  );

  // Les identifiants, pour aller regarder les traces une par une. Bornés : au
  // delà d'une dizaine, c'est la règle qu'il faut revoir, pas les cas.
  if (falseNegatives.length > 0) {
    process.stdout.write(`\n  à examiner (faux négatifs) : ${falseNegatives.slice(0, 10).join(', ')}\n`);
  }
  if (falsePositives.length > 0) {
    process.stdout.write(`  à examiner (faux positifs) : ${falsePositives.slice(0, 10).join(', ')}\n`);
  }

  process.stdout.write('\n');
}

audit()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Étalonnage interrompu');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
