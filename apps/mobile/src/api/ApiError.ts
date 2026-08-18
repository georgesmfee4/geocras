import type { ErrorCode } from '@geocras/shared';

/**
 * Erreur porteuse du code serveur — le mobile traduit sur le code.
 *
 * **Dans son propre fichier, et sans une seule dépendance.** Elle vivait dans
 * `client.ts`, qui lit la configuration, donc `expo-constants`, donc un module
 * natif : tout ce qui voulait simplement *classer* une erreur — le résolveur
 * d'état, un test — traînait derrière lui la moitié de la couche réseau et
 * devenait intestable hors d'un téléphone. Le type d'erreur est une donnée, pas
 * un service.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly fields: Record<string, string> | undefined;

  constructor(
    status: number,
    code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  /**
   * Le serveur a-t-il seulement été atteint ?
   *
   * `false` quand la socket n'a pas abouti ou que le délai a expiré. C'est la
   * distinction qui commande tout le reste : une erreur 500 mérite une seconde
   * tentative — le serveur a répondu, donc le réseau fonctionne — alors qu'un
   * délai dépassé n'en mérite aucune. Réessayer un réseau muet, c'est attendre
   * deux fois pour apprendre la même chose.
   */
  get reachedServer(): boolean {
    return this.code !== 'NETWORK_ERROR';
  }

  /**
   * Une erreur qui vaut d'être rejouée.
   *
   * **Volontairement plus étroit qu'avant.** `NETWORK_ERROR` en faisait partie,
   * et c'est ce qui produisait le symptôme : quatre tentatives à vingt secondes,
   * séparées d'un délai croissant, soit près de quatre-vingt-dix secondes de
   * roue qui tourne avant d'afficher « connexion impossible ». L'information
   * était pourtant acquise dès la première.
   */
  get isRetryable(): boolean {
    return this.status >= 500;
  }
}
