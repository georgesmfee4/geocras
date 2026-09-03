import * as Updates from 'expo-updates';
import { useCallback } from 'react';

/**
 * Mises à jour à distance (OTA).
 *
 * Le canal, l'URL et la version d'exécution vivent dans `app.json` ; ce module
 * n'est que la part visible côté écran.
 *
 * **Rien ne redémarre l'application tout seul, et c'est la règle du module.**
 * `checkAutomatically: ON_LOAD` fait chercher et télécharger la mise à jour au
 * lancement, en tâche de fond, sans jamais retarder l'ouverture
 * (`fallbackToCacheTimeout: 0`) ; le nouveau code prend au **lancement
 * suivant**. Une app qu'on ouvre au bord de la route en panne ne se recharge
 * pas sous les doigts de son utilisateur : le seul redémarrage possible est
 * celui qu'on demande explicitement depuis les réglages, écran où personne
 * n'est en train d'attendre un dépanneur.
 *
 * En développement — Expo Go, client de développement, serveur Metro —
 * `Updates.isEnabled` vaut `false` et tous les appels échoueraient. L'état
 * `disabled` existe pour ça : il se lit à l'écran plutôt que de faire croire à
 * une recherche qui n'a jamais lieu.
 */
export type OtaState =
  /** Ni build de production, ni OTA : rien à chercher. */
  | 'disabled'
  /** Rien de neuf, ou pas encore cherché. */
  | 'idle'
  /** Interrogation du serveur en cours. */
  | 'checking'
  /** Mise à jour trouvée, téléchargement en cours. */
  | 'downloading'
  /** Téléchargée : elle s'appliquera au prochain lancement, ou sur demande. */
  | 'ready'
  /** Serveur injoignable ou téléchargement interrompu. */
  | 'failed';

export type OtaUpdate = {
  state: OtaState;
  /**
   * Les huit premiers caractères de l'identifiant de la mise à jour en cours
   * d'exécution, `null` si c'est le code livré avec le binaire.
   *
   * C'est ce qu'on demande à un utilisateur au téléphone quand un bug ne se
   * reproduit pas : le numéro de version ne bouge pas d'une OTA à l'autre,
   * lui si.
   */
  buildId: string | null;
  /** Canal de publication du binaire — `production`, `preview`, `development`. */
  channel: string | null;
  /** Interroge le serveur maintenant. Sans effet hors build OTA. */
  check: () => void;
  /** Redémarre sur la mise à jour téléchargée. Sans effet tant que `state !== 'ready'`. */
  apply: () => void;
};

export function useOtaUpdate(): OtaUpdate {
  const {
    currentlyRunning,
    isUpdateAvailable,
    isUpdatePending,
    isChecking,
    isDownloading,
    checkError,
    downloadError,
  } = Updates.useUpdates();

  /**
   * On interroge et on télécharge dans le même geste.
   *
   * `checkForUpdateAsync` ne rapporte que l'existence d'une mise à jour ;
   * séparer les deux obligerait à revenir appuyer une seconde fois pour la
   * même intention — « je veux la dernière version ».
   */
  const check = useCallback(() => {
    if (!Updates.isEnabled) return;

    void Updates.checkForUpdateAsync()
      .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : null))
      // L'échec est déjà rapporté par `checkError` / `downloadError` : la
      // promesse rejetée n'a plus rien à apprendre à personne, mais non
      // rattrapée elle remonterait en avertissement console.
      .catch(() => undefined);
  }, []);

  const apply = useCallback(() => {
    if (!Updates.isEnabled || !isUpdatePending) return;
    void Updates.reloadAsync().catch(() => undefined);
  }, [isUpdatePending]);

  /**
   * L'ordre des tests est celui du cycle de vie, pas celui de l'importance :
   * « prête » l'emporte sur « en cours », sinon un téléchargement qui vient
   * de finir continuerait d'afficher sa progression. Les erreurs viennent en
   * dernier — une erreur de la recherche précédente ne doit pas masquer la
   * recherche en cours.
   */
  const state: OtaState = !Updates.isEnabled
    ? 'disabled'
    : isUpdatePending
      ? 'ready'
      : isDownloading || (isUpdateAvailable && !checkError)
        ? 'downloading'
        : isChecking
          ? 'checking'
          : checkError || downloadError
            ? 'failed'
            : 'idle';

  return {
    state,
    buildId: currentlyRunning.isEmbeddedLaunch
      ? null
      : (currentlyRunning.updateId?.slice(0, 8) ?? null),
    channel: currentlyRunning.channel ?? null,
    check,
    apply,
  };
}
