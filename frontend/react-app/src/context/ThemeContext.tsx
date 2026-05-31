import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, apiHeaders, apiJsonHeaders, readApiError } from '../api/client.js';
import type { components } from '../api/schema.js';
import { useAuth } from './AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import { DEFAULT_COLOR_THEME, type ColorTheme } from '../lib/color-themes.js';

export type UiPreferences = components['schemas']['UiPreferences'];

interface ThemeContextValue {
  preferences: UiPreferences | null;
  loading: boolean;
  error: string | null;
  effectiveTheme: ColorTheme;
  refreshPreferences: () => Promise<void>;
  previewTheme: (theme: ColorTheme) => void;
  setUserTheme: (theme: ColorTheme | null) => Promise<boolean>;
  setTenantTheme: (theme: ColorTheme) => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function applyTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<UiPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPreferences = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setPreferences(null);
      setError(null);
      applyTheme(DEFAULT_COLOR_THEME);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const res = await api.GET('/v1/me/ui-preferences', { headers: apiHeaders(locale) });
    if (res.error || !res.response.ok || !res.data) {
      applyTheme(DEFAULT_COLOR_THEME);
      setPreferences(null);
      setError(await readApiError(res.error, 'Ein Fehler ist aufgetreten.'));
      setLoading(false);
      return;
    }

    setPreferences(res.data);
    applyTheme(res.data.color_theme);
    setLoading(false);
  }, [authLoading, locale, user]);

  useEffect(() => {
    void refreshPreferences();
  }, [refreshPreferences]);

  const previewTheme = useCallback((theme: ColorTheme) => {
    applyTheme(theme);
  }, []);

  const setUserTheme = useCallback(
    async (theme: ColorTheme | null): Promise<boolean> => {
      const res = await api.PATCH('/v1/me/ui-preferences', {
        headers: apiJsonHeaders(locale),
        body: { color_theme: theme },
      });
      if (res.error || !res.response.ok || !res.data) return false;
      setPreferences(res.data);
      applyTheme(res.data.color_theme);
      setError(null);
      return true;
    },
    [locale],
  );

  const setTenantTheme = useCallback(
    async (theme: ColorTheme): Promise<boolean> => {
      const res = await api.PATCH('/v1/tenant/ui-preferences', {
        headers: apiJsonHeaders(locale),
        body: { color_theme: theme },
      });
      if (res.error || !res.response.ok || !res.data) return false;
      setPreferences(res.data);
      applyTheme(res.data.color_theme);
      setError(null);
      return true;
    },
    [locale],
  );

  const effectiveTheme = preferences?.color_theme ?? DEFAULT_COLOR_THEME;

  const value = useMemo(
    () => ({
      preferences,
      loading: loading || authLoading,
      error,
      effectiveTheme,
      refreshPreferences,
      previewTheme,
      setUserTheme,
      setTenantTheme,
    }),
    [
      preferences,
      loading,
      authLoading,
      error,
      effectiveTheme,
      refreshPreferences,
      previewTheme,
      setUserTheme,
      setTenantTheme,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
