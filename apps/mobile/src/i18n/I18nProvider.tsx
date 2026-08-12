import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ErrorCode, Locale } from '@geocras/shared';
import { ApiError } from '../api/client';
import { cameroonDateParts, formatClockTime, formatRelativeAge, formatShortDate } from '../time/clock';
import { errorMessages, translations, type TranslationKey } from './translations';

const STORAGE_KEY = 'geocras.locale';

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  /** Traduit une erreur d'API sur son CODE, jamais sur son message serveur. */
  translateError: (error: unknown) => string;
  /** Formate un nombre avec la virgule décimale française. */
  formatNumber: (value: number, decimals?: number) => string;
  /** Formate une distance en mètres, avec l'unité qui convient à l'échelle. */
  formatDistance: (meters: number) => string;
  /** Formate une durée en minutes, en heures au-delà de soixante. */
  formatDuration: (minutes: number) => string;
  /**
   * Formate l’heure d’un horodatage ISO — « 01h18 ».
   *
   * Toujours en heure du Cameroun, jamais dans le fuseau de l’appareil :
   * l’heure d’une intervention est un fait local que le client et le garagiste
   * doivent lire à l’identique, même si l’un des deux téléphones est mal
   * réglé.
   */
  formatTime: (iso: string) => string;
  /** Date courte d’un horodatage ISO — « 12/08 ». Toujours en mono à l’écran. */
  formatDate: (iso: string) => string;
  /**
   * Intitulé de groupe d’historique — « Août 2026 ».
   *
   * Rendu par le composant en majuscules : c’est un intitulé de section, et
   * ils le sont tous dans le produit.
   */
  formatMonthLabel: (iso: string) => string;
  /** Ancienneté d’un horodatage — « il y a 2 j ». Toujours en mono à l’écran. */
  formatAge: (iso: string) => string;
  /**
   * Forme grammaticale à employer pour un décompte.
   *
   * Le français et l'anglais ne coupent pas au même endroit : « 0 garage » et
   * « 1 garage » sont au singulier en français, alors que l'anglais écrit
   * « 0 garages » et ne réserve le singulier qu'à 1.
   */
  plural: (count: number) => 'one' | 'other';
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Français par défaut, quelle que soit la langue du téléphone.
 *
 * Le marché est francophone : un utilisateur camerounais dont le téléphone est
 * en anglais parce qu'il l'a acheté d'occasion doit quand même trouver l'app en
 * français. L'anglais reste accessible dans les paramètres.
 */
function detectInitialLocale(): Locale {
  const preferred = getLocales()[0]?.languageCode;
  return preferred === 'en' ? 'en' : 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!cancelled && (stored === 'fr' || stored === 'en')) setLocaleState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dictionary = translations[locale];

    return {
      locale,
      setLocale,
      // Le retour de la clé brute en secours est volontaire : une clé visible à
      // l'écran se repère immédiatement, une chaîne vide passe inaperçue.
      t: (key) => dictionary[key] ?? key,
      translateError: (error: unknown) => {
        if (error instanceof ApiError) {
          if (error.code === 'NETWORK_ERROR') {
            return locale === 'fr'
              ? 'Connexion impossible, vérifiez votre réseau'
              : 'Connection failed, check your network';
          }
          return (
            errorMessages[locale][error.code as ErrorCode] ??
            errorMessages[locale].INTERNAL_ERROR ??
            error.message
          );
        }
        return errorMessages[locale].INTERNAL_ERROR ?? 'Erreur';
      },
      formatNumber: (input, decimals = 1) =>
        locale === 'fr'
          ? input.toFixed(decimals).replace('.', ',')
          : input.toFixed(decimals),

      /**
       * En dessous du kilomètre, on affiche des mètres : « 0,5 km » pour un
       * garage à 499 m est illisible au bord de la route, alors que « 500 m »
       * se comprend d'un coup d'œil.
       *
       * L'arrondi à la dizaine n'est pas cosmétique — le GPS annonce lui-même
       * ±5 à 50 m en ville. Afficher « 499 m » promettrait une précision au
       * mètre que la mesure n'a pas.
       */
      formatDistance: (meters) => {
        if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
        const km = meters / 1000;
        const decimals = km < 10 ? 1 : 0;
        const value =
          locale === 'fr'
            ? km.toFixed(decimals).replace('.', ',')
            : km.toFixed(decimals);
        return `${value} km`;
      },

      /**
       * « 380min » n'est pas une durée qu'on lit, c'est une durée qu'on
       * calcule. Au-delà de l'heure on passe en h/min — ce qui arrive dès que
       * le repli propose un garage à cent kilomètres.
       */
      formatDuration: (minutes) => {
        const total = Math.max(1, Math.round(minutes));
        if (total < 60) return `${total}min`;

        const hours = Math.floor(total / 60);
        const rest = total % 60;
        // `6h` plutôt que `6h00` : le zéro n'apporte rien et alourdit la ligne.
        return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
      },

      formatTime: (iso) => formatClockTime(iso, locale),
      formatDate: (iso) => formatShortDate(iso),
      formatMonthLabel: (iso) => {
        const parts = cameroonDateParts(iso);
        if (!parts) return '—';
        const month = dictionary[`month.${parts.month}` as TranslationKey] ?? '';
        return `${month} ${parts.year}`;
      },
      formatAge: (iso) => formatRelativeAge(iso, locale),

      plural: (count) => {
        const value = Math.abs(count);
        return locale === 'fr'
          ? value < 2
            ? 'one'
            : 'other'
          : value === 1
            ? 'one'
            : 'other';
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n doit être utilisé dans <I18nProvider>');
  return context;
}
