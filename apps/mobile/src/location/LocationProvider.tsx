import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isWithinCameroon } from '@geocras/shared';
import { PositionFilter, type FilteredFix } from './filter';

export type LocationStatus = 'idle' | 'acquiring' | 'ready' | 'denied' | 'unavailable';

export type LocationState = {
  status: LocationStatus;
  fix: FilteredFix | null;
  /** Précision réelle en mètres — affichée telle quelle, jamais embellie. */
  accuracyM: number | null;
  /**
   * `true` quand la position ne vient pas du GPS mais de `EXPO_PUBLIC_DEBUG_ORIGIN`.
   *
   * Exposé pour que l'interface puisse le **dire à l'écran**. Un override de
   * position silencieux est le pire des réglages de développement : on cherche
   * pendant une heure pourquoi les distances sont fausses avant de penser à
   * regarder une variable d'environnement.
   */
  simulated: boolean;
  retry: () => void;
};

const LocationContext = createContext<LocationState | null>(null);

/**
 * Délai au-delà duquel on ouvre l'app sans position.
 *
 * Le cahier des charges est explicite : le splash disparaît quand la position
 * est obtenue **ou** après 4 s, avec un bandeau « position indisponible » et un
 * bouton pour réessayer. Pas de splash décoratif en `setTimeout`.
 */
const ACQUISITION_TIMEOUT_MS = 4000;

/**
 * Position simulée, **développement uniquement**.
 *
 * GeoCras est une app de Yaoundé : son écran d'accueil, ses marqueurs, son
 * repli « aucun garage dans le rayon » ne se voient que depuis Yaoundé. Or
 * l'équipe ne développe pas depuis Yaoundé tous les jours, et à cent
 * kilomètres de là chaque lancement tombe sur le chemin de repli — donc on ne
 * teste jamais le chemin nominal sur appareil réel.
 *
 * `EXPO_PUBLIC_DEBUG_ORIGIN="3.8667,11.5167"` court-circuite le GPS. Vide par
 * défaut, et `__DEV__` garantit que le code ne peut pas s'activer dans un
 * binaire de production même si la variable traînait dans un `.env`.
 */
function debugOrigin(): { lat: number; lng: number } | null {
  if (!__DEV__) return null;

  const raw = process.env.EXPO_PUBLIC_DEBUG_ORIGIN?.trim();
  if (!raw) return null;

  const [lat, lng] = raw.split(',').map((part) => Number(part.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat: lat as number, lng: lng as number };
}

/**
 * Évalué une seule fois, au chargement du module.
 *
 * `null` dans tout build de production et dans tout développement où la
 * variable n'est pas renseignée — c'est-à-dire par défaut. Quand il vaut
 * autre chose, l'écran Carte l'annonce en clair : voir `simulated`.
 */
const SIMULATED_ORIGIN = debugOrigin();

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [fix, setFix] = useState<FilteredFix | null>(null);
  const filter = useRef(new PositionFilter());
  const subscription = useRef<Location.LocationSubscription | null>(null);

  const acquire = useCallback(async () => {
    setStatus('acquiring');

    if (SIMULATED_ORIGIN) {
      // Précision annoncée volontairement médiocre : une position simulée à
      // ±5 m donnerait une confiance que le GPS réel n'atteint pas en ville,
      // et masquerait les défauts d'affichage liés à une précision dégradée.
      setFix({
        lat: SIMULATED_ORIGIN.lat,
        lng: SIMULATED_ORIGIN.lng,
        accuracyM: 18,
        speedMps: 0,
        headingDeg: null,
        timestamp: Date.now(),
        smoothedSpeedMps: 0,
      });
      setStatus('ready');
      return;
    }

    const { status: permission } = await Location.requestForegroundPermissionsAsync();
    if (permission !== Location.PermissionStatus.GRANTED) {
      setStatus('denied');
      return;
    }

    // On n'attend pas indéfiniment : sous un arbre ou entre deux immeubles,
    // le premier point peut ne jamais arriver.
    const timeout = setTimeout(() => {
      setStatus((current) => (current === 'acquiring' ? 'unavailable' : current));
    }, ACQUISITION_TIMEOUT_MS);

    const handle = (position: Location.LocationObject): void => {
      const accepted = filter.current.accept({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy,
        speedMps: position.coords.speed,
        headingDeg: position.coords.heading,
        timestamp: position.timestamp,
      });

      if (!accepted) return;

      // Un point hors du Cameroun signale un GPS non fixé (le fameux 0,0) ou un
      // émulateur mal configuré : mieux vaut « indisponible » qu'une carte
      // centrée au large du golfe de Guinée.
      if (!isWithinCameroon({ lat: accepted.lat, lng: accepted.lng })) return;

      clearTimeout(timeout);
      setFix(accepted);
      setStatus('ready');
    };

    try {
      const first = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      handle(first);
    } catch {
      // Le suivi continu peut encore aboutir même si le point immédiat échoue.
    }

    subscription.current?.remove();
    subscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        // Seuils volontairement lâches : chaque réveil GPS coûte de la batterie,
        // et l'utilisateur en panne n'a pas de chargeur.
        timeInterval: 5000,
        distanceInterval: 10,
      },
      handle,
    );
  }, []);

  useEffect(() => {
    void acquire();
    return () => {
      subscription.current?.remove();
      subscription.current = null;
    };
  }, [acquire]);

  const retry = useCallback(() => {
    filter.current.reset();
    setFix(null);
    void acquire();
  }, [acquire]);

  const value = useMemo<LocationState>(
    () => ({
      status,
      fix,
      accuracyM: fix?.accuracyM ?? null,
      simulated: SIMULATED_ORIGIN !== null,
      retry,
    }),
    [status, fix, retry],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationState {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation doit être utilisé dans <LocationProvider>');
  return context;
}

/** Raccourci : coordonnées seules, ou `null` tant qu'il n'y a pas de point. */
export function useCoordinates(): { lat: number; lng: number } | null {
  const { fix } = useLocation();
  return fix ? { lat: fix.lat, lng: fix.lng } : null;
}
