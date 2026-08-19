import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  matchingServices,
  type ChangePasswordBody,
  type CreateMyGarageBody,
  type EditMyGarageBody,
  type CreateRequestBody,
  type CreateReviewBody,
  type GarageSort,
  type MyGarageResponse,
  type NearbyResponse,
  type RequestDetail,
  type Service,
  type UpdateMeBody,
  type VehicleInput,
} from '@geocras/shared';
import { getRefreshToken } from './tokens';
import { rememberSentAt } from '../sos/sentAt';
import { serverNow } from '../time/clock';
import { api } from './endpoints';
import { queryKeys } from './queryClient';

/**
 * Hooks de données.
 *
 * Tout ce qui vient du serveur passe par TanStack Query — jamais par un store
 * Zustand. Le partage est net : Query pour le cache serveur, Zustand pour ce
 * qui change à chaque seconde (suivi, conduite).
 */

/**
 * Rayon de la recherche SOS, en kilomètres.
 *
 * Doit rester aligné sur celui qu'applique `createRequest` côté serveur : ce
 * `meta` sert à afficher « aucun garage à moins de N km », et une valeur
 * inventée ici mentirait sur ce qui a réellement été fouillé.
 */
const SOS_SEARCH_RADIUS_KM = 15;

/** Rayon par défaut, aligné sur celui du serveur. */
const DEFAULT_NEARBY_RADIUS_KM = 15;

export type NearbyOptions = {
  sort?: GarageSort;
  radiusKm?: number;
  services?: Service[];
  openNow?: boolean;
  certifiedOnly?: boolean;
  /** `false` retient la requête — le temps de relire un réglage, par exemple. */
  ready?: boolean;
};

export function useNearbyGarages(
  origin: { lat: number; lng: number } | null,
  options: NearbyOptions = {},
) {
  const sort = options.sort ?? 'distance';
  const openNow = options.openNow ?? false;
  const certifiedOnly = options.certifiedOnly ?? false;
  const services = options.services ?? [];
  const radiusKm = options.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM;

  return useQuery({
    /**
     * **Tout ce qui change la réponse est dans la clé** — filtres, tri, et le
     * rayon.
     *
     * Le rayon y manquait, et le défaut était sournois : régler la carte sur
     * 40 km ne changeait pas la clé, TanStack Query resservait donc le résultat
     * calculé à 15 km depuis son cache et ne rappelait jamais le serveur. Le
     * réglage semblait sans effet alors que la requête, elle, était correcte —
     * elle ne partait simplement pas.
     */
    queryKey: origin
      ? [
          ...queryKeys.garages.nearby(origin.lat, origin.lng, sort),
          radiusKm,
          openNow,
          certifiedOnly,
          services.join(','),
        ]
      : ['garages', 'nearby', 'unknown'],
    /**
     * Sans position, la requête n'a pas de sens : on ne la lance pas plutôt que
     * d'envoyer des coordonnées nulles au serveur.
     *
     * On attend aussi la relecture des réglages : partir sur le rayon par
     * défaut puis relancer une seconde après, c'est deux recherches facturées
     * aux données mobiles de l'utilisateur pour une seule question.
     */
    enabled: origin !== null && options.ready !== false,
    // Garde l'ancienne liste affichée pendant le rechargement : changer de
    // filtre ne doit pas vider la carte le temps d'un aller-retour réseau.
    placeholderData: (previous) => previous,
    queryFn: () =>
      api.garages.nearby({
        lat: origin!.lat,
        lng: origin!.lng,
        sort,
        radiusKm,
        limit: 20,
        openNow,
        certifiedOnly,
        // La puce « Remorquage » n’envoie qu’un service : ET et OU y sont
        // équivalents. On garde le ET, sémantique historique de la route.
        matchAny: false,
        ...(services.length > 0 ? { services } : {}),
      }),
  });
}

/**
 * Fiche complète d'un garage.
 *
 * L'origine fait partie de la clé, arrondie au millième de degré — une centaine
 * de mètres, la même grille que la recherche de proximité. C'est le serveur qui
 * calcule `distanceM` à partir du point qu'on lui envoie : sans l'origine dans
 * la clé, la fiche ouverte avant le premier point GPS restait en cache avec sa
 * distance à zéro, et affichait « 0 m » pendant une minute sur un garage à
 * trois kilomètres.
 *
 * L'appelant est invité à passer une origine **ancrée** (`useStableOrigin`) :
 * la grille d'arrondi seule ferait repartir une requête à chaque tremblement du
 * GPS posé sur une table.
 */
