import { haversineMeters, type LatLng } from './geo';
import { ANTI_FRAUD } from './loyalty';
import { SERVICE_MODE_TRAVELLER, type PartyRole, type ServiceMode } from './taxonomy';

/**
 * Le fait facturable.
 *
 * GeoCras se rémunère en apportant des clients aux garages. Encore faut-il
 * pouvoir dire, sans discussion possible, qu'un client a bien été apporté —
 * et le dire **sans dépendre d'un bouton que le débiteur peut refuser
 * d'appuyer**.
 *
 * C'est tout l'objet de ce fichier. La clôture d'une demande exige les deux
 * confirmations d'arrivée (`closed_requires_both_arrivals`) : facturer sur elle
 * reviendrait à confier le déclencheur du chiffre d'affaires au garage, qui n'a
 * qu'à ne pas confirmer — ou qu'à demander au client de ne pas le faire. La
 * preuve est donc **dérivée de la trace GPS**, que celui qui se déplace produit
 * en faisant le trajet et qu'il ne peut supprimer qu'en ne le faisant pas.
 *
 * ---
 *
 * **Deux modes de service, une seule mesure.**
 *
 * Un dépannage se fait dans un sens ou dans l'autre : le garagiste va vers le
 * client (`on_site`), ou le client conduit jusqu'à l'atelier (`at_garage`).
 * Dans les deux cas la question est la même — *quelqu'un a-t-il réellement fait
 * un trajet et s'est-il arrêté au bout ?* — et c'est `proveArrival` qui y
 * répond, sans savoir de quel mode il s'agit.
 *
 * Ce qui change d'un mode à l'autre tient en deux valeurs : **quelle trace on
 * lit** et **vers quel point on la mesure**. `serviceGeometry()` les choisit,
 * une fois, à partir du mode. Le reste du fichier n'en entend jamais parler.
 *
 * ---
 *
 * **Une contrainte a redessiné la mesure, et il faut la connaître.**
 *
 * L'émetteur de position n'envoie un point que si le véhicule a parcouru au
 * moins `EMISSION.minMoveMeters` (quinze mètres) depuis le précédent. C'est
 * délibéré — un forfait data camerounais ne paie pas pour répéter la même
 * coordonnée — mais la conséquence est nette : **un véhicule garé cesse
 * complètement d'émettre.**
 *
 * Mesurer une présence par la densité des points sur place était donc
 * impossible : il n'y en a aucun. La durée se mesure ici entre le premier point
 * arrivé dans le rayon et la fin connue de la demande, et la présence se lit à
 * ce que la trace **se termine sur place** au lieu de repartir.
 */

export const ARRIVAL_PROOF = {
  /**
   * Rayon autour du point d'arrivée, en mètres.
   *
   * Cent cinquante, et ce n'est pas la précision visée. Le GPS d'un téléphone
   * tient dix à trente mètres en ville, davantage entre deux immeubles ; le
   * rayon doit absorber cette erreur, pas la contredire. Ce n'est pas lui qui
   * discrimine — c'est `settled` plus bas.
   */
  radiusMeters: 150,

  /**
   * Durée minimale entre l'arrivée et la fin connue de la demande.
   *
   * Quatre minutes. Elle prolonge d'une minute le `minInterventionSeconds` de
   * l'anti-fraude — même famille de seuils, même raisonnement : en dessous,
   * aucune intervention n'est plausible, et un passage devant une panne ne doit
   * pas se facturer.
   */
  minDwellSeconds: 240,

  /**
   * Distance réellement parcourue par le voyageur pendant l'approche.
   *
   * Reprise telle quelle de l'anti-fraude, qui la définit déjà pour la même
   * raison : un garage installé en face de la panne n'a apporté aucun
   * déplacement, et deux comptes complices posés côte à côte encore moins.
   *
   * Le même seuil vaut dans les deux modes, et c'est volontaire : un client qui
   * habite en face de l'atelier n'a pas davantage été « apporté » qu'un
   * garagiste qui traverse la rue. La fraude symétrique se traite
   * symétriquement.
   */
  minTravelMeters: ANTI_FRAUD.minGarageTravelMeters,
} as const;

/**
 * Ce que la trace permet d'affirmer, du plus faible au plus fort.
 *
 * Quatre crans et non un booléen : une facture se conteste, et le niveau est ce
 * qu'on produit alors. Il dit **sur quoi** on s'est fondé, pas seulement qu'on
 * s'est fondé sur quelque chose.
 */
export const PROOF_LEVELS = ['none', 'weak', 'trail', 'mutual'] as const;
export type ProofLevel = (typeof PROOF_LEVELS)[number];

