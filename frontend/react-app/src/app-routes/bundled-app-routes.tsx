import type { ReactNode } from 'react';

const routeModules = import.meta.glob('@apps/*/frontend/routes.tsx', {
  eager: true,
});

type RouteModule = {
  appKey?: string;
  appRoutes?: ReactNode;
};

function collectBundledRoutes(): ReactNode[] {
  const routes: ReactNode[] = [];
  for (const mod of Object.values(routeModules)) {
    const record = mod as RouteModule;
    if (record.appRoutes != null) routes.push(record.appRoutes);
  }
  return routes;
}

/** Monorepo apps discovered from apps directory route modules */
export const bundledAppRoutes = collectBundledRoutes();

export function getBundledAppKeys(): Set<string> {
  const keys = new Set<string>();
  for (const mod of Object.values(routeModules)) {
    const record = mod as RouteModule;
    if (record.appKey) keys.add(record.appKey);
  }
  return keys;
}

async function loadDropInAppRoutes(appKey: string): Promise<ReactNode | null> {
  try {
    const mod = (await import(/* @vite-ignore */ `/app-assets/${appKey}/entry.js`)) as RouteModule;
    return mod.appRoutes ?? null;
  } catch {
    return null;
  }
}

export async function loadDropInRoutesForApps(appKeys: string[]): Promise<ReactNode[]> {
  const bundled = getBundledAppKeys();
  const missing = appKeys.filter((key) => !bundled.has(key));
  if (missing.length === 0) return [];

  const loaded = await Promise.all(missing.map((key) => loadDropInAppRoutes(key)));
  return loaded.filter((routes) => routes != null);
}