export function useGarageDetail(id: string | null, origin?: { lat: number; lng: number }) {
  return useQuery({
    queryKey: [
      ...queryKeys.garages.detail(id ?? 'none'),
      origin ? Math.round(origin.lat * 1000) : null,
      origin ? Math.round(origin.lng * 1000) : null,
    ],
    enabled: id !== null,
    // On garde la fiche précédente à l'écran pendant qu'on recalcule la
    // distance depuis une nouvelle position : rien d'autre n'a changé, et vider
    // l'écran pour un chiffre serait absurde.
    placeholderData: (previous) => previous,
    queryFn: () => api.garages.detail(id!, origin),
  });
}

export function useGarageReviews(id: string | null, page = 1) {
  return useQuery({
    queryKey: queryKeys.garages.reviews(id ?? 'none', page),
    enabled: id !== null,
    queryFn: () => api.garages.reviews(id!, page),
  });
}

/**
 * Avis d'un garage, par pages successives.
 *
 * Un garage installé depuis douze ans en cumule des centaines : les charger
 * d'un bloc ferait payer une longue attente pour trois avis lus. On sert la
 * première page avec la fiche, les suivantes à la demande.
 */
export function useGarageReviewPages(id: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.garages.reviewPages(id ?? 'none'),
    enabled: id !== null,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.garages.reviews(id!, pageParam),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}

/**
 * Droit de noter ce garage.
 *
 * Route authentifiée : sans compte, la question n'a pas de réponse — on ne la
 * pose donc pas plutôt que de récolter un 401 que l'écran devrait ensuite
 * démêler d'une vraie erreur réseau.
 */
export function useReviewEligibility(garageId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.garages.eligibility(garageId ?? 'none'),
    enabled: garageId !== null && enabled,
    queryFn: () => api.garages.reviewEligibility(garageId!),
  });
}

/**
 * Détail d'une demande.
 *
 * `refetchInterval` est piloté par l'appelant : à 0 quand le socket est vivant,
 * à 15 s en mode dégradé. C'est le repli décrit dans l'architecture — le socket
 * reste la voie normale, HTTP prend le relais sans que l'écran change.
 */
export function useRequestDetail(id: string | null, pollIntervalMs = 0) {
  return useQuery({
    queryKey: queryKeys.requests.detail(id ?? 'none'),
    enabled: id !== null,
    queryFn: () => api.requests.detail(id!),
    refetchInterval: pollIntervalMs > 0 ? pollIntervalMs : false,
  });
}

/**
 * Interventions du compte.
 *
 * `enabled` existe pour le tiroir : ouvert par un invité, il monte les mêmes
 * lignes sans session et déclencherait trois appels voués au 401. Une requête
 * qu’on sait perdue d’avance coûte des données mobiles pour rien.
 */
export function useMyRequests(page = 1, enabled = true) {
  return useQuery({
    queryKey: queryKeys.requests.mine(page),
    enabled,
    queryFn: () => api.requests.mine(page),
  });
}

/**
 * Historique complet, par pages successives.
 *
 * `useMyRequests` sert le décompte du tiroir — une page, un total. L'écran
 * Historique, lui, se déroule : un client fidèle cumule des dizaines
 * d'interventions, et les charger d'un bloc ferait payer une longue attente
 * pour les trois qu'on vient consulter.
 */
export function useMyRequestPages(enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.requests.minePages(),
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.requests.mine(pageParam),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}

export function useProfile() {
  return useQuery({ queryKey: queryKeys.me.profile(), queryFn: api.me.profile });
}

export function useVehicles(enabled = true) {
  return useQuery({ queryKey: queryKeys.me.vehicles(), enabled, queryFn: api.me.vehicles });
}

export function useLoyalty(enabled = true) {
  return useQuery({ queryKey: queryKeys.me.loyalty(), enabled, queryFn: api.me.loyalty });
}

/**
 * Mouvements de points.
 *
 * Chargés seulement quand la section « Mouvements récents » est dépliée : c'est
 * une justification comptable qu'on ouvre une fois sur dix visites, et la
 * réclamer à chaque ouverture de l'écran ferait payer une requête pour rien.
 */
