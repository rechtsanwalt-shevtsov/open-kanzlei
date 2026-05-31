import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiHeaders } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import type { Locale } from '../i18n/locale.js';

export function RegisterPage() {
  const { locale, msg } = useI18n();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [firmName, setFirmName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState<Locale>(locale);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: apiError } = await api.POST('/v1/auth/register-tenant', {
      headers: apiHeaders(locale),
      body: {
        firm_name: firmName,
        admin_username: adminUsername,
        admin_email: adminEmail,
        admin_password: adminPassword,
        default_language: defaultLanguage,
      },
    });

    setSubmitting(false);

    if (apiError || !data) {
      const body = apiError as { message?: string } | undefined;
      setError(body?.message ?? msg('errorGeneric'));
      return;
    }

    setUser(data.user);
    navigate('/profile');
  }

  return (
    <section className="card card-wide">
      <h1>{msg('registerTitle')}</h1>
      <form onSubmit={handleSubmit} className="form">
        <label>
          {msg('firmName')}
          <input
            name="firm_name"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            required
          />
        </label>
        <label>
          {msg('username')}
          <input
            name="admin_username"
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          {msg('email')}
          <input
            type="email"
            name="admin_email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          {msg('password')}
          <input
            type="password"
            name="admin_password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
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
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? msg('loading') : msg('submitRegister')}
        </button>
      </form>
      <p className="form-footer">
        <Link to="/login">{msg('navLogin')}</Link>
      </p>
    </section>
  );
}
