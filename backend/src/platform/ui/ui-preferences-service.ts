import { badRequest } from '../../api/errors.js';
import { getEventService } from '../../foundation/events/event-service.js';
import { withTenantTransaction } from '../../foundation/database/tenant-context.js';
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  isColorTheme,
  resolveEffectiveColorTheme,
  type ColorTheme,
} from '../../foundation/ui/color-themes.js';

export interface UiPreferencesDto {
  color_theme: ColorTheme;
  tenant_color_theme: ColorTheme;
  user_color_theme: ColorTheme | null;
  available_themes: ColorTheme[];
}

function readTenantColorTheme(settings: Record<string, unknown>): ColorTheme {
  return isColorTheme(settings.color_theme) ? settings.color_theme : DEFAULT_COLOR_THEME;
}

export async function getUiPreferences(
  tenantId: string,
  userId: string,
): Promise<UiPreferencesDto> {
  return withTenantTransaction(tenantId, async (client) => {
    const tenantRow = await client.query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM platform.tenant_profiles WHERE tenant_id = $1`,
      [tenantId],
    );
    const userRow = await client.query<{ preferred_color_theme: ColorTheme | null }>(
      `SELECT preferred_color_theme FROM platform.users WHERE id = $1`,
      [userId],
    );

    const tenantSettings = tenantRow.rows[0]?.settings ?? {};
    const tenantColorTheme = readTenantColorTheme(tenantSettings);
    const userTheme = userRow.rows[0]?.preferred_color_theme ?? null;

    return {
      color_theme: resolveEffectiveColorTheme(tenantColorTheme, userTheme),
      tenant_color_theme: tenantColorTheme,
      user_color_theme: userTheme,
      available_themes: [...COLOR_THEMES],
    };
  });
}

export async function patchUserColorTheme(
  tenantId: string,
  userId: string,
  colorTheme: unknown,
): Promise<UiPreferencesDto> {
  if (colorTheme !== null && !isColorTheme(colorTheme)) {
    throw badRequest('error.validation_failed');
  }

  await withTenantTransaction(tenantId, async (client) => {
    await client.query(
      `UPDATE platform.users
       SET preferred_color_theme = $2, updated_at = now()
       WHERE id = $1 AND tenant_id = $3`,
      [userId, colorTheme, tenantId],
    );
  });

  return getUiPreferences(tenantId, userId);
}

export async function patchTenantColorTheme(
  tenantId: string,
  userId: string,
  colorTheme: unknown,
): Promise<UiPreferencesDto> {
  if (!isColorTheme(colorTheme)) {
    throw badRequest('error.validation_failed');
  }

  await withTenantTransaction(tenantId, async (client) => {
    await client.query(
      `UPDATE platform.tenant_profiles
       SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{color_theme}', to_jsonb($2::text)),
           updated_at = now()
       WHERE tenant_id = $1`,
      [tenantId, colorTheme],
    );

    await getEventService().publish(client, {
      tenantId,
      type: 'tenant_profile.updated',
      aggregateType: 'tenant_profile',
      aggregateId: tenantId,
      actorUserId: userId,
      data: {},
    });
  });

  return getUiPreferences(tenantId, userId);
}
