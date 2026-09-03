import { z } from 'zod';
import { coordinatesSchema, uuidSchema } from './common';
import {
  PROBLEM_TYPES,
  REQUEST_VEHICLE_TYPES,
  SERVICE_MODES,
  URGENCY_LEVELS,
} from '../taxonomy';
import { REQUEST_STATUSES } from './requests';

/**
 * La demande vue **du côté du garage**.
 *
 * Contrat distinct de `RequestDetail`, et non une variante avec des champs en
 * moins : les deux parties ne voient pas la même chose, et au même instant.
 * Le client suit *son* dépannage ; le garagiste arbitre entre plusieurs
 * demandes dont il ne connaît pas encore les auteurs. Servir le même objet aux
 * deux obligerait à masquer dans l'écran ce que le serveur aurait déjà envoyé —
 * c'est-à-dire à ne rien masquer du tout.
 *
 * Ce que le garage reçoit avant d'avoir accepté est volontairement borné : voir
 * `PRIVACY_UNTIL_ACCEPTED` plus bas.
 */

/**
 * Le demandeur, tel que le garage le voit.
 *
 * Le nom est donné d'emblée — on n'envoie pas un mécanicien vers « une
 * personne ». Le numéro, lui, n'arrive qu'à l'acceptation : c'est la promesse
 * faite au client sur l'écran d'attente, et elle n'a de valeur que si le
 * serveur la tient.
 */
export const jobClientSchema = z.object({
  fullName: z.string(),
  initials: z.string(),
  /** `null` tant que la demande n'est pas acceptée. */
  phone: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  /** Marque et modèle enregistrés, quand le client a saisi un véhicule. */
  vehicleLabel: z.string().nullable(),
  plate: z.string().nullable(),
});
export type JobClient = z.infer<typeof jobClientSchema>;

/**
 * Ce que le garage n'obtient **qu'après** avoir accepté.
 *
 * Écrit ici, dans le contrat partagé, plutôt qu'en commentaire au fond d'un
 * service : c'est une règle produit que l'app affiche au client mot pour mot
 * (« votre numéro et votre position exacte restent masqués tant que le garage
 * n'a pas accepté »). Les deux côtés la lisent au même endroit.
 */
export const PRIVACY_UNTIL_ACCEPTED = {
  /** Le point exact est arrondi à cette maille, en degrés. ≈ 550 m. */
  originGridDegrees: 0.005,

  /**
   * Rayon du disque montré au garagiste avant acceptation, en mètres.
   *
   * **Mille mètres, alors que l'arrondi n'en déplace le point que de 394 au
   * pire.** L'écart est délibéré, et c'est la décision la plus importante de
   * cette constante.
   *
   * Un disque tracé à la taille réelle de l'incertitude est une **information**
   * : il dit « le véhicule est quelque part dans ces quatre cents mètres », ce
   * qui, dans un quartier qu'on connaît par cœur, désigne une rue et parfois un
   * carrefour. Le but de l'arrondi était précisément d'empêcher cela.
   *
   * On dessine donc plus large que ce que l'on sait. Sur-déclarer l'incertitude
   * est sans danger — le point vrai reste dans le disque, largement — alors que
   * la sous-déclarer trahirait la promesse faite au client. Et un rayon d'un
   * kilomètre reste parfaitement utile au garagiste : il lui dit le quartier,
   * ce qui est exactement ce qu'on lui demande de juger avant d'accepter.
   *
   * Le libellé `jobs.areaOnly` cite cette valeur en toutes lettres : la changer
   * ici demande de le changer là-bas.
   */
  previewRadiusMeters: 1_000,
} as const;

/**
 * Ramène une coordonnée sur la maille de confidentialité.
 *
 * Dans le contrat et non dans le service qui s'en sert : le serveur l'applique
 * en écrivant la réponse, le mobile en a besoin pour dessiner la zone
 * d'incertitude autour du point, et deux arrondis différents afficheraient un
 * cercle qui ne contient pas son propre centre.
 *
 * `toFixed(5)` n'est pas cosmétique : `Math.round(2.9285 / 0.005) * 0.005`
 * rend `2.9300000000000002` en virgule flottante, et cette traînée de
 * décimales voyagerait telle quelle jusqu'à l'écran — une précision au
 * dix-milliardième de degré affichée sur une position qu'on vient justement
 * d'arrondir à cinq cents mètres.
 */
export function snapToPrivacyGrid(value: number): number {
  const grid = PRIVACY_UNTIL_ACCEPTED.originGridDegrees;
  return Number((Math.round(value / grid) * grid).toFixed(5));
}