export function useLoyaltyHistory(page = 1, enabled = true) {
  return useQuery({
    queryKey: queryKeys.me.loyaltyHistory(page),
    enabled,
    queryFn: () => api.me.loyaltyHistory(page),
  });
}

export function useDrivingHistory(page = 1) {
  return useQuery({
    queryKey: queryKeys.driving.history(page),
    queryFn: () => api.driving.history(page),
  });
}

export function useCreateRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRequestBody) => api.requests.create(body),
    onSuccess: (data, variables) => {
      /**
       * On ne sème **pas** le détail de la demande.
       *
       * La création renvoie un `AssistanceRequest` : la demande seule, sans
       * `client`, sans `garage`, sans `tracking`. Le déposer sous la clé
       * `requests.detail`, que tout le monde lit comme un `RequestDetail`,
       * revenait à mettre un objet amputé là où les écrans attendent un objet
       * complet — `setQueryData` accepte n'importe quoi sans broncher dès
       * qu'on ne lui donne pas de paramètre de type.
       *
       * Ça a fini en écran rouge : l'écran de résultats lit
       * `request.client.phone` pour montrer le numéro masqué dans la
       * confirmation d'envoi, et trouvait `client` indéfini. Pendant une
       * minute entière, qui plus est — `staleTime` vaut 60 s, donc aucun
       * rechargement ne venait réparer la valeur entre-temps.
       *
       * `GET /requests/:id` part donc normalement au montage de l'écran. Ce
       * qu'on économisait ici était une seule requête légère ; le classement
       * de garages, lui, est bien plus lourd et reste semé juste en dessous.
       */

      /**
       * Le classement de garages voyage avec la demande : l'écran de résultats
       * le lit dans le cache au lieu de relancer la même recherche.
       *
       * Il est **normalisé en `NearbyResponse`**, la forme que
       * `useRequestCandidates` déclare et que l'écran lit. Il était écrit ici
       * sous `{ garages, fallback }` alors qu'il est relu sous `.results` :
       * la liste existait, le serveur l'avait bien renvoyée, et l'écran
       * affichait « 0 résultats ». Le paramètre de type sur `setQueryData` est
       * ce qui empêche désormais les deux formes de diverger à nouveau — sans
       * lui, `setQueryData` accepte n'importe quel objet sans broncher.
       */
      client.setQueryData<NearbyResponse>(
        queryKeys.requests.candidates(data.request.id),
        {
          results: data.garages,
          fallback: data.fallback,
          meta: {
            sort: variables.sort,
            radiusKm: SOS_SEARCH_RADIUS_KM,
            count: data.garages.length,
            widened: data.garages.length === 0 && data.fallback !== null,
          },
        },
      );
      // Ciblé sur l'historique : une invalidation de tout `['requests']`
      // effacerait le classement qu'on vient d'y déposer.
      void client.invalidateQueries({ queryKey: ['requests', 'mine'] });
    },
  });
}

/**
 * Garages capables de traiter la panne d'une demande.
 *
 * Deux chemins mènent à cet écran, et ils n'ont pas la même information :
 *
 *  - juste après la création, le serveur a déjà renvoyé le classement dans la
 *    même réponse — il est en cache sous `candidates`, on le sert tel quel ;
 *  - en reprise d'une demande ouverte (bouton SOS → demande `pending`), on
 *    arrive sans rien et il faut refaire la recherche.
 *
 * Le filtre par services n'est pas cosmétique : `servicesForProblem` traduit la
 * panne en compétences exigées, et `requiresTowing` y ajoute le remorquage dès
 * que le véhicule est immobilisé. Sans lui, on proposerait un spécialiste pneus
 * à quelqu'un dont la boîte de vitesse a lâché.
 *
 * La recherche part de l'origine **enregistrée sur la demande**, pas de la
 * position courante : c'est là que le véhicule est tombé en panne, et c'est là
 * que le garagiste doit se rendre — même si le client a marché depuis.
 */
