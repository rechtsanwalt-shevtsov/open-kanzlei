import type pg from 'pg';
import { getAppManifest } from '../../platform/apps/registry.js';
import { TASKS_KANBAN_APP_KEY } from './constants.js';

export interface WipLimitsSettings {
  default: Record<string, number>;
  users: Record<string, Record<string, number>>;
}

export function emptyWipLimits(): WipLimitsSettings {
  return { default: { started: 10 }, users: {} };
}

export function parseWipLimits(raw: unknown): WipLimitsSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyWipLimits();
  }
  const obj = raw as Record<string, unknown>;
  const defaultBlock =
    obj.default && typeof obj.default === 'object' && !Array.isArray(obj.default)
      ? (obj.default as Record<string, number>)
      : { started: 10 };
  const users: Record<string, Record<string, number>> = {};
  if (obj.users && typeof obj.users === 'object' && !Array.isArray(obj.users)) {
    for (const [userId, limits] of Object.entries(obj.users as Record<string, unknown>)) {
      if (limits && typeof limits === 'object' && !Array.isArray(limits)) {
        users[userId] = { ...(limits as Record<string, number>) };
      }
    }
  }
  return normalizeWipLimitsSettings({ default: { ...defaultBlock }, users });
}

export function getEffectiveUserWipLimits(
  wipLimits: WipLimitsSettings,
  userId: string,
): Record<string, number> {
  const userEntry = wipLimits.users[userId];
  if (userEntry && Object.keys(userEntry).length > 0) {
    return { ...userEntry };
  }
  return { ...wipLimits.default };
}

export async function loadTenantWipLimits(
  client: pg.PoolClient,
  tenantId: string,
): Promise<WipLimitsSettings> {
  const result = await client.query<{ settings: Record<string, unknown> }>(
    `SELECT settings FROM platform.app_tenant_settings
     WHERE tenant_id = $1 AND app_key = $2`,
    [tenantId, TASKS_KANBAN_APP_KEY],
  );
  const settings = result.rows[0]?.settings ?? {};
  const manifest = getAppManifest(TASKS_KANBAN_APP_KEY);
  const fallback = manifest?.settings_schema?.wipLimits?.default;
  const parsed = parseWipLimits(settings.wipLimits ?? fallback);
  return parsed;
}

export async function saveTenantWipLimits(
  client: pg.PoolClient,
  tenantId: string,
  wipLimits: WipLimitsSettings,
): Promise<void> {
  const manifest = getAppManifest(TASKS_KANBAN_APP_KEY);
  if (!manifest) return;

  const existing = await client.query<{ settings: Record<string, unknown> }>(
    `SELECT settings FROM platform.app_tenant_settings
     WHERE tenant_id = $1 AND app_key = $2`,
    [tenantId, TASKS_KANBAN_APP_KEY],
  );
  const settings = {
    ...(existing.rows[0]?.settings ?? {}),
    wipLimits: normalizeWipLimitsSettings(wipLimits),
  };
  await client.query(
    `INSERT INTO platform.app_tenant_settings (tenant_id, app_key, settings, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (tenant_id, app_key) DO UPDATE
       SET settings = EXCLUDED.settings, updated_at = now()`,
    [tenantId, TASKS_KANBAN_APP_KEY, JSON.stringify(settings)],
  );
}

export async function ensureWipLimitsForAllUsers(
  client: pg.PoolClient,
  tenantId: string,
): Promise<WipLimitsSettings> {
  let wipLimits = await loadTenantWipLimits(client, tenantId);
  const users = await client.query<{ id: string }>(
    `SELECT id FROM platform.users WHERE tenant_id = $1`,
    [tenantId],
  );
  const before = JSON.stringify(wipLimits);
  let changed = false;
  for (const row of users.rows) {
    if (!wipLimits.users[row.id]) {
      wipLimits.users[row.id] = { ...wipLimits.default };
      changed = true;
    }
  }
  wipLimits = normalizeWipLimitsSettings(wipLimits);
  if (changed || JSON.stringify(wipLimits) !== before) {
    await saveTenantWipLimits(client, tenantId, wipLimits);
  }
  return wipLimits;
}

/** Cap each activity limit so it never exceeds the started limit. */
export function clampActivityLimitsToStarted(limits: Record<string, number>): Record<string, number> {
  const started = limits.started;
  if (typeof started !== 'number' || !Number.isFinite(started)) {
    return { ...limits };
  }
  const next = { ...limits };
  for (const [key, value] of Object.entries(next)) {
    if (key === 'started') continue;
    if (typeof value === 'number' && Number.isFinite(value) && value > started) {
      next[key] = started;
    }
  }
  return next;
}

export function normalizeWipLimitsSettings(wipLimits: WipLimitsSettings): WipLimitsSettings {
  return {
    default: clampActivityLimitsToStarted({ ...wipLimits.default }),
    users: Object.fromEntries(
      Object.entries(wipLimits.users).map(([userId, limits]) => [
        userId,
        clampActivityLimitsToStarted({ ...limits }),
      ]),
    ),
  };
}

export function setUserWipLimit(
  wipLimits: WipLimitsSettings,
  userId: string,
  columnKey: string,
  value: number | null,
): WipLimitsSettings {
  const next = {
    default: { ...wipLimits.default },
    users: { ...wipLimits.users },
  };
  const userLimits = { ...(next.users[userId] ?? next.default) };
  if (value === null || value === undefined) {
    delete userLimits[columnKey];
  } else {
    userLimits[columnKey] = value;
  }
  next.users[userId] = clampActivityLimitsToStarted(userLimits);
  return next;
}

export function getWipLimitForColumn(
  limits: Record<string, number>,
  columnKey: string,
): number | null {
  if (!(columnKey in limits)) return null;
  const value = limits[columnKey];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