/** Un point de la trace, réduit à ce que la preuve lit. */
export type ProofPing = {
  lat: number;
  lng: number;
  /** Horodatage serveur du relevé, en ISO. */
  recordedAt: string;
};

export type ArrivalProof = {
  level: ProofLevel;
  /** `trail` et `mutual` seulement. C'est cette valeur qui commande le débit. */
  billable: boolean;
  /** Premier instant où le voyageur est entré dans le rayon, en ISO. */
  arrivedAt: string | null;
  /** Distance la plus courte atteinte, en mètres. `null` sans aucun point. */
  closestMeters: number | null;
  /** Longueur du trajet réellement parcouru pendant l'approche, en mètres. */
  travelledMeters: number;
  /** Secondes entre l'arrivée et la fin connue de la demande. */
  dwellSeconds: number;
  /** La trace se termine-t-elle sur place, au lieu de repartir ? */
  settled: boolean;
};

/** Longueur cumulée d'un trajet, en mètres. Zéro en dessous de deux points. */
export function pathLengthMeters(points: readonly LatLng[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineMeters(points[index - 1]!, points[index]!);
  }
  return total;
}

function parse(iso: string | null): number | null {
  if (iso === null) return null;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? null : value;
}

/**
 * La preuve vide : rien ne permet d'affirmer que qui que ce soit s'est déplacé.
 *
 * Exportée parce que l'appelant en a besoin lui aussi. Une demande `at_garage`
 * sans garage retenu n'a pas de destination connue : il n'y a rien à mesurer,
 * et fabriquer un point bidon pour faire tourner `proveArrival` produirait une
 * preuve **fausse** au lieu d'une preuve **absente**. Les deux valent `none`
 * aujourd'hui ; le jour où un seuil bougera, seule la seconde restera juste.
 */
export function noArrivalProof(): ArrivalProof {
  return empty();
}

function empty(level: ProofLevel = 'none'): ArrivalProof {
  return {
    level,
    billable: false,
    arrivedAt: null,
    closestMeters: null,
    travelledMeters: 0,
    dwellSeconds: 0,
    settled: false,
  };
}

/* ------------------------------------------------------------------------ *
 * La géométrie d'un mode de service
 * ------------------------------------------------------------------------ */

/**
 * Qui se déplace, et vers quel point.
 *
 * C'est **le seul endroit du produit** où le mode de service se traduit en
 * géométrie. Tout ce qui a besoin de savoir de quel téléphone lire la trace, ou
 * vers quel point mesurer une arrivée, passe par ici — la preuve d'arrivée, le
 * registre des commissions, l'itinéraire d'approche.
 *
 * Le concentrer ainsi n'est pas une élégance : c'est ce qui rend l'erreur
 * impossible plutôt qu'improbable. Un `if (mode === …)` recopié dans trois
 * modules finit toujours par en avoir un de retard, et une preuve mesurée vers
 * le mauvais point **ne se voit pas** — elle ne plante pas, elle rend
 * simplement `none` sur des dépannages parfaitement réels.
 */
export type ServiceGeometry = {
  /** La partie dont la trace GPS constitue la preuve. */
  traveller: PartyRole;
  /** Le point qu'elle devait atteindre. */
  destination: LatLng;
};

/**
 * La géométrie d'une demande, ou `null` si elle n'en a pas encore.
 *
 * `null` dans un seul cas : `at_garage` sans garage retenu. La destination
 * serait alors inconnue, et rendre un point par défaut — le lieu de la panne,
 * par exemple — produirait une preuve mesurée vers un endroit où personne
 * n'allait. Mieux vaut ne rien affirmer.
 *
 * En `on_site` la destination est toujours connue : c'est le lieu de la panne,
 * que la demande porte depuis sa création.
 */
export function serviceGeometry(
  mode: ServiceMode,
  points: {
    /** Lieu de la panne, tel qu'enregistré sur la demande. */
    origin: LatLng;
    /** Adresse de l'atelier retenu. `null` tant qu'aucun garage n'est choisi. */
    garageLocation: LatLng | null;
  },
): ServiceGeometry | null {
  const traveller = SERVICE_MODE_TRAVELLER[mode];

  if (mode === 'on_site') {
    return { traveller, destination: points.origin };
  }

  if (points.garageLocation === null) return null;
  return { traveller, destination: points.garageLocation };
}

