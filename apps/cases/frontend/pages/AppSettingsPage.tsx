import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { readApiError } from '@shell/api/client.js';
import { useAuth } from '@shell/context/AuthContext.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import {
  fetchEffectiveSettings,
  fetchTenantSettings,
  fetchUserSettings,
  patchTenantSettings,
  patchUserSettings,
} from '../api.js';
import {
  coerceSettingValue,
  formatSettingValue,
  parseSettingSelectValue,
  settingLabelKey,
  settingOptions,
  settingSelectValue,
} from '../lib/app-setting-ui.js';
import {
  CASES_SETTINGS_SCHEMA,
  type AppSettingFieldSchema,
} from '../settings-schema.js';

function isAdmin(roles: string[]): boolean {
  return roles.includes('admin');
}

function normalizeSettings(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(CASES_SETTINGS_SCHEMA)) {
    if (key in raw) {
      out[key] = coerceSettingValue(field, raw[key]);
    }
  }
  return out;
}

function firmValue(
  key: string,
  field: AppSettingFieldSchema,
  tenantDraft: Record<string, unknown>,
): unknown {
  return key in tenantDraft
    ? tenantDraft[key]
    : field.default;
}

function userValue(
  key: string,
  field: AppSettingFieldSchema,
  tenantDraft: Record<string, unknown>,
  userDraft: Record<string, unknown>,
): unknown {
  if (key in userDraft) return userDraft[key];
  return firmValue(key, field, tenantDraft);
}

