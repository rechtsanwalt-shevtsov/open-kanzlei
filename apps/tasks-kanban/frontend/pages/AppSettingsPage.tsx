import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readApiError } from '@shell/api/client.js';
import { useAuth } from '@shell/context/AuthContext.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { userIsAdmin } from '@shell/lib/is-admin.js';
import { fetchTenantSettings, patchTenantSettings } from '../api.js';
import { TASKS_KANBAN_SETTINGS_SCHEMA } from '../settings-schema.js';

type WipLimitsShape = {
  default?: Record<string, number>;
  users?: Record<string, Record<string, number>>;
};

function parseWipLimits(raw: unknown): WipLimitsShape {
  if (!raw || typeof raw !== 'object') return { default: { started: 10 }, users: {} };
  const obj = raw as WipLimitsShape;
  return {
    default: { started: 10, ...(obj.default ?? {}) },
    users: obj.users ?? {},
  };
}

export function AppSettingsPage() {
  const { locale, msg } = useI18n();
  const { user } = useAuth();
  const admin = user ? userIsAdmin(user.groups) : false;

  const [wipLimitMode, setWipLimitMode] = useState<'soft' | 'hard'>('soft');
  const [defaultStarted, setDefaultStarted] = useState(10);
  const [wipLimitsRaw, setWipLimitsRaw] = useState<WipLimitsShape>({ default: { started: 10 }, users: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!admin) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const res = await fetchTenantSettings(locale);
      if (res.error || !res.response.ok) {
        setError(await readApiError(res.error, msg('errorGeneric')));
        setLoading(false);
        return;
      }
      const settings = (res.data as Record<string, unknown>) ?? {};
      setWipLimitMode(settings.wipLimitMode === 'hard' ? 'hard' : 'soft');
      const wl = parseWipLimits(settings.wipLimits ?? TASKS_KANBAN_SETTINGS_SCHEMA.wipLimits?.default);
      setWipLimitsRaw(wl);
      setDefaultStarted(Number(wl.default?.started ?? 10));
      setLoading(false);
    })();
  }, [admin, locale, msg]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!admin) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const wipLimits: WipLimitsShape = {
      ...wipLimitsRaw,
      default: { ...wipLimitsRaw.default, started: defaultStarted },
    };
    const res = await patchTenantSettings(locale, {
      wipLimitMode,
      wipLimits,
    });
    setSubmitting(false);
    if (res.error || !res.response.ok) {
      setError(await readApiError(res.error, msg('errorGeneric')));
      return;
    }
    setWipLimitsRaw(wipLimits);
    setSaved(true);
  }

  if (!admin) {
    return (
      <div className="admin-page">
        <p>{msg('tkbSettingsAdminOnly')}</p>
        <Link to="/apps/tasks-kanban">{msg('tkbBackToBoard')}</Link>
      </div>
    );
  }

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/tasks-kanban">{msg('tkbAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('tkbSettings')}</span>
      </nav>

      <header className="admin-page-header">
        <h1 className="admin-page-title">{msg('tkbSettings')}</h1>
      </header>

      {loading ? <p>{msg('loading')}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {saved ? <p className="form-success">{msg('saved')}</p> : null}

      {!loading ? (
        <form className="form admin-list-card" style={{ padding: '1.25rem' }} onSubmit={handleSubmit}>
          <label>
            {msg('tkbWipLimitMode')}
            <select
              value={wipLimitMode}
              onChange={(e) => setWipLimitMode(e.target.value as 'soft' | 'hard')}
            >
              <option value="soft">{msg('tkbWipModeSoft')}</option>
              <option value="hard">{msg('tkbWipModeHard')}</option>
            </select>
          </label>

          <label>
            {msg('tkbDefaultStartedWip')}
            <input
              type="number"
              min={0}
              value={defaultStarted}
              onChange={(e) => setDefaultStarted(Number(e.target.value))}
            />
          </label>

          <p className="admin-table-muted">{msg('tkbPerUserWipHint')}</p>

          <div className="admin-settings-actions">
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? msg('loading') : msg('submitSave')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
