import {
  ALERT_SEVERITY_BY_TYPE,
  gradeForScore,
  scoreForAlerts,
  type DrivingSession,
  type SubmitDrivingSessionBody,
} from '@geocras/shared';
import { db } from '../../db/client';

function toSession(row: {
  id: string;
  started_at: Date;
  ended_at: Date;
  distance_m: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  alert_count: number;
  score: number;
}): DrivingSession {
  const startedAt = new Date(row.started_at);
  const endedAt = new Date(row.ended_at);

  return {
    id: row.id,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationS: Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)),
    distanceM: Number(row.distance_m),
    maxSpeedKmh: Number(row.max_speed_kmh),
    avgSpeedKmh: Number(row.avg_speed_kmh),
    alertCount: Number(row.alert_count),
    score: Number(row.score),
    grade: gradeForScore(Number(row.score)),
  };
}

/**
 * Enregistre une session de conduite, envoyée EN BLOC à l'arrêt.
 *
 * Deux propriétés indispensables :
 *
 *  - **Idempotence** via `(user_id, client_session_id)`. Le mode conduite
 *    fonctionne hors couverture réseau — la norme dès qu'on sort de Yaoundé —
 *    et le mobile réessaie l'envoi jusqu'à ce qu'il passe. Sans cette clé, une
 *    coupure au mauvais moment créerait des doublons dans l'historique.
 *
 *  - **Le score est recalculé côté serveur**. Celui envoyé par le mobile est
 *    indicatif : la valeur qui fait foi est dérivée des alertes reçues, sinon
 *    un client modifié pourrait s'attribuer 100 en permanence.
 */
export async function submitSession(
  userId: string,
  body: SubmitDrivingSessionBody,
): Promise<DrivingSession> {
  const alerts = body.alerts.map((alert) => ({
    ...alert,
    severity: ALERT_SEVERITY_BY_TYPE[alert.type],
  }));
  const score = scoreForAlerts(alerts);

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('driving_sessions')
      .selectAll()
      .where('user_id', '=', userId)
      .where('client_session_id', '=', body.clientSessionId)
      .executeTakeFirst();

    if (existing) return toSession(existing);

    const inserted = await trx
      .insertInto('driving_sessions')
      .values({
        user_id: userId,
        client_session_id: body.clientSessionId,
        started_at: new Date(body.startedAt),
        ended_at: new Date(body.endedAt),
        distance_m: body.distanceM,
        max_speed_kmh: body.maxSpeedKmh,
        avg_speed_kmh: body.avgSpeedKmh,
        alert_count: alerts.length,
        score,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (alerts.length > 0) {
      await trx
        .insertInto('driving_alerts')
        .values(
          alerts.map((alert) => ({
            session_id: inserted.id,
            type: alert.type,
            severity: alert.severity,
            at_speed_kmh: alert.atSpeedKmh,
            distance_m: alert.distanceM,
            occurred_at: new Date(alert.occurredAt),
          })),
        )
        .execute();
    }

    return toSession(inserted);
  });
}

export async function getSessions(userId: string, page: number, pageSize: number) {
  const total = await db
    .selectFrom('driving_sessions')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();

  const rows = await db
    .selectFrom('driving_sessions')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('started_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .execute();

  return {
    results: rows.map(toSession),
    page,
    pageSize,
    total: Number(total.count),
  };
}