export function useRequestCandidates(request: RequestDetail | null | undefined) {
  const client = useQueryClient();

  return useQuery({
    queryKey: queryKeys.requests.candidates(request?.id ?? 'none'),
    enabled: request != null,
    // Le classement d'une demande donnée ne bouge pas d'une minute à l'autre :
    // les garages ne se déplacent pas, et l'origine est figée.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<NearbyResponse> => {
      const cached = client.getQueryData<NearbyResponse>(
        queryKeys.requests.candidates(request!.id),
      );
      if (cached) return cached;

      // Même fonction que le serveur applique à la création : la liste de
      // garages ne peut donc pas changer entre l'envoi du SOS et sa réouverture.
      const services = [...matchingServices(request!.problemType, request!.immobilized)];

      return api.garages.nearby({
        lat: request!.origin.lat,
        lng: request!.origin.lng,
        radiusKm: 15,
        sort: 'distance',
        limit: 20,
        openNow: false,
        certifiedOnly: false,
        services,
        /**
         * **OU**, et non ET.
         *
         * `servicesForProblem` liste des compétences **alternatives** — pour
         * une batterie à plat, `battery` ou `electrical` font l'affaire — et le
         * remorquage s'y ajoute quand le véhicule ne roule plus. Les exiger
         * toutes du même garage vidait la liste : une boîte de vitesse
         * immobilisée demandait `transmission` ET `towing`, soit un garage qui
         * répare les boîtes **et** remorque. À Ebolowa l'un répare et l'autre
         * remorque, et la recherche ne rendait rien alors que les deux
         * pouvaient aider.
         */
        matchAny: true,
      });
    },
  });
}

export function useSelectGarage(requestId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (garageId: string) => api.requests.selectGarage(requestId, garageId),
    onSuccess: (request) => {
      /**
       * L'instant où ce garage a été prévenu, retenu tout de suite.
       *
       * On préfère `selectedAt`, écrit par le serveur dans la transaction de
       * transition : c'est la date que verront les deux parties. On retombe
       * sur l'heure serveur locale si le champ manque — un serveur pas encore
       * migré ne doit pas renvoyer le compteur d'attente à l'ouverture de la
       * demande, vingt minutes plus tôt.
       */
      rememberSentAt(requestId, request.selectedAt ?? new Date(serverNow()).toISOString());

      /**
       * Le nouveau statut est écrit dans le cache **avant** que quiconque
       * navigue, et c'est la correction d'un vrai défaut.
       *
       * L'invalidation seule ne suffisait pas : elle marque la donnée périmée et
       * déclenche un rechargement, mais elle ne change rien tout de suite. Or
       * l'écran des résultats enchaîne sur `router.replace('/suivi/…')` dans la
       * foulée. L'écran de suivi lisait donc la version d'avant l'envoi —
       * `pending`, sans garage — et en concluait que la demande n'avait plus de
       * garage, c'est-à-dire qu'elle venait d'être refusée. Le client voyait
       * « ce garage ne peut pas intervenir » une seconde après avoir envoyé son
       * SOS, alors que l'atelier n'avait strictement rien répondu.
       *
       * On fusionne plutôt que de remplacer : le serveur renvoie ici la demande
       * seule, quand le cache contient un `RequestDetail` — garage, parties,
       * suivi. Écraser la fiche par la demande nue ferait disparaître le nom du
       * garage à l'écran le temps du rechargement, ce qui remplacerait un
       * mensonge par un clignotement. L'invalidation qui suit ramène le tout.
       */
      client.setQueryData<RequestDetail>(queryKeys.requests.detail(requestId), (previous) =>
        previous ? { ...previous, ...request } : previous,
      );

      void client.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
    },
  });
}

/**
 * Confirmation d'arrivée — la seule mutation qu'on autorise à réessayer, parce
 * que la route serveur est idempotente : un double envoi ne crédite pas deux
 * fois. Sur un réseau qui coupe, ce réessai est ce qui évite qu'une
 * intervention reste bloquée faute d'avoir pu confirmer.
 */
export function useConfirmArrival(requestId: string) {
  const client = useQueryClient();
  return useMutation({
    retry: 3,
    mutationFn: (position: { lat: number; lng: number } | null) =>
      api.requests.confirmArrival(requestId, position),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
      void client.invalidateQueries({ queryKey: queryKeys.me.loyalty() });
      // Côté garagiste, une arrivée confirmée fait sortir la demande de sa
      // file dès que le client confirme à son tour.
      void client.invalidateQueries({ queryKey: queryKeys.requests.garageJobs() });
    },
  });
}

export function useRequestAction(requestId: string, action: 'accept' | 'enRoute') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      action === 'accept' ? api.requests.accept(requestId) : api.requests.enRoute(requestId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
      void client.invalidateQueries({ queryKey: queryKeys.requests.garageJobs() });
    },
  });
}

