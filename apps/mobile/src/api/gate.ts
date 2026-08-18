/**
 * Limiteur de requêtes simultanées.
 *
 * **Le problème qu'il traite.** Un écran de l'application n'ouvre jamais une
 * seule requête : la carte demande les garages, la position inverse, la demande
 * en cours, le profil et le garage rattaché — cinq appels dans la même frame.
 * Ajoutez le tiroir, une pastille de compteur, et l'on dépasse la dizaine.
 *
 * Sur une fibre, c'est invisible. Sur le réseau mobile de Yaoundé, les dix
 * requêtes se partagent une bande passante qui n'en sert bien qu'une : chacune
 * ralentit toutes les autres, **toutes** approchent leur délai d'expiration, et
 * elles finissent par tomber ensemble. L'application se saborde elle-même, et
 * le serveur reçoit une rafale au lieu d'un flux.
 *
 * **Ce qu'il fait.** Quatre requêtes en vol au maximum ; les suivantes attendent
 * leur tour. Le total ne va pas plus vite — mais les quatre premières
 * aboutissent *vite*, donc l'écran se remplit par blocs au lieu de rester vide
 * jusqu'à ce que tout arrive. C'est la même quantité de données, ordonnée.
 *
 * Quatre, et non six comme un navigateur : un navigateur parle à un serveur
 * depuis une machine de bureau, pas depuis un téléphone d'entrée de gamme sur
 * un lien partagé.
 *
 * **Le minuteur d'expiration démarre après l'attente, pas avant.** Sans cette
 * précaution, une requête mise en file dix secondes arriverait au serveur avec
 * un budget déjà consommé, et échouerait sans avoir jamais été tentée.
 */

const MAX_IN_FLIGHT = 4;

let inFlight = 0;
const waiting: (() => void)[] = [];

function release(): void {
  const next = waiting.shift();
  if (next) {
    next();
    return;
  }
  inFlight -= 1;
}

/**
 * Exécute `task` dès qu'un créneau se libère.
 *
 * Le créneau est rendu même si la tâche lève : sans le `finally`, une seule
 * requête en erreur suffirait à réduire définitivement la capacité, et quatre
 * erreurs à figer l'application entière — le genre de panne qui n'apparaît
 * qu'après plusieurs minutes d'usage, donc jamais pendant un test.
 */
export async function throughGate<T>(task: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    inFlight += 1;
  }

  try {
    return await task();
  } finally {
    release();
  }
}

/** Nombre de requêtes qui attendent un créneau. Exposé pour les tests. */
export function gateDepth(): { inFlight: number; waiting: number } {
  return { inFlight, waiting: waiting.length };
}
