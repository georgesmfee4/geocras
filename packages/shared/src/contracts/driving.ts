import { z } from 'zod';
import { paginatedSchema, uuidSchema } from './common';

/**
 * Mode conduite. En v1 les alertes sont SIMULÉES, mais le contrat ci-dessous ne
 * le dit nulle part : il décrit ce qu'est une alerte, pas d'où elle vient.
 * Brancher de vrais capteurs plus tard ne doit rien changer ici.
 */
export const ALERT_TYPES = [
  'red_light',
  'obstacle',
  'blind_spot_left',
  'blind_spot_right',
  'side_impact',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ['critical', 'warning', 'info'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_LABELS: Readonly<
  Record<AlertType, { fr: { title: string; subtitle: string }; en: { title: string; subtitle: string } }>
> = {
  red_light: {
    fr: { title: 'Feu rouge devant', subtitle: 'Ralentissez maintenant' },
    en: { title: 'Red light ahead', subtitle: 'Slow down now' },
  },
  obstacle: {
    fr: { title: 'Obstacle détecté', subtitle: 'Sur votre voie' },
    en: { title: 'Obstacle detected', subtitle: 'In your lane' },
  },
  blind_spot_left: {
    fr: { title: 'Véhicule à gauche', subtitle: 'Angle mort' },
    en: { title: 'Vehicle on the left', subtitle: 'Blind spot' },
  },
  blind_spot_right: {
    fr: { title: 'Véhicule à droite', subtitle: 'Angle mort' },
    en: { title: 'Vehicle on the right', subtitle: 'Blind spot' },
  },
  side_impact: {
    fr: { title: 'Risque de choc latéral', subtitle: 'Corrigez votre trajectoire' },
    en: { title: 'Side impact risk', subtitle: 'Correct your trajectory' },
  },
};

export const ALERT_SEVERITY_BY_TYPE: Readonly<Record<AlertType, AlertSeverity>> = {
  red_light: 'critical',
  obstacle: 'critical',
  blind_spot_left: 'warning',
  blind_spot_right: 'warning',
  side_impact: 'critical',
};

export const drivingAlertSchema = z.object({
  type: z.enum(ALERT_TYPES),
  severity: z.enum(ALERT_SEVERITIES),
  atSpeedKmh: z.number().nonnegative(),
  /** Distance à l'événement au moment du déclenchement, en mètres. */
  distanceM: z.number().nonnegative().nullable(),
  occurredAt: z.string().datetime(),
});
export type DrivingAlert = z.infer<typeof drivingAlertSchema>;

/**
 * La session est envoyée EN BLOC à l'arrêt, pas en continu : le mode conduite
 * doit fonctionner hors couverture réseau, ce qui est la norme dès qu'on sort
 * de Yaoundé. Le mobile la conserve localement puis la synchronise.
 */
export const submitDrivingSessionBodySchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  distanceM: z.number().nonnegative(),
  maxSpeedKmh: z.number().nonnegative().max(300),
  avgSpeedKmh: z.number().nonnegative().max(300),
  /** Score 0–100 calculé côté mobile ; le serveur le recalcule et fait foi. */
  score: z.number().int().min(0).max(100),
  alerts: z.array(drivingAlertSchema).max(500),
  /** Identifiant local, rend le renvoi idempotent après une coupure réseau. */
  clientSessionId: z.string().min(8).max(64),
});
export type SubmitDrivingSessionBody = z.infer<typeof submitDrivingSessionBodySchema>;

export const drivingSessionSchema = z.object({
  id: uuidSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationS: z.number().int().nonnegative(),
  distanceM: z.number().nonnegative(),
  maxSpeedKmh: z.number(),
  avgSpeedKmh: z.number(),
  alertCount: z.number().int().nonnegative(),
  score: z.number().int().min(0).max(100),
  /** Lettre affichée dans la maquette 07 : A à E. */
  grade: z.enum(['A', 'B', 'C', 'D', 'E']),
});
export type DrivingSession = z.infer<typeof drivingSessionSchema>;

export const drivingHistoryResponseSchema = paginatedSchema(drivingSessionSchema);
export type DrivingHistoryResponse = z.infer<typeof drivingHistoryResponseSchema>;

/** Barème du score : 100 moins les pénalités, borné à 0. */
export const SCORE_PENALTIES: Readonly<Record<AlertSeverity, number>> = {
  critical: 8,
  warning: 3,
  info: 1,
};

export function scoreForAlerts(alerts: readonly { severity: AlertSeverity }[]): number {
  const penalty = alerts.reduce((sum, a) => sum + SCORE_PENALTIES[a.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function gradeForScore(score: number): DrivingSession['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}
