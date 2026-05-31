import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';

export function HomePage() {
  const { user } = useAuth();
  const { msg } = useI18n();

  return (
    <section className="card hero">
      <h1>{msg('appTitle')}</h1>
      <p>{msg('appTagline')}</p>
      {user ? (
        <Link to="/profile" className="button-primary">
          {msg('navProfile')}
        </Link>
      ) : (
        <div className="hero-actions">
          <Link to="/register" className="button-primary">
            {msg('navRegister')}
          </Link>
          <Link to="/login">{msg('navLogin')}</Link>
        </div>
      )}
    </section>
  );
}