export const jobSchema = z.object({
  id: uuidSchema,
  status: z.enum(REQUEST_STATUSES),
  problemType: z.enum(PROBLEM_TYPES),
  vehicleType: z.enum(REQUEST_VEHICLE_TYPES),
  /** Libellé libre, renseigné seulement quand `vehicleType` vaut `other`. */
  vehicleLabel: z.string().nullable(),
  description: z.string(),
  urgency: z.enum(URGENCY_LEVELS),
  immobilized: z.boolean(),
  vulnerablePassengers: z.boolean(),
  /**
   * Photos de la panne, dans l'ordre d'envoi.
   *
   * Un tableau alors que la table n'a qu'une colonne `photo_url` : c'est le
   * garagiste qui décide s'il peut intervenir en regardant l'état du véhicule,
   * et il en enverra plusieurs dès que le formulaire le permettra. Exposer la
   * forme définitive maintenant évite de refaire l'écran de détail — et une
   * liste à zéro ou un élément se rend exactement comme une liste à trois.
   */
  photos: z.array(z.string().url()),

  /**
   * Lieu de la panne — **approché tant que la demande n'est pas acceptée**,
   * arrondi à la maille de `PRIVACY_UNTIL_ACCEPTED`.
   *
   * Jamais `null` : un garagiste qui ne sait pas de quel côté de la ville on
   * l'appelle ne peut pas décider, et une carte vide se lit comme une panne de
   * l'app. On donne donc toujours un point, et `originPrecise` dit ce qu'il
   * vaut.
   */
  origin: coordinatesSchema,
  originPrecise: z.boolean(),

  /**
   * Distance garage → panne, en mètres, calculée par PostGIS sur le point
   * **exact**.
   *
   * L'arrondi de `origin` ne la dégrade donc pas : une distance et un rayon ne
   * désignent pas un point, et c'est le chiffre sur lequel le garage décide
   * d'y aller ou non.
   */
  distanceM: z.number().nonnegative(),
  /** Estimation d'approche, même calcul que celui montré au client. */
  etaMin: z.number().int().positive(),

  /**
   * Le client vient-il, ou faut-il aller le chercher ?
   *
   * La première chose que le garagiste doit savoir sur une demande, avant même
   * la panne : elle décide s'il sort un véhicule. Elle est servie dès la file
   * d'attente, et non seulement sur la fiche, parce que c'est en survolant la
   * file qu'il arbitre entre trois demandes.
   */
  serviceMode: z.enum(SERVICE_MODES),

  createdAt: z.string().datetime(),
  /** Instant où le client a retenu ce garage : l'origine du temps d'attente. */
  selectedAt: z.string().datetime().nullable(),
  acceptedAt: z.string().datetime().nullable(),
  enRouteAt: z.string().datetime().nullable(),
  garageArrivedAt: z.string().datetime().nullable(),
  clientArrivedAt: z.string().datetime().nullable(),

  client: jobClientSchema,
  lastSeq: z.number().int().nonnegative(),
});
export type Job = z.infer<typeof jobSchema>;

/**
 * File de travail du garage.
 *
 * Deux listes et non une seule triée : ce sont deux gestes différents. Une
 * demande `incoming` attend une décision — accepter ou laisser filer — et son
 * compteur d'attente court. Une demande `active` est un engagement déjà pris,
 * qu'on mène jusqu'à l'arrivée. Les mélanger dans un même tableau obligerait
 * chaque écran à refaire ce partage, et le ferait diverger d'un écran à
 * l'autre.
 */
export const jobsResponseSchema = z.object({
  garage: z.object({
    id: uuidSchema,
    name: z.string(),
    certified: z.boolean(),
    /** Détection ouverte : `false`, le garage ne reçoit plus de nouveau SOS. */
    isActive: z.boolean(),
  }),
  /** `selected` — reçues, pas encore acceptées. Les plus urgentes en tête. */
  incoming: z.array(jobSchema),
  /** `accepted`, `en_route`, `awaiting_confirmation` — en cours. */
  active: z.array(jobSchema),
});
export type JobsResponse = z.infer<typeof jobsResponseSchema>;

/**
 * Ordre d'affichage des demandes reçues.
 *
 * L'urgence d'abord — un danger passe devant une panne qui peut attendre,
 * quelle que soit l'heure d'arrivée — puis la plus ancienne, parce que c'est
 * celle dont le client attend depuis le plus longtemps.
 *
 * Exporté et non enfoui dans la requête SQL : le mobile réordonne la liste
 * qu'il reçoit par socket sans repasser par le serveur, et les deux tris
 * doivent être le même.
 */
export const URGENCY_RANK: Readonly<Record<Job['urgency'], number>> = {
  danger: 0,
  blocking: 1,
  can_wait: 2,
};

export function compareIncomingJobs(a: Job, b: Job): number {
  const byUrgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  if (byUrgency !== 0) return byUrgency;

  const at = Date.parse(a.selectedAt ?? a.createdAt);
  const bt = Date.parse(b.selectedAt ?? b.createdAt);
  return at - bt;
}

/**
 * Prochaine action du garage sur une demande, ou `null` s'il n'a rien à faire.
 *
 * La machine à états vit dans `requests.ts` ; ce qu'on traduit ici, c'est la
 * seule transition que **le garage** peut déclencher depuis un état donné.
 * L'écran s'en sert pour n'afficher qu'un bouton à la fois — au bord d'une
 * route, un choix entre trois actions est un choix de trop.
 */
export type JobAction = 'accept' | 'en_route' | 'confirm_arrival';

export function nextJobAction(
  job: Pick<Job, 'status' | 'garageArrivedAt' | 'serviceMode'>,
): JobAction | null {
  switch (job.status) {
    case 'selected':
      return 'accept';
    /**
     * Acceptée, et c'est maintenant le mode qui dit qui bouge.
     *
     * En `on_site`, le garagiste annonce son départ : c'est `en_route`, et
     * c'est cet horodatage qui ouvre la fenêtre de lecture de sa trace.
     *
     * En `at_garage`, il n'a **rien à faire** — c'est le client qui prend la
     * route, et lui seul peut le déclarer. Lui proposer « Je pars » ici serait
     * un bouton que le serveur refuserait (`declareEnRoute` n'accepte que le
     * voyageur du mode), et surtout un bouton qui mentirait sur qui conduit.
     */
    case 'accepted':
      return job.serviceMode === 'on_site' ? 'en_route' : null;
    case 'en_route':
      return 'confirm_arrival';
    /**
     * Une seule des deux parties a confirmé. Si c'est le garage, il n'a plus
     * rien à faire qu'attendre le client — reproposer le bouton laisserait
     * croire que sa confirmation n'est pas passée, alors qu'elle est
     * idempotente et déjà enregistrée.
     */
    case 'awaiting_confirmation':
      return job.garageArrivedAt === null ? 'confirm_arrival' : null;
    default:
      return null;
  }
}
