import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeSelect } from '../../components/ThemeSelect.js';
import { useTheme } from '../../context/ThemeContext.js';
import { useI18n } from '../../i18n/I18nContext.js';
import { DEFAULT_COLOR_THEME, type ColorTheme } from '../../lib/color-themes.js';

export function AdminSettingsPage() {
  const { msg } = useI18n();
  const { preferences, loading, error, previewTheme, setTenantTheme } = useTheme();
  const [draft, setDraft] = useState<ColorTheme>(DEFAULT_COLOR_THEME);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedThemeRef = useRef<ColorTheme>(DEFAULT_COLOR_THEME);

  useEffect(() => {
    if (!preferences) return;
    setDraft(preferences.tenant_color_theme);
    savedThemeRef.current = preferences.color_theme;
  }, [preferences]);

  useEffect(() => {
    return () => {
      previewTheme(savedThemeRef.current);
    };
  }, [previewTheme]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !preferences || draft === preferences.tenant_color_theme) return;

    setSubmitting(true);
    setSaved(false);
    setSaveError(null);
    const ok = await setTenantTheme(draft);
    if (ok) {
      setSaved(true);
    } else {
      setSaveError(msg('errorGeneric'));
      previewTheme(preferences.color_theme);
      setDraft(preferences.tenant_color_theme);
    }
    setSubmitting(false);
  }

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/admin/settings">{msg('administration')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('navSettings')}</span>
      </nav>

      <h1 className="admin-page-title">{msg('navSettings')}</h1>

      {loading && <p>{msg('loading')}</p>}

      {!loading && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && preferences && (
        <form className="card card-wide theme-settings-form" onSubmit={(e) => void handleSubmit(e)}>
          <h2>{msg('tenantColorThemeTitle')}</h2>
          <p className="hint">{msg('tenantColorThemeHint')}</p>

          <ThemeSelect
            name="tenant-color-theme"
            value={draft}
            onChange={(next) => {
              if (next === 'tenant-default') return;
              setDraft(next);
              previewTheme(next);
              setSaved(false);
              setSaveError(null);
            }}
          />

          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          {saved && <p className="form-success">{msg('saved')}</p>}

          <button
            type="submit"
            className="button-primary"
            disabled={submitting || draft === preferences.tenant_color_theme}
          >
            {submitting ? msg('loading') : msg('submitSave')}
          </button>
        </form>
      )}
    </div>
  );
}
