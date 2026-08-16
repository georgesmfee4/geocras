import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/**
 * Politique de cache et de réessai, calibrée pour un réseau irrégulier.
 *
 * Le principe : **afficher la dernière donnée connue plutôt qu'un indicateur de
 * chargement**. Un utilisateur en panne au bord de la route préfère une liste
 * de garages vieille de deux minutes à un écran vide qui tourne.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      // On sert le cache immédiatement, la revalidation arrive derrière.
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Réessayer un 403 ou un 404 est une perte de données mobiles : seule
        // une panne réseau ou serveur mérite une seconde chance.
        if (error instanceof ApiError && !error.isRetryable) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
    },
    mutations: {
      // Une mutation rejouée peut créer un doublon. Les seules routes
      // idempotentes (arrivée, session de conduite) gèrent leur propre reprise.
      retry: false,
    },
  },
});

/** Clés de cache centralisées : évite les invalidations qui ratent leur cible. */
export const queryKeys = {
  garages: {
    nearby: (lat: number, lng: number, sort: string) =>
      ['garages', 'nearby', Math.round(lat * 1000), Math.round(lng * 1000), sort] as const,
    detail: (id: string) => ['garages', 'detail', id] as const,
    reviews: (id: string, page: number) => ['garages', 'reviews', id, page] as const,
    /**
     * Avis paginés d'un garage, chargés page après page.
     *
     * Clé distincte de `reviews`, mais **sous le même préfixe** : publier un
     * avis invalide `['garages', 'reviews', id]` et emporte les deux d'un coup.
     */
    reviewPages: (id: string) => ['garages', 'reviews', id, 'pages'] as const,
    eligibility: (id: string) => ['garages', 'eligibility', id] as const,
  },
  requests: {
    detail: (id: string) => ['requests', 'detail', id] as const,
    mine: (page: number) => ['requests', 'mine', page] as const,
    /**
     * Historique chargé page après page.
     *
     * Clé distincte de `mine`, mais **sous le même préfixe** : envoyer un SOS
     * invalide `['requests', 'mine']` et emporte les deux d'un coup.
     */
    minePages: () => ['requests', 'mine', 'pages'] as const,
    /** Demande en cours, interrogée avant d'ouvrir une nouvelle déclaration. */
    active: () => ['requests', 'active'] as const,
    /**
     * File de travail du garagiste.
     *
     * Sous le préfixe `requests` : ce sont les mêmes demandes, vues de l'autre
     * côté, et les actions du garagiste doivent invalider les deux vues d'un
     * seul geste.
     */
    garageJobs: () => ['requests', 'garage'] as const,
    /**
     * Garages proposés pour une demande.
     *
     * La création renvoie la demande **et** son classement de garages dans le
     * même aller-retour. Sans cette clé, l'écran de résultats relancerait une
     * recherche identique une seconde plus tard : deux fois le réseau pour la
     * même réponse, au moment précis où l'utilisateur attend.
     */
    candidates: (id: string) => ['requests', 'candidates', id] as const,
  },
  me: {
    profile: () => ['me', 'profile'] as const,
    vehicles: () => ['me', 'vehicles'] as const,
    /** Garage rattaché au compte — `{ garage: null }` pour un client. */
    garage: () => ['me', 'garage'] as const,
    loyalty: () => ['me', 'loyalty'] as const,
    /** Appareils qui peuvent renouveler leur accès au compte. */
    sessions: () => ['me', 'sessions'] as const,
    loyaltyHistory: (page: number) => ['me', 'loyalty', 'history', page] as const,
  },
  driving: {
    history: (page: number) => ['driving', 'history', page] as const,
  },
} as const;
