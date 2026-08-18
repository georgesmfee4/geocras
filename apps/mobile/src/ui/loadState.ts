import { ApiError } from '../api/ApiError';

/**
 * Les douze états d'un chargement.
 *
 * L'application n'en connaissait que trois — « ça tourne », « c'est là »,
 * « c'est cassé » — et c'est la raison de fond des écrans muets : avec trois
 * états, « le serveur est arrêté », « vous n'avez pas le droit », « cette fiche
 * n'existe plus » et « il n'y a rien à montrer » tombent tous dans la même case
 * et sortent le même message. L'utilisateur ne peut pas savoir s'il doit
 * attendre, se connecter, ou arrêter d'essayer.
 *
 * | État | Ce qu'il dit à l'utilisateur |
 * |---|---|
 * | `idle` | rien n'est lancé, il manque un préalable |
 * | `initializing` | l'application démarre |
 * | `loading` | première récupération |
 * | `refreshing` | on a déjà quelque chose, on le remet à jour |
 * | `processing` | votre action est en cours |
 * | `success` | c'est là |
 * | `empty` | la réponse est arrivée, elle est vide |
 * | `error` | le serveur a répondu de travers |
 * | `offline` | le serveur n'a pas été atteint |
 * | `permission_denied` | il faut un compte, ou davantage de droits |
 * | `not_found` | la ressource n'existe pas ou plus |
 * | `retrying` | nouvelle tentative en cours |
 */
export type LoadState =
  | 'idle'
  | 'initializing'
  | 'loading'
  | 'refreshing'
  | 'processing'
  | 'success'
  | 'empty'
  | 'error'
  | 'offline'
  | 'permission_denied'
  | 'not_found'
  | 'retrying';

/**
 * Ce que le résolveur a besoin de savoir.
 *
 * Volontairement **pas** le résultat de TanStack Query : une forme réduite se
 * teste sans monter de client ni de composant, et laisse la porte ouverte à une
 * source qui ne serait pas une requête — un envoi de photo, une permission
 * système, une lecture de stockage.
 */
export type LoadSnapshot = {
  /** `false` quand un préalable manque : pas de position, pas de compte. */
  enabled?: boolean;
  /** L'application n'a pas fini de démarrer. Court-circuite tout le reste. */
  initializing?: boolean;
  /** Une action de l'utilisateur est en vol — publication, envoi, suppression. */
  processing?: boolean;
  pending: boolean;
  fetching: boolean;
  error?: unknown;
  /** Nombre d'échecs de la tentative en cours. */
  failureCount?: number;
  /** A-t-on quelque chose à afficher, même périmé ? */
  hasData: boolean;
  /** La réponse est arrivée et ne contient rien. */
  empty?: boolean;
};

/**
 * Traduit une erreur d'API en état.
 *
 * Le tri se fait sur le **code**, jamais sur le message : c'est déjà la règle
 * du projet pour la traduction, et elle vaut autant ici — un message serveur
 * qui change de formulation ne doit pas changer l'écran affiché.
 */
export function stateForError(error: unknown): Extract<
  LoadState,
  'offline' | 'permission_denied' | 'not_found' | 'error'
> {
  if (!(error instanceof ApiError)) return 'error';
  if (error.code === 'NETWORK_ERROR') return 'offline';
  if (error.status === 401 || error.status === 403) return 'permission_denied';
  if (error.status === 404) return 'not_found';
  return 'error';
}

/**
 * L'état courant d'un chargement.
 *
 * **L'ordre des tests est la règle du composant, et il est délibéré.**
 *
 * Le point le moins évident vient en dernier : une erreur **ne l'emporte pas**
 * quand on a déjà des données. Un utilisateur en panne au bord de la route
 * préfère une liste de garages vieille de deux minutes à une page d'erreur, et
 * lui retirer ce qu'il voit parce qu'un rafraîchissement a échoué serait le
 * punir d'être resté. L'échec reste visible — mais par le bandeau de
 * joignabilité, qui est global, pas en effaçant l'écran.
 */
export function resolveLoadState(snapshot: LoadSnapshot): LoadState {
  const {
    enabled = true,
    initializing = false,
    processing = false,
    pending,
    fetching,
    error,
    failureCount = 0,
    hasData,
    empty = false,
  } = snapshot;

  if (initializing) return 'initializing';
  if (!enabled) return 'idle';
  if (processing) return 'processing';

  // Sans rien à montrer, l'erreur commande : c'est tout ce qu'on a à dire.
  if (error != null && !hasData) return stateForError(error);

  if (!hasData) {
    // Une seconde tentative se dit, elle ne se cache pas : sans ce cran,
    // l'attente paraît deux fois plus longue sans qu'on sache pourquoi.
    if (failureCount > 0 && fetching) return 'retrying';
    if (pending || fetching) return 'loading';
  }

  if (fetching && hasData) return 'refreshing';
  if (empty) return 'empty';
  return 'success';
}

/** Les états qui remplacent le contenu par un message. */
export type TerminalState = Extract<
  LoadState,
  'empty' | 'error' | 'offline' | 'permission_denied' | 'not_found'
>;

/**
 * L'état justifie-t-il de remplacer le contenu par un message ?
 *
 * `refreshing` et `retrying` n'en font pas partie : il y a déjà quelque chose à
 * l'écran, et le remplacer par une illustration ferait clignoter la page à
 * chaque revalidation.
 *
 * Prédicat de type et non simple booléen : il fait office de porte pour le
 * rendu, et TypeScript doit savoir qu'après elle il ne reste que cinq états —
 * sinon la table des textes de repli doit couvrir les douze, dont sept qui
 * n'affichent jamais de texte.
 */
export function isTerminal(state: LoadState): state is TerminalState {
  return (
    state === 'empty' ||
    state === 'error' ||
    state === 'offline' ||
    state === 'permission_denied' ||
    state === 'not_found'
  );
}
