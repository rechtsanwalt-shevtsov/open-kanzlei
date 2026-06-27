import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LuPuzzle, LuUsers, LuWrench } from 'react-icons/lu';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useInstalledApps } from '../../context/InstalledAppsContext.js';
import { useI18n } from '../../i18n/I18nContext.js';
import { AppNavIcon } from '../../lib/app-nav-icon.js';
import { userIsAdmin } from '../../lib/is-admin.js';

function NavLink({
  to,
  label,
  icon,
  end = false,
  indent = 0,
}: {
  to: string;
  label: string;
  icon?: ReactNode;
  end?: boolean;
  indent?: number;
}) {
  const location = useLocation();
  const active = end
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      className={`sidebar-link${active ? ' sidebar-link--active' : ''}`}
      style={{ paddingLeft: `${0.75 + indent * 0.85}rem` }}
    >
      {icon && <span className="sidebar-link-icon">{icon}</span>}
      <span className="sidebar-link-label">{label}</span>
    </Link>
  );
}

function NavGroup({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sidebar-group">
      <button
        type="button"
        className="sidebar-group-toggle"
        style={{ paddingLeft: '0.75rem' }}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="sidebar-chevron" data-open={open} aria-hidden>
          ›
        </span>
        {label}
      </button>
      {open && <div className="sidebar-group-children">{children}</div>}
    </div>
  );
}

export function AdminSidebar() {
  const { user } = useAuth();
  const { msg } = useI18n();
  const { sidebarApps } = useInstalledApps();
  const location = useLocation();

  const isAdmin = user ? userIsAdmin(user.teams) : false;

  const adminSectionActive = useMemo(
    () => location.pathname.startsWith('/admin'),
    [location.pathname],
  );

  const [adminOpen, setAdminOpen] = useState(isAdmin && adminSectionActive);

  useEffect(() => {
    if (adminSectionActive) setAdminOpen(true);
  }, [adminSectionActive]);

  if (!user) return null;

  return (
    <aside className="app-sidebar" aria-label={msg('sidebarNav')}>
      <nav className="sidebar-nav">
        {sidebarApps.map((app) => (
          <NavLink
            key={app.app_key}
            to={app.nav_path}
            label={app.name}
            icon={<AppNavIcon name={app.nav_icon} />}
          />
        ))}

        {isAdmin && (
          <NavGroup
            label={msg('administration')}
            open={adminOpen}
            onToggle={() => setAdminOpen((v) => !v)}
          >
            <NavLink
              to="/admin/settings"
              label={msg('navSettings')}
              icon={<LuWrench size={16} aria-hidden />}
              indent={1}
            />
            <NavLink
              to="/admin/platform-users"
              label={msg('navPlatformUsers')}
              icon={<LuUsers size={16} aria-hidden />}
              indent={1}
            />
            <NavLink
              to="/admin/apps"
              label={msg('navApps')}
              icon={<LuPuzzle size={16} aria-hidden />}
              indent={1}
            />
          </NavGroup>
        )}
      </nav>
    </aside>
  );
}
