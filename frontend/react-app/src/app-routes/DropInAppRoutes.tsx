import { useEffect, useState, type ReactNode } from 'react';
import { Routes, useLocation } from 'react-router-dom';
import { useInstalledApps } from '../context/InstalledAppsContext.js';
import { getBundledAppKeys, loadDropInRoutesForApps } from './bundled-app-routes.js';

/** Routes for apps deployed via app-assets/ without a shell rebuild. */
export function DropInAppRoutes() {
  const { allApps } = useInstalledApps();
  const location = useLocation();
  const [dropInRoutes, setDropInRoutes] = useState<ReactNode[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const bundled = getBundledAppKeys();
      const activeDropInCandidates = allApps
        .filter((app) => app.status === 'active' && app.has_react_ui)
        .map((app) => app.app_key)
        .filter((key) => !bundled.has(key));

      if (activeDropInCandidates.length === 0) {
        if (!cancelled) setDropInRoutes([]);
        return;
      }

      const routes = await loadDropInRoutesForApps(activeDropInCandidates);
      if (!cancelled) setDropInRoutes(routes);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [allApps]);

  if (dropInRoutes.length === 0) return null;

  return <Routes location={location}>{dropInRoutes}</Routes>;
}
