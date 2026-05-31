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
import { useAuth } from './AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import type { components } from '../api/schema.js';

export type InstalledApp = components['schemas']['AppInstallation'];

export interface SidebarAppItem {
  app_key: string;
  name: string;
  nav_path: string;
  nav_icon: string | null;
  menu_category: InstalledApp['menu_category'];
}

interface InstalledAppsContextValue {
  workApps: SidebarAppItem[];
  administrationApps: SidebarAppItem[];
  allApps: InstalledApp[];
  loading: boolean;
  refreshInstalledApps: () => Promise<void>;
}

const InstalledAppsContext = createContext<InstalledAppsContextValue | null>(null);

function toSidebarItem(app: InstalledApp): SidebarAppItem | null {
  if (!app.has_react_ui || !app.nav_path || app.status !== 'active') return null;
  return {
    app_key: app.app_key,
    name: app.name,
    nav_path: app.nav_path,
    nav_icon: app.nav_icon,
    menu_category: app.menu_category,
  };
}

export function InstalledAppsProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const { user } = useAuth();
  const [allApps, setAllApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshInstalledApps = useCallback(async () => {
    if (!user) {
      setAllApps([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const res = await api.GET('/v1/apps', { headers: apiHeaders(locale) });
    if (res.error || !res.response.ok) {
      setAllApps([]);
      setLoading(false);
      return;
    }

    setAllApps(res.data?.items ?? []);
    setLoading(false);
  }, [locale, user]);

  useEffect(() => {
    void refreshInstalledApps();
  }, [refreshInstalledApps]);

  const sidebarApps = useMemo(
    () =>
      allApps
        .map(toSidebarItem)
        .filter((item): item is SidebarAppItem => item !== null)
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [allApps, locale],
  );

  const workApps = useMemo(
    () => sidebarApps.filter((app) => app.menu_category === 'work'),
    [sidebarApps],
  );

  const administrationApps = useMemo(
    () => sidebarApps.filter((app) => app.menu_category === 'administration'),
    [sidebarApps],
  );

  const value = useMemo(
    () => ({
      workApps,
      administrationApps,
      allApps,
      loading,
      refreshInstalledApps,
    }),
    [workApps, administrationApps, allApps, loading, refreshInstalledApps],
  );

  return (
    <InstalledAppsContext.Provider value={value}>{children}</InstalledAppsContext.Provider>
  );
}

export function useInstalledApps(): InstalledAppsContextValue {
  const ctx = useContext(InstalledAppsContext);
  if (!ctx) {
    throw new Error('useInstalledApps must be used within InstalledAppsProvider');
  }
  return ctx;
}
