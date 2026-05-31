import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstalledApps } from '../../context/InstalledAppsContext.js';
import { useTenantAppCatalog } from '../../hooks/useTenantAppCatalog.js';
import { useI18n } from '../../i18n/I18nContext.js';

export function AdminAppsPage() {
  const { msg } = useI18n();
  const { catalog, loading, setAppStatus } = useTenantAppCatalog();
  const { refreshInstalledApps } = useInstalledApps();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleStatus(appKey: string, activate: boolean) {
    setBusyKey(appKey);
    setError(null);
    const err = await setAppStatus(appKey, activate ? 'active' : 'inactive');
    if (err) {
      setError(err);
    } else {
      await refreshInstalledApps();
    }
    setBusyKey(null);
  }

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/admin/settings">{msg('administration')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('navApps')}</span>
      </nav>

      <h1 className="admin-page-title">{msg('navApps')}</h1>

      {error && <p className="form-error">{error}</p>}
      {loading && <p>{msg('loading')}</p>}

      {!loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{msg('adminAppsColName')}</th>
                <th>{msg('adminAppsColKey')}</th>
                <th>{msg('adminAppsColCategory')}</th>
                <th>{msg('adminAppsColUi')}</th>
                <th>{msg('adminAppsColStatus')}</th>
                <th>{msg('adminAppsColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {catalog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    {msg('adminAppsCatalogEmpty')}
                  </td>
                </tr>
              ) : (
                catalog.map((app) => {
                  const isActive = app.status === 'active';
                  const busy = busyKey === app.app_key;
                  return (
                    <tr key={app.app_key}>
                      <td>
                        {isActive && app.has_react_ui && app.nav_path ? (
                          <Link to={app.nav_path} className="admin-table-link admin-table-link--anchor">
                            {app.name}
                          </Link>
                        ) : (
                          app.name
                        )}
                      </td>
                      <td className="admin-table-muted">{app.app_key}</td>
                      <td>{app.menu_category}</td>
                      <td>{app.has_react_ui ? msg('usersActiveYes') : msg('usersActiveNo')}</td>
                      <td>{isActive ? msg('adminAppsStatusActive') : msg('adminAppsStatusInactive')}</td>
                      <td>
                        {isActive ? (
                          <button
                            type="button"
                            className="button-outline button-sm"
                            disabled={busy}
                            onClick={() => void toggleStatus(app.app_key, false)}
                          >
                            {msg('adminAppsDeactivate')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button-outline button-sm"
                            disabled={busy}
                            onClick={() => void toggleStatus(app.app_key, true)}
                          >
                            {msg('adminAppsActivate')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
