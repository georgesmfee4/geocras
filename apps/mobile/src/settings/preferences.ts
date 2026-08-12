import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'geocras.preferences';

/**
 * Rayons proposés, en kilomètres.
 *
 * Trois valeurs et pas un curseur : le choix n'est pas continu dans la tête de
 * l'utilisateur, il est situationnel. **5 km** couvre un quartier de Yaoundé
 * sans noyer la carte ; **15 km** est le défaut, l'échelle d'une ville ;
 * **40 km** sert sur la nationale, là où le garage le plus proche est à une
 * demi-heure et où voir loin devient la seule information utile.
 */
export const SEARCH_RADIUS_OPTIONS = [5, 15, 40] as const;
export type SearchRadiusKm = (typeof SEARCH_RADIUS_OPTIONS)[number];

export const DEFAULT_SEARCH_RADIUS_KM: SearchRadiusKm = 15;

/**
 * Écriture groupée.
 *
 * Un seul enregistrement pour tous les réglages : deux clés séparées auraient
 * fini par diverger le jour où l'une est écrite et l'autre pas.
 */
function persist(state: { searchRadiusKm: SearchRadiusKm; haptics: boolean }): void {
  void AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ searchRadiusKm: state.searchRadiusKm, haptics: state.haptics }),
  );
}

type PreferencesState = {
  /** Rayon d'affichage de la carte. Ne concerne pas la recherche SOS, qui est
   * arbitrée par le serveur. */
  searchRadiusKm: SearchRadiusKm;
  /**
   * Vibration aux moments qui comptent — acceptation d'un garagiste, annulation
   * confirmée.
   *
   * Réglable parce qu'elle ne convient pas à tout le monde : un téléphone posé
   * sur un tableau de bord vibre bruyamment, et certains la coupent pour de
   * bon. Elle reste active par défaut : c'est le seul signal qui traverse une
   * poche.
   */
  haptics: boolean;
  /** `false` tant que le stockage n'a pas été relu au démarrage. */
  hydrated: boolean;
  setSearchRadiusKm: (value: SearchRadiusKm) => void;
  setHaptics: (value: boolean) => void;
  hydrate: () => Promise<void>;
};

/**
 * Réglages qui vivent sur l'appareil.
 *
 * Zustand et non TanStack Query : ce ne sont pas des données serveur, et ils
 * doivent être lisibles **avant** toute requête — c'est le rayon qui décide de
 * la requête, pas l'inverse.
 *
 * L'écriture est optimiste et la persistance suit sans être attendue : basculer
 * un réglage doit être instantané, et un `await` sur le disque au milieu d'un
 * appui se voit sur un téléphone d'entrée de gamme.
 */
export const usePreferences = create<PreferencesState>((set, get) => ({
  searchRadiusKm: DEFAULT_SEARCH_RADIUS_KM,
  haptics: true,
  hydrated: false,

  setSearchRadiusKm: (value) => {
    set({ searchRadiusKm: value });
    persist(get());
  },

  setHaptics: (value) => {
    set({ haptics: value });
    persist(get());
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;

      const record = (parsed !== null && typeof parsed === 'object' ? parsed : {}) as {
        searchRadiusKm?: number;
        haptics?: boolean;
      };

      const radius = SEARCH_RADIUS_OPTIONS.includes(record.searchRadiusKm as SearchRadiusKm)
        ? (record.searchRadiusKm as SearchRadiusKm)
        : DEFAULT_SEARCH_RADIUS_KM;

      set({
        searchRadiusKm: radius,
        haptics: typeof record.haptics === 'boolean' ? record.haptics : true,
        hydrated: true,
      });
    } catch {
      // Un stockage illisible ne doit pas empêcher l'app de s'ouvrir : on
      // repart du défaut, qui est un choix valide.
      set({ hydrated: true });
    }
  },
}));