export type ProveArrivalInput = {
  /**
   * Points émis par **celui qui se déplace** sur cette demande — le garage en
   * `on_site`, le client en `at_garage`. L'ordre est indifférent.
   */
  pings: readonly ProofPing[];
  /**
   * Le point **vers lequel** le voyageur devait se rendre.
   *
   * Anciennement nommé `origin`, et le renommage n'est pas cosmétique. Tant
   * qu'un seul mode existait, ce point était toujours le lieu de la panne —
   * l'origine de la demande — et les deux mots désignaient la même chose. Avec
   * `at_garage`, c'est l'adresse de l'atelier, qui n'est l'origine de rien.
   * Garder `origin` aurait fait lire « lieu de la panne » à quelqu'un qui
   * relit ce module dans six mois, et une preuve mesurée vers le mauvais point
   * ne se voit pas : elle rend seulement `none` sur des dépannages réels.
   *
   * `serviceGeometry()` est ce qui choisit ce point. Ne jamais le composer à la
   * main sur un site d'appel.
   */
  destination: LatLng;
  /** Instant du départ déclaré. `null` interdit toute preuve — voir plus bas. */
  enRouteAt: string | null;
  /**
   * Fin connue de la demande : sa clôture, ou à défaut la première confirmation
   * d'arrivée reçue.
   *
   * Deux rôles, et le second est le moins évident. Il **borne la fenêtre** dans
   * laquelle on lit la trace : sans lui, un garagiste consciencieux qui laisse
   * l'app ouverte et rentre chez lui verrait sa trace se terminer à son atelier,
   * donc échouer le test — pendant que celui qui ferme l'app le passerait. La
   * fenêtre supprime cette inversion.
   */
  until: string | null;
  /**
   * Les deux parties ont-elles reconnu l'arrivée ?
   *
   * N'ouvre aucun droit à elle seule et n'en ferme aucun : elle ne fait que
   * hisser une preuve déjà acquise de `trail` à `mutual`. C'est délibéré — dès
   * qu'une confirmation conditionnerait la facture, le débiteur aurait intérêt
   * à la retenir.
   */
  acknowledged?: boolean;
};

/**
 * Le voyageur est-il réellement venu ?
 *
 * Trois signaux, lus dans cet ordre :
 *
 *  1. **`settled`** — le dernier point de la fenêtre est dans le rayon. C'est le
 *     discriminant, et il tire sa force de ce qui semblait un défaut : puisqu'un
 *     véhicule garé n'émet plus, une trace qui **s'arrête** au lieu de
 *     s'éloigner est exactement la signature d'une arrivée. Un passage devant
 *     laisse au contraire des points qui continuent.
 *  2. **`travelledMeters`** — le trajet a une longueur réelle.
 *  3. **`dwellSeconds`** — la demande a vécu assez longtemps après l'arrivée.
 *
 * `enRouteAt` à `null` rend toute preuve impossible, et ce n'est pas une
 * sévérité gratuite : le serveur refuse la confirmation d'arrivée avant le
 * départ déclaré, donc une demande sans cet horodatage n'a jamais pu être menée
 * à son terme. Il n'y a rien à facturer.
 */
export function proveArrival(input: ProveArrivalInput): ArrivalProof {
  const from = parse(input.enRouteAt);
  const to = parse(input.until);
  if (from === null || to === null || to < from) return empty();

  // Fenêtre [départ, fin connue], triée : l'appelant lit une base, pas une
  // promesse d'ordre, et une preuve comptable ne se fie pas à un tri implicite.
  const window = input.pings
    .map((ping) => ({ ping, at: parse(ping.recordedAt) }))
    .filter((entry): entry is { ping: ProofPing; at: number } => entry.at !== null)
    .filter((entry) => entry.at >= from && entry.at <= to)
    .sort((a, b) => a.at - b.at);

  if (window.length === 0) return empty();

  let closestMeters = Number.POSITIVE_INFINITY;
  let arrivedAt: string | null = null;
  let arrivedMs: number | null = null;

  for (const { ping, at } of window) {
    const distance = haversineMeters(ping, input.destination);
    if (distance < closestMeters) closestMeters = distance;

    if (arrivedAt === null && distance <= ARRIVAL_PROOF.radiusMeters) {
      arrivedAt = ping.recordedAt;
      arrivedMs = at;
    }
  }

  const last = window[window.length - 1]!;
  const settled = haversineMeters(last.ping, input.destination) <= ARRIVAL_PROOF.radiusMeters;
  const travelledMeters = pathLengthMeters(window.map((entry) => entry.ping));
  const dwellSeconds = arrivedMs === null ? 0 : Math.max(0, Math.round((to - arrivedMs) / 1000));

  const evidence = {
    billable: false,
    arrivedAt,
    closestMeters: Number.isFinite(closestMeters) ? Math.round(closestMeters) : null,
    travelledMeters: Math.round(travelledMeters),
    dwellSeconds,
    settled,
  };

  // Jamais entré dans le rayon, ou reparti avant la fin : rien à affirmer.
  if (arrivedAt === null || !settled) return { ...evidence, level: 'none' };

  const enough =
    travelledMeters >= ARRIVAL_PROOF.minTravelMeters &&
    dwellSeconds >= ARRIVAL_PROOF.minDwellSeconds;

  if (!enough) return { ...evidence, level: 'weak' };

  return {
    ...evidence,
    level: input.acknowledged === true ? 'mutual' : 'trail',
    billable: true,
  };
}

