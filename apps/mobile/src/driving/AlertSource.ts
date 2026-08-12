import type { AlertType } from '@geocras/shared';

export type EmittedAlert = {
  type: AlertType;
  /** Vitesse au moment du déclenchement, en km/h. */
  atSpeedKmh: number;
  /** Distance à l'événement, en mètres. `null` quand elle n'a pas de sens. */
  distanceM: number | null;
  occurredAt: number;
};

export type SpeedSample = {
  speedKmh: number;
  /** Millisecondes écoulées depuis l'échantillon précédent. */
  deltaMs: number;
};

/**
 * Source d'alertes de conduite.
 *
 * **C'est le contrat qui rend la v1 remplaçable.** En v1, la seule
 * implémentation est `SimulatedAlertSource`. Brancher de vrais capteurs plus
 * tard doit consister à écrire une seconde implémentation de cette interface —
 * sans toucher ni à l'interface, ni au store, ni à l'écran.
 *
 * D'où l'absence totale de vocabulaire de simulation ici : rien dans ce fichier
 * ne dit d'où viennent les données.
 */
export interface AlertSource {
  start(): void;
  stop(): void;
  /** S'abonne aux alertes. Renvoie la fonction de désabonnement. */
  onAlert(listener: (alert: EmittedAlert) => void): () => void;
  /** S'abonne au flux de vitesse. Renvoie la fonction de désabonnement. */
  onSpeed(listener: (sample: SpeedSample) => void): () => void;
}

/** Fabrique minimale d'émetteur, pour éviter d'importer `events` côté RN. */
export function createEmitter<T>() {
  const listeners = new Set<(value: T) => void>();

  return {
    subscribe(listener: (value: T) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(value: T): void {
      for (const listener of listeners) listener(value);
    },
    clear(): void {
      listeners.clear();
    },
  };
}
