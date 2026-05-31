import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiHeaders } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';

export function LoginPage() {
  const { locale, msg } = useI18n();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: apiError } = await api.POST('/v1/auth/login', {
      headers: apiHeaders(locale),
      body: { username, password },
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
    <section className="card">
      <h1>{msg('loginTitle')}</h1>
      <form onSubmit={handleSubmit} className="form">
        <label>
          {msg('username')}
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          {msg('password')}
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? msg('loading') : msg('submitLogin')}
        </button>
      </form>
      <p className="form-footer">
        <Link to="/register">{msg('navRegister')}</Link>
      </p>
    </section>
  );
}