export function AppSettingsPage() {
  const { locale, msg } = useI18n();
  const { user } = useAuth();
  const admin = user ? isAdmin(user.roles) : false;

  const [tenantDraft, setTenantDraft] = useState<Record<string, unknown>>({});
  const [userDraft, setUserDraft] = useState<Record<string, unknown>>({});
  const [tenantLoaded, setTenantLoaded] = useState<Record<string, unknown>>({});
  const [userLoaded, setUserLoaded] = useState<Record<string, unknown>>({});
  const [effective, setEffective] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const settingRows = useMemo(
    () => Object.entries(CASES_SETTINGS_SCHEMA),
    [],
  );

  async function load() {
    setLoading(true);
    setError(null);

    const effRes = await fetchEffectiveSettings(locale);
    if (effRes.error || !effRes.response.ok) {
      setError(await readApiError(effRes.error, msg('errorGeneric')));
      setLoading(false);
      return;
    }
    setEffective(effRes.data?.settings ?? {});

    let tenant: Record<string, unknown> = {};
    if (admin) {
      const tRes = await fetchTenantSettings(locale);
      if (tRes.error || !tRes.response.ok) {
        setError(await readApiError(tRes.error, msg('errorGeneric')));
        setLoading(false);
        return;
      }
      tenant = normalizeSettings((tRes.data as Record<string, unknown>) ?? {});
    }

    const uRes = await fetchUserSettings(locale);
    if (uRes.error || !uRes.response.ok) {
      setError(await readApiError(uRes.error, msg('errorGeneric')));
      setLoading(false);
      return;
    }
    const userSettings = normalizeSettings((uRes.data as Record<string, unknown>) ?? {});

    setTenantDraft(tenant);
    setTenantLoaded(tenant);
    setUserDraft(userSettings);
    setUserLoaded(userSettings);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [locale, admin]);

  const tenantDirty = useMemo(() => {
    if (!admin) return false;
    return settingRows.some(([key, field]) => {
      if (!field.tenantConfigurable) return false;
      const current = firmValue(key, field, tenantDraft);
      const loaded = firmValue(key, field, tenantLoaded);
      return JSON.stringify(current) !== JSON.stringify(loaded);
    });
  }, [admin, settingRows, tenantDraft, tenantLoaded]);

  const userDirty = useMemo(() => {
    return settingRows.some(([key, field]) => {
      if (!field.userOverridable) return false;
      const current = key in userDraft ? userDraft[key] : undefined;
      const loaded = key in userLoaded ? userLoaded[key] : undefined;
      if (current === undefined && loaded === undefined) return false;
      return JSON.stringify(current) !== JSON.stringify(loaded);
    });
  }, [settingRows, userDraft, userLoaded]);

  function buildTenantPatch(): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    for (const [key, field] of settingRows) {
      if (!field.tenantConfigurable) continue;
      const current = firmValue(key, field, tenantDraft);
      const loaded = firmValue(key, field, tenantLoaded);
      if (JSON.stringify(current) !== JSON.stringify(loaded)) {
        patch[key] = current;
      }
    }
    return patch;
  }

  function buildUserPatch(): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    for (const [key, field] of settingRows) {
      if (!field.userOverridable) continue;
      if (!(key in userDraft)) continue;
      const current = userDraft[key];
      const loaded = key in userLoaded ? userLoaded[key] : undefined;
      if (JSON.stringify(current) !== JSON.stringify(loaded)) {
        patch[key] = current;
      }
    }
    return patch;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const tenantPatch = buildTenantPatch();
    const userPatch = buildUserPatch();
    if (Object.keys(tenantPatch).length === 0 && Object.keys(userPatch).length === 0) {
      return;
    }

    setSubmitting(true);
    setSaved(false);
    setError(null);

    try {
      if (admin && Object.keys(tenantPatch).length > 0) {
        const res = await patchTenantSettings(locale, tenantPatch);
        if (res.error || !res.response.ok) {
          setError(await readApiError(res.error, msg('errorGeneric')));
          return;
        }
      }

      if (Object.keys(userPatch).length > 0) {
        const res = await patchUserSettings(locale, userPatch);
        if (res.error || !res.response.ok) {
          setError(await readApiError(res.error, msg('errorGeneric')));
          return;
        }
      }

      setSaved(true);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  function handleFirmChange(key: string, field: AppSettingFieldSchema, raw: string) {
    const value = parseSettingSelectValue(field, raw);
    setTenantDraft((draft) => ({ ...draft, [key]: value }));
    setSaved(false);
  }

  function handleUserChange(key: string, field: AppSettingFieldSchema, raw: string) {
    const value = parseSettingSelectValue(field, raw);
    setUserDraft((draft) => ({ ...draft, [key]: value }));
    setSaved(false);
  }

  function firmDisplayValue(key: string, field: AppSettingFieldSchema): unknown {
    if (admin) return firmValue(key, field, tenantDraft);
    return coerceSettingValue(field, effective[key] ?? field.default);
  }

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/cases">{msg('casAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('casSettingsTitle')}</span>
      </nav>

      <header className="admin-page-header">
        <h1 className="admin-page-title">{msg('casSettingsTitle')}</h1>
      </header>

      {loading && <p>{msg('loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && (
        <form onSubmit={handleSubmit}>
          <div className="admin-list-card">
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--settings">
                <thead>
                  <tr>
                    <th className="admin-settings-col-name">{msg('casSettingsTitleColSetting')}</th>
                    <th className="admin-settings-col-default">{msg('casSettingsTitleColDefault')}</th>
                    <th className="admin-settings-col-scope">{msg('casSettingsTitleColFirm')}</th>
                    <th className="admin-settings-col-scope">{msg('casSettingsTitleColUser')}</th>
                  </tr>
                </thead>
                <tbody>
                  {settingRows.map(([key, field]) => {
                    const options = settingOptions(key, field, msg);
                    const firm = firmDisplayValue(key, field);
                    const user = userValue(key, field, tenantDraft, userDraft);

                    return (
                      <tr key={key}>
                        <td>
                          <span className="admin-settings-label">{msg(settingLabelKey(key))}</span>
                          <code className="admin-settings-key">{key}</code>
                        </td>
                        <td className="admin-table-muted">
                          {formatSettingValue(key, field.default, msg)}
                        </td>
                        <td>
                          {field.tenantConfigurable && admin ? (
                            <select
                              className="admin-settings-select"
                              value={settingSelectValue(firm)}
                              disabled={submitting}
                              onChange={(e) => handleFirmChange(key, field, e.target.value)}
                            >
                              {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : field.tenantConfigurable ? (
                            <span className="admin-table-muted">
                              {formatSettingValue(key, firm, msg)}
                            </span>
                          ) : (
                            <span className="admin-table-muted">{msg('casSettingsTitleNotConfigurable')}</span>
                          )}
                        </td>
                        <td>
                          {field.userOverridable ? (
                            <select
                              className="admin-settings-select"
                              value={settingSelectValue(user)}
                              disabled={submitting}
                              onChange={(e) => handleUserChange(key, field, e.target.value)}
                            >
                              {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="admin-table-muted">{msg('casSettingsTitleNotConfigurable')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-settings-actions">
            <button
              type="submit"
              className="button-primary"
              disabled={submitting || (!tenantDirty && !userDirty)}
            >
              {submitting ? msg('loading') : msg('submitSave')}
            </button>
          </div>

          {saved && <p className="status">{msg('saved')}</p>}
        </form>
      )}
    </div>
  );
}