/**
 * Les deux transitions que le garagiste déclenche : accepter, puis partir.
 *
 * La demande voyage en **variable** et non en paramètre du hook, contrairement
 * à `useRequestAction` : la file en affiche plusieurs, et un hook par ligne
 * n'est pas possible — le nombre de hooks d'un composant ne peut pas dépendre
 * de la longueur d'une liste.
 *
 * Aucun réessai : ni l'une ni l'autre n'est idempotente. Rejouée après une
 * réponse perdue, la seconde tentative se heurterait à un
 * `INVALID_STATE_TRANSITION` — la demande a déjà avancé — et afficherait une
 * erreur là où tout s'est bien passé.
 */
export function useJobAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'accept' | 'en_route' }) =>
      action === 'accept' ? api.requests.accept(requestId) : api.requests.enRoute(requestId),
    onSuccess: (_result, { requestId }) => {
      void client.invalidateQueries({ queryKey: queryKeys.requests.garageJobs() });
      void client.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
    },
  });
}

/**
 * Arrivée sur place, déclarée depuis la file.
 *
 * Séparée de `useJobAction` pour une seule raison, mais elle est décisive : la
 * route est **idempotente**, donc celle-ci a le droit de réessayer. C'est ce
 * réessai qui évite qu'une intervention reste ouverte parce que la
 * confirmation est partie dans un trou de réseau — et une confirmation
 * manquante, c'est le crédit de fidélité des deux parties qui ne tombe jamais.
 *
 * La position accompagne la confirmation : elle est journalisée avec
 * l'événement et sert au contrôle anti-fraude, qui compare l'endroit déclaré à
 * la trace réellement parcourue.
 */
export function useConfirmJobArrival() {
  const client = useQueryClient();
  return useMutation({
    retry: 3,
    mutationFn: ({
      requestId,
      position,
    }: {
      requestId: string;
      position: { lat: number; lng: number } | null;
    }) => api.requests.confirmArrival(requestId, position),
    onSuccess: (_result, { requestId }) => {
      void client.invalidateQueries({ queryKey: queryKeys.requests.garageJobs() });
      void client.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
      void client.invalidateQueries({ queryKey: queryKeys.me.loyalty() });
    },
  });
}

/**
 * Refus d'une demande reçue.
 *
 * **Ce n'est pas une annulation.** La demande repart en recherche : le client
 * garde son SOS, son ancienneté et son journal, et retrouve la liste des
 * garages là où il l'avait laissée. Appeler `cancel` ici — ce que faisait la
 * première version — fermait le dossier de quelqu'un en panne au bord d'une
 * route parce qu'un garage ne pouvait pas venir.
 */
export function useDeclineJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      api.requests.decline(requestId, reason),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['requests'] }),
  });
}

/**
 * Itinéraire routier vers le lieu de la panne.
 *
 * La clé de cache **contient la position de départ, arrondie à ~110 m** : c'est
 * ce qui fait de ce hook un itinéraire vivant. Le GPS republie toutes les cinq
 * secondes ; sans arrondi, chaque point produirait une clé neuve et donc un
 * appel réseau, pour un tracé identique. Avec, la requête ne repart que lorsque
 * le véhicule a réellement changé de rue — la même grille que celle du cache
 * serveur, pour que les deux se répondent au lieu de se croiser.
 *
 * `enabled` reste faux tant que le GPS n'a rien rendu : demander un itinéraire
 * depuis une position inconnue n'a pas de sens, et l'écran affiche son propre
 * état d'acquisition.
 */
/**
 * Trajet d'approche du garagiste, **vu par le client**.
 *
 * La clé porte la position du dépanneur arrondie à ~110 m, et c'est elle qui
 * fait vivre le tracé : la position arrive par socket à chaque ping, mais on ne
 * redemande le trajet que lorsqu'il a changé de rue. Sans cet arrondi, un
 * véhicule à l'arrêt dont le GPS oscille relancerait un calcul routier toutes
 * les cinq secondes.
 *
 * Le hook ne connaît pas la position — il ne fait que la recevoir pour bâtir sa
 * clé. Le serveur, lui, relit le dernier point en base : c'est ce qui garantit
 * que le tracé montré au client est celui que le garagiste conduit, et non une
 * reconstitution faite de son côté.
 */
