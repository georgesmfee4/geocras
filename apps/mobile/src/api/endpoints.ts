import type {
  ActiveRequestResponse,
  AssistanceRequest,
  AuthResponse,
  AuthSessionsResponse,
  ChangePasswordBody,
  CreateMyGarageBody,
  CreateRequestBody,
  CreateRequestResponse,
  CreateReviewBody,
  DrivingHistoryResponse,
  DrivingSession,
  EditMyGarageBody,
  GarageDetail,
  GarageReviewsResponse,
  LoginBody,
  LoyaltyHistoryResponse,
  LoyaltySummary,
  MyGarage,
  MyGarageResponse,
  NearbyQuery,
  NearbyResponse,
  Position,
  PublicUser,
  RequestDetail,
  RequestHistoryResponse,
  Review,
  RevokeOtherSessionsResponse,
  ReviewEligibility,
  SignUploadResponse,
  SignupBody,
  SubmitDrivingSessionBody,
  UpdateMeBody,
  UploadFolder,
  Vehicle,
  VehicleInput,
} from '@geocras/shared';
import { apiFetch } from './client';

/**
 * Surface HTTP typée.
 *
 * Les types viennent de `@geocras/shared`, donc du même schéma zod que celui
 * qui valide côté serveur : une réponse ne peut pas dériver du contrat sans
 * casser la compilation des deux côtés à la fois.
 */
