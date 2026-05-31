import { Link, Outlet, useLocation } from 'react-router-dom';
import { LuLogOut } from 'react-icons/lu';
import { InstalledAppsProvider } from '../context/InstalledAppsContext.js';
import { useAuth } from '../context/AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import { AdminSidebar } from './admin/AdminSidebar.js';
import { LanguageSelect } from './LanguageSelect.js';

export function Layout() {
  const { user, logout } = useAuth();
  const { msg } = useI18n();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const showSidebar = Boolean(user);

  return (
    <div className={`app-shell${showSidebar ? ' app-shell--with-sidebar' : ''}`}>
      <header className="app-header">
        <div className="brand">
          <Link to="/">{msg('appTitle')}</Link>
          <p className="tagline">{msg('appTagline')}</p>
        </div>
        <nav className="app-nav">
          {user ? (
            <>
              <Link to="/profile" className="app-nav-profile">
                {user.username}
              </Link>
              <LanguageSelect />
              <button
                type="button"
                className="app-nav-icon-btn"
                onClick={() => void logout()}
                aria-label={msg('navLogout')}
              >
                <LuLogOut size={18} aria-hidden />
              </button>
            </>
          ) : (
            <>
              <LanguageSelect />
              <Link to="/login">{msg('navLogin')}</Link>
              <Link to="/register" className="button-primary">
                {msg('navRegister')}
              </Link>
            </>
          )}
        </nav>
      </header>
      <div className="app-body">
        {showSidebar ? (
          <InstalledAppsProvider>
            <AdminSidebar />
            <main
              className={
                isAdminRoute
                  ? 'app-main app-main--sidebar app-main--admin'
                  : 'app-main app-main--sidebar'
              }
            >
              <Outlet />
            </main>
          </InstalledAppsProvider>
        ) : (
          <main className="app-main">
            <Outlet />
          </main>
        )}
      </div>
    </div>
  );
}