export function useApproachRoute(
  requestId: string | null,
  mechanic: { lat: number; lng: number } | null,
  enabled: boolean,
) {
  const grid = (value: number) => Math.round(value / 0.001);

  return useQuery({
    queryKey: [
      'requests',
      'approach',
      requestId,
      mechanic ? grid(mechanic.lat) : null,
      mechanic ? grid(mechanic.lng) : null,
    ],
    enabled: enabled && requestId !== null,
    staleTime: 60_000,
    // Le tracé précédent reste peint pendant le recalcul : une carte qui se
    // vide à chaque virage donne l'impression d'avoir perdu le dépanneur.
    placeholderData: (previous) => previous,
    queryFn: () => api.requests.approach(requestId!),
  });
}

export function useJobRoute(requestId: string, from: { lat: number; lng: number } | null) {
  const grid = (value: number) => Math.round(value / 0.001);

  return useQuery({
    queryKey: [
      'requests',
      'route',
      requestId,
      from ? grid(from.lat) : null,
      from ? grid(from.lng) : null,
    ],
    enabled: from !== null,
    /**
     * Le trajet ne dépend que des deux points, et le serveur le met déjà en
     * cache une minute. Le garder frais cinq minutes côté app évite de le
     * redemander à chaque retour sur l'écran depuis le même endroit.
     */
    staleTime: 5 * 60_000,
    // Garde le tracé précédent affiché pendant le recalcul : une carte qui se
    // vide à chaque virage donnerait l'impression d'avoir perdu la route.
    placeholderData: (previous) => previous,
    queryFn: () => api.requests.route(requestId, from!),
  });
}

/**
 * File de travail du garagiste.
 *
 * `staleTime: 0` à rebours du réglage global d'une minute : c'est la seule
 * donnée de l'app dont une version d'il y a soixante secondes est une faute.
 * Un SOS qu'on ne voit pas est un client au bord de la route qui attend une
 * réponse déjà arrivée, et le compteur d'attente qu'il regarde, lui, tourne.
 *
 * La liste arrive normalement par socket — voir `useJobFeed`. Cette requête
 * est le premier remplissage et le filet quand la liaison temps réel est
 * tombée ; `pollMs` n'est donc renseigné que dans ce second cas, pour ne pas
 * payer deux fois la même information en données mobiles.
 */
export function useGarageJobs({ enabled = true, pollMs = 0 } = {}) {
  return useQuery({
    queryKey: queryKeys.requests.garageJobs(),
    enabled,
    staleTime: 0,
    refetchInterval: pollMs > 0 ? pollMs : false,
    queryFn: api.requests.garageJobs,
  });
}

export function useCancelRequest(requestId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api.requests.cancel(requestId, reason),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function usePublishReview(requestId: string, garageId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReviewBody) => api.requests.review(requestId, body),
    onSuccess: () => {
      // Trois conséquences, trois invalidations : la note agrégée et le
      // nombre d’avis sur la fiche, la liste elle-même — préfixe commun aux
      // pages et à la requête simple — et le droit d’en publier un second,
      // qui vient de tomber.
      void client.invalidateQueries({ queryKey: queryKeys.garages.detail(garageId) });
      void client.invalidateQueries({ queryKey: ['garages', 'reviews', garageId] });
      void client.invalidateQueries({ queryKey: queryKeys.garages.eligibility(garageId) });
      void client.invalidateQueries({ queryKey: queryKeys.me.loyalty() });
    },
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeBody) => api.me.update(body),
    onSuccess: (user) => client.setQueryData(queryKeys.me.profile(), user),
  });
}

export function useAddVehicle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: VehicleInput) => api.me.addVehicle(body),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.me.vehicles() }),
  });
}

export function useUpdateVehicle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: VehicleInput }) =>
      api.me.updateVehicle(id, body),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.me.vehicles() }),
  });
}

export function useDeleteVehicle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.me.deleteVehicle(id),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.me.vehicles() }),
  });
}

export function useSetDefaultVehicle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.me.setDefaultVehicle(id),
    onSuccess: (vehicles) => client.setQueryData(queryKeys.me.vehicles(), vehicles),
  });
}

/**
 * Garage rattaché au compte.
 *
 * Interrogé pour **tout** compte connecté, pas seulement pour un rôle
 * `garage_owner` : c'est cette réponse qui décide si l'écran de compte propose
 * « Devenir garagiste » ou « Mon garage ». Se fier au rôle du profil laisserait
 * un garagiste inscrit à l'instant devant l'invitation à s'inscrire.
 */
