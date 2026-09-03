import { sql } from 'kysely';
import { TARIFF_XAF } from '@geocras/shared';
import { db, pool } from '../../db/client';
import { logger } from '../../lib/logger';

/**
 * Relevé du registre des commissions.
 *
 * `npm run report:commissions`
 *
 * C'est le livrable du Lot 2, et la seule raison pour laquelle le registre
 * tourne à vide pendant deux mois. Il répond à quatre questions, et ce sont
 * exactement celles qui manquaient pour fixer un barème autrement qu'à
 * l'intuition :
 *
 *  1. **combien de clients apportés** — le volume, donc le chiffre d'affaires
 *     possible ;
 *  2. **dans quelle proportion de dépannages légers et lourds** — le mélange, qui
 *     décide si un tarif à deux niveaux a du sens ou s'il en faut trois ;
 *  3. **combien de clients reviennent chez le même garage** — la fidélisation
 *     d'une paire, donc le coût réel de la remise de moitié ;
 *  4. **combien d'interventions réelles échouent à la preuve** — le taux de
 *     manque à gagner, et le signal qui dirait qu'il faut revoir les seuils.
 *
 * Le script ne modifie rien.
 */

const XAF = new Intl.NumberFormat('fr-FR');

function line(label: string, value: string, note = ''): void {
  process.stdout.write(`  ${label.padEnd(34)} ${value.padStart(12)}  ${note}\n`);
}

function title(text: string): void {
  process.stdout.write(`\n${text}\n${'─'.repeat(64)}\n`);
}

async function report(): Promise<void> {
  const month = sql<string>`to_char(created_at, 'YYYY-MM')`;

  const rows = await db
    .selectFrom('commission_ledger')
    .select(({ fn }) => [
      month.as('month'),
      fn.countAll<string>().as('interventions'),
      // `FILTER` plutôt que plusieurs requêtes : un seul passage sur la table,
      // et surtout un seul instantané — deux requêtes séparées pourraient
      // tomber de part et d'autre d'une clôture.
      sql<string>`count(*) FILTER (WHERE amount_xaf > 0)`.as('billable'),
      sql<string>`count(*) FILTER (WHERE tariff_class = 'light' AND amount_xaf > 0)`.as('light'),
      sql<string>`count(*) FILTER (WHERE tariff_class = 'heavy' AND amount_xaf > 0)`.as('heavy'),
      sql<string>`count(*) FILTER (WHERE repeat_pair)`.as('repeats'),
      sql<string>`count(*) FILTER (WHERE proof_level = 'mutual')`.as('mutual'),
      sql<string>`count(*) FILTER (WHERE proof_level = 'trail')`.as('trail'),
      sql<string>`count(*) FILTER (WHERE proof_level = 'weak')`.as('weak'),
      sql<string>`count(*) FILTER (WHERE proof_level = 'none')`.as('none'),
      sql<string>`coalesce(sum(amount_xaf), 0)`.as('revenue'),
      sql<string>`count(DISTINCT garage_id)`.as('garages'),
    ])
    .groupBy(month)
    .orderBy(month, 'desc')
    .execute();

  if (rows.length === 0) {
    process.stdout.write(
      '\nLe registre est vide. Il se remplit à chaque intervention clôturée.\n\n',
    );
    return;
  }

  for (const row of rows) {
    const total = Number(row.interventions);
    const billable = Number(row.billable);
    const revenue = Number(row.revenue);
    const missed = total - billable;

    title(`${row.month}`);

    line('Interventions clôturées', String(total), `${row.garages} garage(s)`);
    line(
      'Facturables',
      String(billable),
      total > 0 ? `${((billable / total) * 100).toFixed(0)} %` : '',
    );
    line(
      'Manque à gagner',
      String(missed),
      missed > 0 ? 'preuve insuffisante — à examiner si la part monte' : '',
    );

    process.stdout.write('\n');
    line('  dont dépannage léger', String(row.light), `${TARIFF_XAF.light} F`);
    line('  dont intervention lourde', String(row.heavy), `${TARIFF_XAF.heavy} F`);
    line(
      '  dont client déjà venu',
      String(row.repeats),
      'moitié tarif — mesure la fidélisation',
    );

    process.stdout.write('\n');
    line('Preuve mutuelle', String(row.mutual), 'trace + les deux parties');
    line('Preuve par la trace', String(row.trail), 'trace seule');
    line('Preuve faible', String(row.weak), 'sur place, mais trop court');
    line('Aucune preuve', String(row.none), 'jamais entré, ou reparti');

    process.stdout.write('\n');
    line('CHIFFRE D’AFFAIRES THÉORIQUE', `${XAF.format(revenue)} F`);
    if (billable > 0) {
      line('Panier moyen par intervention', `${XAF.format(Math.round(revenue / billable))} F`);
    }
  }

  process.stdout.write(
    '\nAucun franc n’a été prélevé : le registre est en observation.\n\n',
  );
}

report()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Relevé interrompu');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
