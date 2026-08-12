import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LoginBody, PublicUser, SignupBody, UserRole } from '@geocras/shared';
import { api } from '../api/endpoints';
import { queryClient } from '../api/queryClient';
import { clearTokens, getRefreshToken, loadTokens, saveTokens } from '../api/tokens';
import { disconnectSocket } from '../realtime/socket';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthValue = {
  status: AuthStatus;
  user: PublicUser | null;
  role: UserRole | null;
  signup: (body: SignupBody) => Promise<void>;
  login: (body: LoginBody) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Session utilisateur.
 *
 * Context et non Zustand : cette valeur change deux fois dans la vie de l'app
 * (connexion, déconnexion) et n'a rien à faire dans un store optimisé pour des
 * mises à jour à haute fréquence.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await api.me.profile();
      setUser(profile);
      setStatus('authenticated');
    } catch {
      // Jeton expiré et non rafraîchissable : on repasse anonyme sans bruit.
      await clearTokens();
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const tokens = await loadTokens();
      if (!tokens) {
        setStatus('anonymous');
        return;
      }
      await refreshUser();
    })();
  }, [refreshUser]);

  const signup = useCallback(async (body: SignupBody) => {
    const response = await api.auth.signup(body);
    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(async (body: LoginBody) => {
    const response = await api.auth.login(body);
    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = await getRefreshToken();

    // On révoque côté serveur si possible, mais un échec réseau ne doit jamais
    // empêcher une déconnexion locale : l'utilisateur a demandé à sortir.
    if (refreshToken) {
      try {
        await api.auth.logout(refreshToken);
      } catch {
        // Ignoré volontairement.
      }
    }

    await clearTokens();
    disconnectSocket();
    // Le cache contient des données personnelles : historique, fidélité,
    // interventions. Le vider fait partie de la déconnexion.
    queryClient.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      role: user?.role ?? null,
      signup,
      login,
      logout,
      refreshUser,
    }),
    [status, user, signup, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return context;
}