export const api = {
  auth: {
    signup: (body: SignupBody) =>
      apiFetch<AuthResponse>('/auth/signup', { method: 'POST', body, auth: false }),
    login: (body: LoginBody) =>
      apiFetch<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),
    logout: (refreshToken: string) =>
      apiFetch<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
  },

  garages: {
    nearby: (query: NearbyQuery) =>
      apiFetch<NearbyResponse>('/garages/nearby', {
        auth: false,
        query: {
          lat: query.lat,
          lng: query.lng,
          radiusKm: query.radiusKm,
          sort: query.sort,
          limit: query.limit,
          openNow: query.openNow,
          certifiedOnly: query.certifiedOnly,
          ...(query.services && query.services.length > 0
            ? { services: query.services.join(','), matchAny: query.matchAny }
            : {}),
        },
      }),
    detail: (id: string, origin?: { lat: number; lng: number }) =>
      apiFetch<GarageDetail>(`/garages/${id}`, {
        auth: false,
        query: origin ? { lat: origin.lat, lng: origin.lng } : undefined,
      }),
    reviews: (id: string, page = 1, pageSize = 20) =>
      apiFetch<GarageReviewsResponse>(`/garages/${id}/reviews`, {
        auth: false,
        query: { page, pageSize },
      }),
    reviewEligibility: (id: string) =>
      apiFetch<ReviewEligibility>(`/garages/${id}/review-eligibility`),
  },

  requests: {
    create: (body: CreateRequestBody) =>
      apiFetch<CreateRequestResponse>('/requests', { method: 'POST', body }),
    detail: (id: string) => apiFetch<RequestDetail>(`/requests/${id}`),
    /** Demande en cours du client, ou `{ request: null }`. */
    active: () => apiFetch<ActiveRequestResponse>('/requests/active'),
    mine: (page = 1, pageSize = 20) =>
      apiFetch<RequestHistoryResponse>('/requests/mine', { query: { page, pageSize } }),
    selectGarage: (id: string, garageId: string) =>
      apiFetch<AssistanceRequest>(`/requests/${id}/select`, { method: 'POST', body: { garageId } }),
    accept: (id: string) => apiFetch<AssistanceRequest>(`/requests/${id}/accept`, { method: 'POST' }),
    enRoute: (id: string) =>
      apiFetch<AssistanceRequest>(`/requests/${id}/en-route`, { method: 'POST' }),
    confirmArrival: (id: string, position: { lat: number; lng: number } | null) =>
      apiFetch<AssistanceRequest>(`/requests/${id}/arrive`, { method: 'POST', body: { position } }),
    cancel: (id: string, reason: string) =>
      apiFetch<AssistanceRequest>(`/requests/${id}/cancel`, { method: 'POST', body: { reason } }),
    /** Repli HTTP quand le socket est tombé. */
    pushPosition: (id: string, position: Position) =>
      apiFetch<void>(`/requests/${id}/position`, { method: 'POST', body: { position } }),
    review: (id: string, body: CreateReviewBody) =>
      apiFetch<Review>(`/requests/${id}/review`, { method: 'POST', body }),
  },

  me: {
    profile: () => apiFetch<PublicUser>('/me'),
    update: (body: UpdateMeBody) => apiFetch<PublicUser>('/me', { method: 'PATCH', body }),
    /** Suppression définitive. Le serveur refuse tant qu'une demande est en cours. */
    remove: () => apiFetch<void>('/me', { method: 'DELETE' }),
    garage: () => apiFetch<MyGarageResponse>('/me/garage'),
    createGarage: (body: CreateMyGarageBody) =>
      apiFetch<MyGarage>('/me/garage', { method: 'POST', body }),
    /**
     * Correction du dossier, tant qu'il est à l'étude.
     *
     * `PUT` : le dossier repart en entier, y compris les champs inchangés. Le
     * serveur refuse une fois la vérification faite.
     */
    updateGarage: (body: EditMyGarageBody) =>
      apiFetch<MyGarage>('/me/garage', { method: 'PUT', body }),
    /** Retrait du dossier. Le compte redevient un compte client. */
    removeGarage: () => apiFetch<void>('/me/garage', { method: 'DELETE' }),
    setGarageActive: (isActive: boolean) =>
      apiFetch<MyGarage>('/me/garage', { method: 'PATCH', body: { isActive } }),
    vehicles: () => apiFetch<Vehicle[]>('/me/vehicles'),
    addVehicle: (body: VehicleInput) =>
      apiFetch<Vehicle>('/me/vehicles', { method: 'POST', body }),
    updateVehicle: (id: string, body: VehicleInput) =>
      apiFetch<Vehicle>(`/me/vehicles/${id}`, { method: 'PATCH', body }),
    setDefaultVehicle: (id: string) =>
      apiFetch<Vehicle[]>(`/me/vehicles/${id}/default`, { method: 'POST' }),
    deleteVehicle: (id: string) => apiFetch<void>(`/me/vehicles/${id}`, { method: 'DELETE' }),
    loyalty: () => apiFetch<LoyaltySummary>('/me/loyalty'),
    sessions: () => apiFetch<AuthSessionsResponse>('/me/sessions'),
    revokeOtherSessions: (refreshToken: string) =>
      apiFetch<RevokeOtherSessionsResponse>('/me/sessions/revoke-others', {
        method: 'POST',
        body: { refreshToken },
      }),
    changePassword: (body: ChangePasswordBody) =>
      apiFetch<{ revoked: number }>('/me/password', { method: 'PATCH', body }),
    loyaltyHistory: (page = 1, pageSize = 20) =>
      apiFetch<LoyaltyHistoryResponse>('/me/loyalty/history', { query: { page, pageSize } }),
    claimReferral: (code: string) =>
      apiFetch<void>('/me/referral/claim', { method: 'POST', body: { code } }),
  },

  driving: {
    submit: (body: SubmitDrivingSessionBody) =>
      apiFetch<DrivingSession>('/driving/sessions', { method: 'POST', body }),
    history: (page = 1, pageSize = 20) =>
      apiFetch<DrivingHistoryResponse>('/driving/sessions', { query: { page, pageSize } }),
  },

  uploads: {
    sign: (folder: UploadFolder) =>
      apiFetch<SignUploadResponse>('/uploads/sign', {
        method: 'POST',
        body: { folder },
        // Une photo est un confort : mieux vaut abandonner vite et laisser
        // partir la demande que faire patienter vingt secondes pour elle.
        timeoutMs: 8000,
      }),
  },
} as const;