export function useMyGarage(enabled = true) {
  return useQuery({ queryKey: queryKeys.me.garage(), enabled, queryFn: api.me.garage });
}

export function useCreateMyGarage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMyGarageBody) => api.me.createGarage(body),
    onSuccess: (garage) => {
      client.setQueryData<MyGarageResponse>(queryKeys.me.garage(), { garage });
      // Le rôle du compte vient de changer côté serveur : le profil en cache
      // dit encore « client », et c'est lui qui commande l'onglet
      // Interventions.
      void client.invalidateQueries({ queryKey: queryKeys.me.profile() });
      // Un garage de plus sur la carte, y compris pour son propriétaire.
      void client.invalidateQueries({ queryKey: ['garages', 'nearby'] });
    },
  });
}

/**
 * Correction du dossier en cours d'examen.
 *
 * La réponse remplace le cache plutôt que de l'invalider : le serveur renvoie
 * le garage tel qu'il vient de l'enregistrer, et repartir le chercher ferait
 * revenir « Mon garage » sur les anciennes valeurs le temps d'un aller-retour.
 *
 * Rien à invalider du côté de la carte : le garage n'est toujours pas vérifié,
 * donc toujours absent des recherches.
 */
export function useUpdateMyGarage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: EditMyGarageBody) => api.me.updateGarage(body),
    onSuccess: (garage) => {
      client.setQueryData<MyGarageResponse>(queryKeys.me.garage(), { garage });
    },
  });
}

/**
 * Retrait du dossier.
 *
 * Le compte redevient un compte client côté serveur : le profil en cache dit
 * encore « garage_owner », et c'est lui qui commande l'onglet Interventions
 * comme le choix entre « Devenir garagiste » et « Mon garage ».
 */
export function useDeleteMyGarage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.me.removeGarage(),
    onSuccess: () => {
      client.setQueryData<MyGarageResponse>(queryKeys.me.garage(), { garage: null });
      void client.invalidateQueries({ queryKey: queryKeys.me.profile() });
    },
  });
}

/**
 * Ouverture ou fermeture de la détection.
 *
 * L'invalidation des recherches est le vrai effet visible : un garage qu'on
 * vient de fermer doit disparaître des résultats SOS, y compris de ceux déjà
 * en cache sur cet appareil.
 */
export function useSetGarageActive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) => api.me.setGarageActive(isActive),
    onSuccess: (garage) => {
      client.setQueryData<MyGarageResponse>(queryKeys.me.garage(), { garage });
      void client.invalidateQueries({ queryKey: ['garages', 'nearby'] });
      void client.invalidateQueries({ queryKey: queryKeys.garages.detail(garage.id) });
    },
  });
}

/**
 * Suppression du compte.
 *
 * Aucune invalidation de cache ici : l'appelant enchaîne sur `logout()`, qui
 * vide le cache en entier. Invalider avant reviendrait à relancer des requêtes
 * authentifiées sur un compte qui n'existe plus.
 */
export function useDeleteAccount() {
  return useMutation({ mutationFn: () => api.me.remove() });
}

/**
 * Sessions ouvertes sur le compte.
 *
 * Rafraîchies à chaque montage de l'écran Sécurité — c'est la donnée qu'on vient
 * vérifier parce qu'on soupçonne quelque chose, et une valeur de cache d'il y a
 * dix minutes ne répondrait pas à la question posée.
 */
export function useSessions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.me.sessions(),
    enabled,
    staleTime: 0,
    queryFn: api.me.sessions,
  });
}

/**
 * Ferme les autres appareils.
 *
 * Le jeton de rafraîchissement local part avec la demande : c'est lui qui
 * désigne la session à épargner. Sans lui, l'appareil qui fait le ménage se
 * déconnecterait lui-même.
 */
export function useRevokeOtherSessions() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error('Aucune session locale');
      return api.me.revokeOtherSessions(refreshToken);
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.me.sessions() }),
  });
}

export function useChangePassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: Omit<ChangePasswordBody, 'refreshToken'>) => {
      // La session courante est épargnée : changer son mot de passe ne doit pas
      // déconnecter l'appareil depuis lequel on le change.
      const refreshToken = await getRefreshToken();
      return api.me.changePassword({ ...body, refreshToken });
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.me.sessions() }),
  });
}
