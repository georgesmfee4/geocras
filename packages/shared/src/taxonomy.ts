/**
 * Taxonomie des pannes.
 *
 * Source unique pour le mobile et le serveur. Le mobile affiche les puces dans
 * l'ordre exact de `PROBLEMS_BY_VEHICLE` — cet ordre EST le « tri auto » de la
 * maquette 02 : la panne la plus probable pour le véhicule choisi vient en tête.
 * Le serveur valide la paire (véhicule, panne) avec `isProblemValidForVehicle`.
 */

/**
 * Types de véhicule **enregistrables** dans un profil.
 *
 * Volontairement fermé aux trois catégories que la table `vehicles` accepte :
 * une fiche véhicule sert à préremplir des demandes futures, elle a besoin
 * d'un type exploitable, pas d'une chaîne libre.
 */
export const VEHICLE_TYPES = ['car', 'moto', 'truck'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/**
 * Types de véhicule acceptés dans une **demande d'assistance**.
 *
 * Le parc camerounais ne se réduit pas à voiture/moto/camion : tricycles,
 * bus de transport, minibus, engins de chantier. Refuser une demande SOS
 * parce que le véhicule n'entre pas dans trois cases serait absurde — d'où
 * `other`, qui **exige en contrepartie un libellé saisi à la main**
 * (`vehicleLabel`). Sans lui, le garagiste ne saurait pas quoi préparer.
 *
 * Deux listes plutôt qu'une seule élargie : la table `vehicles` porte une
 * contrainte SQL sur ses trois types, et les confondre ferait passer la
 * validation d'un véhicule enregistré « other » qui casserait à l'insertion.
 */
export const REQUEST_VEHICLE_TYPES = [...VEHICLE_TYPES, 'other'] as const;
export type RequestVehicleType = (typeof REQUEST_VEHICLE_TYPES)[number];

export const PROBLEM_TYPES = [
  'battery',
  'flat_tyre',
  'overheating',
  'out_of_fuel',
  'brakes',
  'clutch',
  'gearbox',
  'alternator',
  'steering_suspension',
  'electrical',
  'accident',
  'chain_transmission',
  'carburettor',
  'starter',
  'oil_leak',
  'lighting',
  'air_brakes',
  'air_circuit',
  'axle_suspension',
  'load_securing',
  'other',
] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

/**
 * Ordre d'affichage par véhicule, le plus probable en premier.
 * Repris tel quel du cahier des charges (handoff/ecrans-prompts/03-sos.md).
 */
export const PROBLEMS_BY_VEHICLE: Readonly<Record<RequestVehicleType, readonly ProblemType[]>> = {
  car: [
    'battery',
    'flat_tyre',
    'overheating',
    'out_of_fuel',
    'brakes',
    'clutch',
    'gearbox',
    'alternator',
    'steering_suspension',
    'electrical',
    'accident',
    'other',
  ],
  moto: [
    'battery',
    'flat_tyre',
    'chain_transmission',
    'out_of_fuel',
    'brakes',
    'carburettor',
    'starter',
    'oil_leak',
    'lighting',
    'accident',
    'other',
  ],
  truck: [
    'battery',
    'flat_tyre',
    'overheating',
    'out_of_fuel',
    'air_brakes',
    'clutch',
    'gearbox',
    'air_circuit',
    'axle_suspension',
    'load_securing',
    'accident',
    'other',
  ],
  /**
   * Véhicule hors catégorie : tricycle, bus, minibus, engin.
   *
   * Liste générique et volontairement courte — on ne sait pas ce qu'on a en
   * face. On garde les pannes qui existent sur tout ce qui roule et on écarte
   * celles qui présument une mécanique précise (carburateur, chaîne, circuit
   * pneumatique) : les proposer à l'aveugle inviterait à un mauvais choix, et
   * c'est ce mauvais choix qui déciderait ensuite du filtrage des garages.
   */
  other: [
    'battery',
    'flat_tyre',
    'overheating',
    'out_of_fuel',
    'brakes',
    'gearbox',
    'electrical',
    'steering_suspension',
    'accident',
    'other',
  ],
} as const;

/** Services qu'un garage doit offrir pour traiter la panne. Sert au filtrage géo. */
export const SERVICES = [
  'battery',
  'tyre',
  'engine',
  'fuel',
  'brakes',
  'transmission',
  'electrical',
  'bodywork',
  'towing',
  'general',
] as const;
export type Service = (typeof SERVICES)[number];

const REQUIRED_SERVICES: Readonly<Record<ProblemType, readonly Service[]>> = {
  battery: ['battery', 'electrical'],
  flat_tyre: ['tyre'],
  overheating: ['engine'],
  out_of_fuel: ['fuel'],
  brakes: ['brakes'],
  clutch: ['transmission'],
  gearbox: ['transmission'],
  alternator: ['electrical'],
  steering_suspension: ['general'],
  electrical: ['electrical'],
  accident: ['bodywork', 'towing'],
  chain_transmission: ['transmission'],
  carburettor: ['engine'],
  starter: ['electrical'],
  oil_leak: ['engine'],
  lighting: ['electrical'],
  air_brakes: ['brakes'],
  air_circuit: ['brakes'],
  axle_suspension: ['general'],
  load_securing: ['towing'],
  other: ['general'],
};

/**
 * Pannes qui immobilisent le véhicule : le garage DOIT proposer le remorquage.
 * Utilisé pour pré-cocher le filtre « Remorquage » sur l'écran de résultats.
 */
const TOWING_REQUIRED: ReadonlySet<ProblemType> = new Set<ProblemType>([
  'accident',
  'gearbox',
  'clutch',
  'axle_suspension',
  'load_securing',
]);

/**
 * Compétences d'un garage, telles qu'on les montre au client.
 *
 * Elles vivent ici et non dans les traductions du mobile, comme les autres
 * libellés métier : le serveur en a besoin pour les notifications, et deux
 * listes séparées finiraient par se contredire — un garage annoncé
 * « Remorquage » côté app et « Towing » dans un message.
 */
export const SERVICE_LABELS: Readonly<Record<Service, { fr: string; en: string }>> = {
  battery: { fr: 'Batterie', en: 'Battery' },
  tyre: { fr: 'Pneumatique', en: 'Tyres' },
  engine: { fr: 'Moteur', en: 'Engine' },
  fuel: { fr: 'Carburant', en: 'Fuel' },
  brakes: { fr: 'Freinage', en: 'Brakes' },
  transmission: { fr: 'Transmission', en: 'Transmission' },
  electrical: { fr: 'Électricité', en: 'Electrics' },
  bodywork: { fr: 'Carrosserie', en: 'Bodywork' },
  towing: { fr: 'Remorquage', en: 'Towing' },
  general: { fr: 'Mécanique générale', en: 'General mechanics' },
};

export const PROBLEM_LABELS: Readonly<Record<ProblemType, { fr: string; en: string }>> = {
  battery: { fr: 'Batterie / démarrage', en: 'Battery / starting' },
  flat_tyre: { fr: 'Pneu crevé', en: 'Flat tyre' },
  overheating: { fr: 'Surchauffe moteur', en: 'Engine overheating' },
  out_of_fuel: { fr: 'Panne sèche', en: 'Out of fuel' },
  brakes: { fr: 'Freins', en: 'Brakes' },
  clutch: { fr: 'Embrayage', en: 'Clutch' },
  gearbox: { fr: 'Boîte de vitesse', en: 'Gearbox' },
  alternator: { fr: 'Alternateur', en: 'Alternator' },
  steering_suspension: { fr: 'Direction / suspension', en: 'Steering / suspension' },
  electrical: { fr: 'Électricité / éclairage', en: 'Electrics / lighting' },
  accident: { fr: 'Accident', en: 'Accident' },
  chain_transmission: { fr: 'Chaîne / transmission', en: 'Chain / transmission' },
  carburettor: { fr: 'Carburateur', en: 'Carburettor' },
  starter: { fr: 'Démarreur', en: 'Starter' },
  oil_leak: { fr: "Fuite d'huile", en: 'Oil leak' },
  lighting: { fr: 'Éclairage', en: 'Lighting' },
  air_brakes: { fr: 'Freins / air', en: 'Brakes / air' },
  air_circuit: { fr: 'Circuit pneumatique', en: 'Air circuit' },
  axle_suspension: { fr: 'Suspension / essieu', en: 'Suspension / axle' },
  load_securing: { fr: 'Chargement / arrimage', en: 'Load / securing' },
  other: { fr: 'Autre', en: 'Other' },
};

export const VEHICLE_LABELS: Readonly<Record<RequestVehicleType, { fr: string; en: string }>> = {
  car: { fr: 'Voiture', en: 'Car' },
  moto: { fr: 'Moto', en: 'Motorcycle' },
  truck: { fr: 'Camion', en: 'Truck' },
  other: { fr: 'Autre', en: 'Other' },
};

/** Longueur maximale du libellé libre exigé par le véhicule « Autre ». */
export const VEHICLE_LABEL_MAX = 60;

/** Niveau d'urgence — champ validé en plus de la maquette. */
export const URGENCY_LEVELS = ['can_wait', 'blocking', 'danger'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const URGENCY_LABELS: Readonly<Record<UrgencyLevel, { fr: string; en: string }>> = {
  can_wait: { fr: 'Peut attendre', en: 'Can wait' },
  blocking: { fr: 'Bloquant', en: 'Blocking' },
  danger: { fr: 'Danger', en: 'Danger' },
};

export function problemsForVehicle(vehicle: RequestVehicleType): readonly ProblemType[] {
  return PROBLEMS_BY_VEHICLE[vehicle];
}

export function isProblemValidForVehicle(
  vehicle: RequestVehicleType,
  problem: ProblemType,
): boolean {
  return PROBLEMS_BY_VEHICLE[vehicle].includes(problem);
}

export function servicesForProblem(problem: ProblemType): readonly Service[] {
  return REQUIRED_SERVICES[problem];
}

export function requiresTowing(problem: ProblemType, immobilized: boolean): boolean {
  return immobilized || TOWING_REQUIRED.has(problem);
}

/**
 * Compétences recherchées pour une demande d'assistance.
 *
 * **À combiner en OU, jamais en ET.** Ce sont des façons alternatives de
 * traiter la panne : pour une batterie à plat, `battery` ou `electrical` font
 * l'affaire ; le remorquage s'ajoute quand le véhicule ne roule plus, sans
 * pour autant devenir obligatoire pour chaque garage proposé.
 *
 * Exigée en ET, la liste se vidait : une boîte de vitesse immobilisée
 * demandait `transmission` **et** `towing`, soit un garage qui répare les
 * boîtes et remorque. Là où l'un répare et l'autre remorque, la recherche ne
 * rendait rien alors que les deux pouvaient aider.
 *
 * Fonction partagée plutôt que dupliquée : le serveur l'applique à la création
 * de la demande, le mobile la rejoue à la reprise d'une demande ouverte. Deux
 * règles séparées auraient fini par diverger, et la liste des garages aurait
 * changé entre l'envoi du SOS et sa réouverture.
 */
export function matchingServices(
  problem: ProblemType,
  immobilized: boolean,
): readonly Service[] {
  const services = new Set<Service>(servicesForProblem(problem));
  if (requiresTowing(problem, immobilized)) services.add('towing');
  return [...services];
}
