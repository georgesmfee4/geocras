import type { AlertType } from '@geocras/shared';
import {
  createEmitter,
  type AlertSource,
  type EmittedAlert,
  type SpeedSample,
} from './AlertSource';

/**
 * Simulation crédible de conduite urbaine.
 *
 * Deux exigences du cahier des charges gouvernent ce fichier :
 *
 *  1. **La vitesse suit une courbe réaliste** — accélérations et décélérations
 *     progressives, jamais un saut de 40 à 90 km/h en une seconde. On borne
 *     donc l'accélération en m/s², comme une vraie voiture.
 *
 *  2. **Les alertes suivent la vitesse et le temps écoulé, pas un tirage
 *     aléatoire pur** — un feu rouge apparaît quand on ralentit, un angle mort
 *     en vitesse stable, et deux alertes ne se chevauchent jamais.
 *
 * Le hasard est injectable pour que les tests soient reproductibles.
 */

type Phase = 'stopped' | 'accelerating' | 'cruising' | 'decelerating';

export type SimulationOptions = {
  tickMs?: number;
  /** Injectable pour des tests déterministes. */
  random?: () => number;
  /** Injectable pour piloter le temps en test. */
  now?: () => number;
};

/** Bornes physiques, en m/s². Une citadine ne fait pas mieux. */
const MAX_ACCELERATION = 2.2;
const MAX_DECELERATION = 3.8;

const CRUISE_SPEED_RANGE = { min: 28, max: 62 };

/** Aucune alerte ne peut suivre une autre de moins de 6 s : ce serait illisible. */
const GLOBAL_COOLDOWN_MS = 6000;
/** Un même type d'alerte ne se répète pas avant 20 s. */
const TYPE_COOLDOWN_MS = 20_000;

export class SimulatedAlertSource implements AlertSource {
  private readonly alerts = createEmitter<EmittedAlert>();
  private readonly speeds = createEmitter<SpeedSample>();

  private readonly tickMs: number;
  private readonly random: () => number;
  private readonly now: () => number;

  private timer: ReturnType<typeof setInterval> | null = null;

  private phase: Phase = 'stopped';
  private speedKmh = 0;
  private targetKmh = 0;
  private phaseEndsAt = 0;
  private lastAlertAt = 0;
  private readonly lastByType = new Map<AlertType, number>();

  constructor(options: SimulationOptions = {}) {
    this.tickMs = options.tickMs ?? 250;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  start(): void {
    if (this.timer) return;
    this.enterPhase('accelerating');
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.phase = 'stopped';
    this.speedKmh = 0;
    this.lastByType.clear();
  }

  onAlert(listener: (alert: EmittedAlert) => void): () => void {
    return this.alerts.subscribe(listener);
  }

  onSpeed(listener: (sample: SpeedSample) => void): () => void {
    return this.speeds.subscribe(listener);
  }

  /** Exposé pour les tests : avance la simulation d'un pas sans minuterie. */
  tick(): void {
    const now = this.now();

    if (now >= this.phaseEndsAt) this.advancePhase();

    this.updateSpeed();
    this.speeds.emit({ speedKmh: Math.round(this.speedKmh), deltaMs: this.tickMs });
    this.maybeEmitAlert(now);
  }

  get currentSpeedKmh(): number {
    return this.speedKmh;
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  private between(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  private enterPhase(phase: Phase): void {
    this.phase = phase;

    switch (phase) {
      case 'accelerating':
        this.targetKmh = this.between(CRUISE_SPEED_RANGE.min, CRUISE_SPEED_RANGE.max);
        this.phaseEndsAt = this.now() + this.between(6000, 12_000);
        break;
      case 'cruising':
        this.phaseEndsAt = this.now() + this.between(8000, 20_000);
        break;
      case 'decelerating':
        // On ne s'arrête pas systématiquement : ralentir pour un rond-point est
        // aussi fréquent que s'arrêter à un feu.
        this.targetKmh = this.random() < 0.55 ? 0 : this.between(10, 22);
        this.phaseEndsAt = this.now() + this.between(4000, 9000);
        break;
      case 'stopped':
        this.targetKmh = 0;
        this.phaseEndsAt = this.now() + this.between(3000, 8000);
        break;
    }
  }

  private advancePhase(): void {
    const next: Record<Phase, Phase> = {
      accelerating: 'cruising',
      cruising: 'decelerating',
      decelerating: this.targetKmh === 0 ? 'stopped' : 'accelerating',
      stopped: 'accelerating',
    };
    this.enterPhase(next[this.phase]);
  }

  /**
   * Rapproche la vitesse de sa cible en respectant une accélération bornée.
   * C'est ce qui interdit le saut de 40 à 90 km/h : sur un pas de 250 ms, la
   * variation maximale est d'environ 2 km/h.
   */
  private updateSpeed(): void {
    const seconds = this.tickMs / 1000;
    const gap = this.targetKmh - this.speedKmh;

    const limitKmh =
      (gap > 0 ? MAX_ACCELERATION : MAX_DECELERATION) * 3.6 * seconds;

    const step = Math.sign(gap) * Math.min(Math.abs(gap), limitKmh);
    this.speedKmh = Math.max(0, this.speedKmh + step);
  }

  /**
   * Choisit une alerte cohérente avec l'état de conduite.
   *
   * Aucun tirage « au hasard parmi les cinq types » : chaque alerte a des
   * conditions d'apparition. Un angle mort à l'arrêt ou un feu rouge en pleine
   * accélération détruiraient la crédibilité de la démonstration.
   */
  private maybeEmitAlert(now: number): void {
    if (now - this.lastAlertAt < GLOBAL_COOLDOWN_MS) return;

    const candidates: { type: AlertType; weight: number; distanceM: number | null }[] = [];

    if (this.phase === 'decelerating' && this.speedKmh > 12) {
      candidates.push({
        type: 'red_light',
        weight: 3,
        distanceM: Math.round(this.speedKmh * 2.2),
      });
    }

    if (this.phase === 'cruising' && this.speedKmh > 30) {
      candidates.push({ type: 'blind_spot_left', weight: 2, distanceM: null });
      candidates.push({ type: 'blind_spot_right', weight: 2, distanceM: null });
    }

    if ((this.phase === 'cruising' || this.phase === 'accelerating') && this.speedKmh > 25) {
      candidates.push({
        type: 'obstacle',
        weight: 1.5,
        distanceM: Math.round(this.between(20, 70)),
      });
    }

    if (this.phase === 'cruising' && this.speedKmh > 45) {
      candidates.push({ type: 'side_impact', weight: 0.6, distanceM: null });
    }

    const available = candidates.filter(
      (candidate) => now - (this.lastByType.get(candidate.type) ?? -Infinity) >= TYPE_COOLDOWN_MS,
    );
    if (available.length === 0) return;

    // Probabilité d'occurrence par pas : rare, sinon l'écran clignote en
    // permanence et l'utilisateur cesse de regarder les alertes.
    if (this.random() > 0.06) return;

    const totalWeight = available.reduce((sum, candidate) => sum + candidate.weight, 0);
    let draw = this.random() * totalWeight;

    const chosen =
      available.find((candidate) => {
        draw -= candidate.weight;
        return draw <= 0;
      }) ?? available[0]!;

    this.lastAlertAt = now;
    this.lastByType.set(chosen.type, now);

    this.alerts.emit({
      type: chosen.type,
      atSpeedKmh: Math.round(this.speedKmh),
      distanceM: chosen.distanceM,
      occurredAt: now,
    });
  }
}
