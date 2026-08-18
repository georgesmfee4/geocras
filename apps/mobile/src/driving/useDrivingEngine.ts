import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { ALERT_SEVERITY_BY_TYPE, type AlertType } from '@geocras/shared';
import { api } from '../api/endpoints';
import { usePreferences } from '../settings/preferences';
import { averageSpeedKmh, currentScore, useDrivingStore } from '../stores/driving';
import type { AlertSource } from './AlertSource';
import { SimulatedAlertSource } from './SimulatedAlertSource';

/**
 * Alertes que l'interrupteur « Détection d'angle mort » gouverne.
 *
 * Typé sur `AlertType` et non sur `string` : le jour où un type d'angle mort
 * s'ajoute — un troisième rétroviseur, un capteur arrière — une faute de frappe
 * ici serait une alerte qui ignore silencieusement le réglage.
 */
const BLIND_SPOT_TYPES: ReadonlySet<AlertType> = new Set<AlertType>([
  'blind_spot_left',
  'blind_spot_right',
]);

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

  /**
   * On dépend de la fabrique, pas de l'objet qui la porte.
   *
   * `options` est un littéral : l'appelant qui écrit `useDrivingEngine()` en
   * crée un nouveau à chaque rendu, et `start` changerait donc d'identité à
   * chaque rendu — ce qui suffit à ré-armer tout `useEffect` qui l'écoute.
   */
  const createSource = options.createSource;

  const stopEngine = useCallback(() => {
    source.current?.stop();
    source.current = null;
  }, []);

  /**
   * Au démontage, la session passe en **pause** — elle ne reste pas « en
   * cours ».
   *
   * Le moteur ne survit pas à l'écran qui le porte : sans cette bascule, le
   * store garderait `phase: 'running'` avec plus rien pour l'alimenter, et un
   * retour sur l'onglet afficherait un compteur figé au dernier chiffre reçu —
   * la pire des lectures possibles sur un tableau de bord. En pause, le
   * conducteur voit ce qui s'est réellement passé et reprend d'un appui.
   */
  useEffect(
    () => () => {
      stopEngine();
      if (store.getState().phase === 'running') store.getState().pause();
    },
    [stopEngine, store],
  );

  const start = useCallback(() => {
    stopEngine();

    const instance = createSource?.() ?? new SimulatedAlertSource();

    instance.onSpeed((sample) => {
      store.getState().tick(sample);
    });

    instance.onAlert((alert) => {
      /**
       * Les réglages sont lus **à l'instant de l'alerte**, et non capturés au
       * démarrage de la session.
       *
       * Ce rappel vit hors de React : une valeur figée à `start()` resterait
       * celle d'il y a quarante minutes, et couper l'angle mort en cours de
       * route n'aurait aucun effet avant le prochain trajet.
       */
      const { drivingBlindSpot, drivingSound } = usePreferences.getState();

      // Écartée avant le store : une alerte que l'utilisateur a désactivée ne
      // doit ni s'afficher, ni entrer dans le décompte, ni peser sur le score.
      if (!drivingBlindSpot && BLIND_SPOT_TYPES.has(alert.type)) return;

      store.getState().pushAlert({
        type: alert.type,
        atSpeedKmh: alert.atSpeedKmh,
        distanceM: alert.distanceM,
        occurredAt: alert.occurredAt,
      });

      /**
       * Le signal qui traverse le pare-brise.
       *
       * Retour haptique proportionné : une alerte critique doit se sentir sans
       * quitter la route des yeux, une alerte d'angle mort ne doit pas faire
       * sursauter.
       *
       * TODO(son) : le bip court des alertes critiques attend `expo-audio` et
       * son fichier son. L'interrupteur « Alertes sonores » gouverne déjà ce
       * chemin — le jour où le son arrive, il se branche ici et le réglage n'a
       * pas à bouger.
       */
      if (!drivingSound) return;

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
  }, [createSource, stopEngine, store]);

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
