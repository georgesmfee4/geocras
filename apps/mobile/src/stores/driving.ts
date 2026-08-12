import { create } from 'zustand';
import {
  ALERT_SEVERITY_BY_TYPE,
  gradeForScore,
  scoreForAlerts,
  type AlertSeverity,
  type AlertType,
} from '@geocras/shared';

export type SessionPhase = 'idle' | 'running' | 'paused';

export type LiveAlert = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  atSpeedKmh: number;
  distanceM: number | null;
  occurredAt: number;
};

type DrivingState = {
  phase: SessionPhase;
  clientSessionId: string | null;
  startedAt: number | null;
  /** Millisecondes réellement roulées, pauses exclues. */
  elapsedMs: number;
  speedKmh: number;
  maxSpeedKmh: number;
  distanceM: number;
  alerts: LiveAlert[];

  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  tick: (params: { speedKmh: number; deltaMs: number }) => void;
  pushAlert: (alert: Omit<LiveAlert, 'id' | 'severity'>) => void;
};

const MAX_VISIBLE_ALERTS = 30;

function newSessionId(): string {
  // `Math.random` suffit : cet identifiant sert à dédoublonner les envois d'un
  // même appareil, pas à garantir l'unicité mondiale.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * État du mode conduite.
 *
 * Séparé du store de suivi : les deux ne tournent jamais ensemble et mélanger
 * leurs abonnements ferait re-rendre le bandeau d'ETA à chaque tick de vitesse.
 *
 * Le moteur d'alertes (`src/driving/`) vit **hors de React** et se contente
 * d'appeler `pushAlert` : brancher de vrais capteurs plus tard ne touchera pas
 * à ce store.
 */
export const useDrivingStore = create<DrivingState>((set, get) => ({
  phase: 'idle',
  clientSessionId: null,
  startedAt: null,
  elapsedMs: 0,
  speedKmh: 0,
  maxSpeedKmh: 0,
  distanceM: 0,
  alerts: [],

  start: () =>
    set({
      phase: 'running',
      clientSessionId: newSessionId(),
      startedAt: Date.now(),
      elapsedMs: 0,
      speedKmh: 0,
      maxSpeedKmh: 0,
      distanceM: 0,
      alerts: [],
    }),

  pause: () => set((s) => (s.phase === 'running' ? { phase: 'paused' } : s)),
  resume: () => set((s) => (s.phase === 'paused' ? { phase: 'running' } : s)),

  stop: () => set({ phase: 'idle', speedKmh: 0 }),

  tick: ({ speedKmh, deltaMs }) => {
    if (get().phase !== 'running') return;

    set((s) => ({
      speedKmh,
      maxSpeedKmh: Math.max(s.maxSpeedKmh, speedKmh),
      elapsedMs: s.elapsedMs + deltaMs,
      distanceM: s.distanceM + (speedKmh / 3.6) * (deltaMs / 1000),
    }));
  },

  pushAlert: (alert) =>
    set((s) => ({
      alerts: [
        {
          ...alert,
          id: `${alert.occurredAt}-${alert.type}`,
          severity: ALERT_SEVERITY_BY_TYPE[alert.type],
        },
        ...s.alerts,
      ].slice(0, MAX_VISIBLE_ALERTS),
    })),
}));

/** Score courant, calculé à la volée — le serveur le recalcule et fait foi. */
export function currentScore(alerts: readonly LiveAlert[]): number {
  return scoreForAlerts(alerts);
}

export function currentGrade(alerts: readonly LiveAlert[]): 'A' | 'B' | 'C' | 'D' | 'E' {
  return gradeForScore(currentScore(alerts));
}

export function averageSpeedKmh(distanceM: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (distanceM / 1000 / (elapsedMs / 3_600_000));
}
