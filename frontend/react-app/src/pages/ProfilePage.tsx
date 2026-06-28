import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, apiHeaders, apiJsonHeaders } from '../api/client.js';
import { ThemeSelect } from '../components/ThemeSelect.js';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import type { Locale } from '../i18n/locale.js';
import { DEFAULT_COLOR_THEME, type ColorTheme } from '../lib/color-themes.js';

export function ProfilePage() {
  const { locale, msg } = useI18n();
  const { user } = useAuth();
  const { preferences, loading: themeLoading, error: themeLoadError, previewTheme, setUserTheme } =
    useTheme();
  const [firmName, setFirmName] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState<Locale>('de');
  const [themeDraft, setThemeDraft] = useState<ColorTheme | 'tenant-default'>('tenant-default');
  const [error, setError] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [themeSubmitting, setThemeSubmitting] = useState(false);
  const savedThemeRef = useRef<ColorTheme>(DEFAULT_COLOR_THEME);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error: apiError } = await api.GET('/v1/tenant/profile', {
        headers: apiHeaders(locale),
      });
      if (!active) return;
      if (apiError || !data) {
        const body = apiError as { message?: string } | undefined;
        setError(body?.message ?? msg('errorGeneric'));
        setLoading(false);
        return;
      }
      setFirmName(data.firm_name);
      setDefaultLanguage(data.default_language);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [locale, msg]);

  useEffect(() => {
    if (!preferences) return;
    setThemeDraft(preferences.user_color_theme ?? 'tenant-default');
    savedThemeRef.current = preferences.color_theme;
  }, [preferences]);

  useEffect(() => {
    return () => {
      previewTheme(savedThemeRef.current);
    };
  }, [previewTheme]);

  function previewDraft(next: ColorTheme | 'tenant-default') {
    if (!preferences) return;
    const preview = next === 'tenant-default' ? preferences.tenant_color_theme : next;
    previewTheme(preview);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const { data, error: apiError } = await api.PATCH('/v1/tenant/profile', {
      headers: apiJsonHeaders(locale),
      body: { firm_name: firmName, default_language: defaultLanguage },
    });

    setSubmitting(false);

    if (apiError || !data) {
      const body = apiError as { message?: string } | undefined;
      setError(body?.message ?? msg('errorGeneric'));
      return;
    }

    setSuccess(true);
  }

  async function handleThemeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!preferences) return;

    const current = preferences.user_color_theme ?? 'tenant-default';
    if (themeDraft === current) return;

    setThemeError(null);
    setThemeSaved(false);
    setThemeSubmitting(true);

    const ok = await setUserTheme(themeDraft === 'tenant-default' ? null : themeDraft);
    if (ok) {
      setThemeSaved(true);
    } else {
      setThemeError(msg('errorGeneric'));
      if (preferences) {
        previewTheme(preferences.color_theme);
        setThemeDraft(preferences.user_color_theme ?? 'tenant-default');
      }
    }
    setThemeSubmitting(false);
  }

  if (loading) {
    return <p className="status">{msg('loading')}</p>;
  }

  return (
    <section className="card card-wide">
      <h1>{msg('profileTitle')}</h1>

      {user && (
        <div className="user-panel">
          <h2>{msg('userSection')}</h2>
          <dl>
            <dt>{msg('username')}</dt>
            <dd>{user.username}</dd>
            <dt>{msg('email')}</dt>
            <dd>{user.email ?? '—'}</dd>
            <dt>{msg('teams')}</dt>
            <dd>{user.groups.map((t) => t.name).join(', ')}</dd>
          </dl>
        </div>
      )}

      {themeLoadError && (
        <p className="form-error" role="alert">
          {themeLoadError}
        </p>
      )}

      {!themeLoading && !themeLoadError && preferences && (
      <form onSubmit={(e) => void handleThemeSubmit(e)} className="form theme-settings-form">
        <h2>{msg('userColorThemeTitle')}</h2>
        <p className="hint">{msg('userColorThemeHint')}</p>
        <ThemeSelect
          name="user-color-theme"
          value={themeDraft}
          allowTenantDefault
          disabled={themeSubmitting}
          onChange={(next) => {
            setThemeDraft(next);
            previewDraft(next);
            setThemeSaved(false);
            setThemeError(null);
          }}
        />
        {themeError && (
          <p className="form-error" role="alert">
            {themeError}
          </p>
        )}
        {themeSaved && (
          <p className="form-success" role="status">
            {msg('saved')}
          </p>
        )}
        <button
          type="submit"
          className="button-primary"
          disabled={
            themeSubmitting ||
            themeDraft === (preferences.user_color_theme ?? 'tenant-default')
          }
        >
          {themeSubmitting ? msg('loading') : msg('submitSave')}
        </button>
      </form>
      )}

      <form onSubmit={handleSubmit} className="form">
        <label>
          {msg('firmName')}
          <input value={firmName} onChange={(e) => setFirmName(e.target.value)} required />
        </label>
        <label>
          {msg('defaultLanguage')}
          <select
            value={defaultLanguage}
            onChange={(e) => setDefaultLanguage(e.target.value as Locale)}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="form-success" role="status">
            {msg('saved')}
          </p>
        )}
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? msg('loading') : msg('submitSave')}
        </button>
      </form>
    </section>
  );
}
