import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { ALERT_SEVERITY_BY_TYPE } from '@geocras/shared';
import { api } from '../api/endpoints';
import { averageSpeedKmh, currentScore, useDrivingStore } from '../stores/driving';
import type { AlertSource } from './AlertSource';
import { SimulatedAlertSource } from './SimulatedAlertSource';

/**
 * Branche une source d'alertes sur le store de conduite.
 *
 * Le moteur vit **hors de React** : il émet, le store absorbe, les composants
 * s'abonnent par sélecteur. Un tick de vitesse à 4 Hz ne doit pas re-rendre
 * l'arbre — seulement le composant qui affiche le chiffre.
 *
 * `createSource` est injectable : le jour où de vrais capteurs arrivent, on
 * passe une autre implémentation d'`AlertSource` ici et rien d'autre ne bouge.
 */
export function useDrivingEngine(options: { createSource?: () => AlertSource } = {}) {
  const source = useRef<AlertSource | null>(null);
  const store = useDrivingStore;

  const stopEngine = useCallback(() => {
    source.current?.stop();
    source.current = null;
  }, []);

  useEffect(() => stopEngine, [stopEngine]);

  const start = useCallback(() => {
    stopEngine();

    const instance = options.createSource?.() ?? new SimulatedAlertSource();

    instance.onSpeed((sample) => {
      store.getState().tick(sample);
    });

    instance.onAlert((alert) => {
      store.getState().pushAlert({
        type: alert.type,
        atSpeedKmh: alert.atSpeedKmh,
        distanceM: alert.distanceM,
        occurredAt: alert.occurredAt,
      });

      // Retour haptique proportionné : une alerte critique doit se sentir sans
      // quitter la route des yeux, une alerte d'angle mort ne doit pas faire
      // sursauter.
      const severity = ALERT_SEVERITY_BY_TYPE[alert.type];
      void Haptics.notificationAsync(
        severity === 'critical'
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {
        // Appareil sans moteur haptique : sans conséquence.
      });
    });

    source.current = instance;
    store.getState().start();
    instance.start();
  }, [options, stopEngine, store]);

  const pause = useCallback(() => {
    source.current?.stop();
    store.getState().pause();
  }, [store]);

  const resume = useCallback(() => {
    store.getState().resume();
    source.current?.start();
  }, [store]);

  /**
   * Arrête et synchronise la session.
   *
   * L'envoi est tolérant à l'échec : la session vaut d'être conservée même si
   * le réseau est absent — le mode conduite s'utilise justement là où il n'y a
   * pas de couverture. L'idempotence côté serveur, via `clientSessionId`,
   * permet de réessayer sans créer de doublon.
   */
  const stop = useCallback(async (): Promise<{ synced: boolean }> => {
    stopEngine();

    const state = store.getState();
    const { clientSessionId, startedAt, alerts, distanceM, maxSpeedKmh, elapsedMs } = state;
    store.getState().stop();

    if (!clientSessionId || !startedAt) return { synced: false };

    try {
      await api.driving.submit({
        clientSessionId,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        distanceM: Math.round(distanceM),
        maxSpeedKmh: Math.round(maxSpeedKmh),
        avgSpeedKmh: Math.round(averageSpeedKmh(distanceM, elapsedMs)),
        score: currentScore(alerts),
        alerts: alerts.map((alert) => ({
          type: alert.type,
          severity: alert.severity,
          atSpeedKmh: alert.atSpeedKmh,
          distanceM: alert.distanceM,
          occurredAt: new Date(alert.occurredAt).toISOString(),
        })),
      });
      return { synced: true };
    } catch {
      // TODO(hors-ligne) : mettre en file locale et réessayer au retour réseau.
      return { synced: false };
    }
  }, [stopEngine, store]);

  return { start, pause, resume, stop };
}