/* ------------------------------------------------------------------------ *
 * Le barème
 * ------------------------------------------------------------------------ */

/**
 * Ce qu'une intervention coûte au garage, en francs CFA.
 *
 * ⚠️ **Ces montants sont une hypothèse, pas une décision.** Ils sont posés pour
 * que le registre ait quelque chose à écrire pendant la période d'observation ;
 * c'est ce registre, une fois deux mois de données accumulées, qui dira ce
 * qu'ils doivent devenir. Les changer alors ne coûtera qu'une constante.
 *
 * Ils ne sont **jamais un pourcentage** : GeoCras ne voit pas la facture du
 * dépannage et n'a pas à la voir — le client paie le garage directement, sur
 * place, comme l'app le lui conseille. Un forfait par client apporté se calcule
 * sur ce que l'on sait ; un pourcentage se calculerait sur ce que l'on ignore.
 */
export const TARIFF_XAF = {
  /** Dépannage courant : batterie, pneu, panne sèche, éclairage. */
  light: 500,
  /** Le véhicule ne roule plus, ou c'est un accident : plateau, mécanique. */
  heavy: 1_500,
} as const;

export const TARIFF_CLASSES = ['light', 'heavy'] as const;
export type TariffClass = (typeof TARIFF_CLASSES)[number];

/**
 * Part du tarif appliquée quand ce client est **déjà venu par GeoCras** chez ce
 * garage.
 *
 * Moitié prix, et ce n'est pas de la générosité : c'est la réponse à la
 * désintermédiation. Un garage qui a rencontré un client une fois détient son
 * numéro et n'a plus besoin de nous — sauf si continuer à passer par l'app lui
 * revient moins cher que le premier contact. La menace devient un argument :
 * « amenez vos clients habituels sur GeoCras, vous les payez moitié prix ».
 */
export const REPEAT_PAIR_FACTOR = 0.5;

/**
 * Pannes lourdes quelle que soit la réponse du client.
 *
 * Volontairement courte. Le classement repose d'abord sur `immobilized`, que le
 * demandeur coche lui-même dans le formulaire SOS — c'est une déclaration, pas
 * une déduction, et elle sépare bien mieux le plateau du coup de main qu'une
 * liste de pannes établie de mémoire. Ne figurent ici que les cas où la réponse
 * du client ne change rien à la nature de l'intervention.
 */
const ALWAYS_HEAVY: ReadonlySet<string> = new Set(['accident']);

/**
 * La classe tarifaire d'une intervention.
 *
 * Un véhicule qui ne roule plus demande un plateau ou de la mécanique ; un
 * véhicule qui roule encore demande un coup de main. C'est la seule distinction
 * que le produit sait faire honnêtement aujourd'hui, et elle tient à un champ
 * déjà collecté.
 *
 * Le type de panne est enregistré à côté dans le registre : le jour où les
 * données montreront qu'une batterie sur véhicule immobilisé n'est pas une
 * intervention lourde, on affinera **sans migration**.
 */
export function tariffClassOf(problemType: string, immobilized: boolean): TariffClass {
  if (ALWAYS_HEAVY.has(problemType)) return 'heavy';
  return immobilized ? 'heavy' : 'light';
}

/**
 * Le montant dû pour une intervention, en francs entiers.
 *
 * Arrondi à la **cinquantaine inférieure**, et pas à la centaine : le barème
 * plein tombe sur des multiples de cinq cents, mais la remise de moitié rend
 * 250 et 750 — qu'un arrondi à la centaine ramènerait à 200 et 700, soit une
 * remise de soixante pour cent au lieu de cinquante. On ne promet pas la moitié
 * pour en donner davantage.
 *
 * Cinquante francs est la plus petite pièce dont on se sert couramment ici, et
 * un montant qui tombe dessus se vérifie de tête par le garagiste qui relit son
 * relevé. L'arrondi ne sert donc pas le barème actuel — il garantit que tout
 * futur facteur restera réglable en espèces.
 */
export function commissionXaf(input: {
  tariffClass: TariffClass;
  /** Ce client est-il déjà venu chez ce garage par GeoCras ? */
  repeatPair: boolean;
}): number {
  const base = TARIFF_XAF[input.tariffClass];
  const due = input.repeatPair ? base * REPEAT_PAIR_FACTOR : base;
  return Math.floor(due / 50) * 50;
}
