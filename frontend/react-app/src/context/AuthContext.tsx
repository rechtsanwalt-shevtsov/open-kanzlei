import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, apiHeaders } from '../api/client.js';
import type { components } from '../api/schema.js';
import { useI18n } from '../i18n/I18nContext.js';

export type CurrentUser = components['schemas']['CurrentUserResponse'];

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (user: CurrentUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await api.GET('/v1/auth/me', {
      headers: apiHeaders(locale),
    });
    if (error || !data) {
      setUser(null);
      return;
    }
    setUser(data.user);
  }, [locale]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.POST('/v1/auth/logout', { headers: apiHeaders(locale) });
    setUser(null);
  }, [locale]);

  const value = useMemo(
    () => ({ user, loading, refresh, setUser, logout }),
    [user, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
