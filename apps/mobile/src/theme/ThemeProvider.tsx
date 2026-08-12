import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import {
  chamfer,
  markerShape,
  markerSize,
  palette,
  radius,
  space,
  type,
  type ColorScheme,
  type Colors,
} from './tokens';

export type ThemePreference = 'light' | 'dark' | 'auto';

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  chamfer: typeof chamfer;
  markerShape: typeof markerShape;
  markerSize: typeof markerSize;
};

type ThemeContextValue = Theme & {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'geocras.theme-preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: palette[scheme],
    space,
    radius,
    type,
    chamfer,
    markerShape,
    markerSize,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        setPreferenceState(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setPreference(next: ThemePreference): void {
    // On applique immédiatement et on persiste sans attendre : une bascule de
    // thème ne doit jamais donner l'impression d'un temps de latence.
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const scheme: ColorScheme =
    preference === 'auto' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ ...buildTheme(scheme), preference, setPreference }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé à l’intérieur de <ThemeProvider>');
  }
  return context;
}
