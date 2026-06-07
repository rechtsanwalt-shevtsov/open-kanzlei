import { useState } from 'react';
import { LuSettings } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { useInstalledApps } from '../../context/InstalledAppsContext.js';
import { useTeams } from '../../hooks/useTeams.js';
import { useTenantAppCatalog } from '../../hooks/useTenantAppCatalog.js';
import { useI18n } from '../../i18n/I18nContext.js';

function teamStatus(
  app: { team_activations: { team_id: string; status: 'active' | 'inactive' }[] },
  teamId: string,
): 'active' | 'inactive' {
  return app.team_activations.find((a) => a.team_id === teamId)?.status ?? 'inactive';
}

export function AdminAppsPage() {
  const { msg } = useI18n();
  const { catalog, loading, setTeamAppStatus } = useTenantAppCatalog();
  const { items: teams, loading: teamsLoading } = useTeams();
  const { refreshInstalledApps } = useInstalledApps();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleTeamStatus(
    appKey: string,
    teamId: string,
    activate: boolean,
  ) {
    const key = `${appKey}:${teamId}`;
    setBusyKey(key);
    setError(null);
    const err = await setTeamAppStatus(appKey, teamId, activate ? 'active' : 'inactive');
    if (err) {
      setError(err);
    } else {
      await refreshInstalledApps({ silent: true });
    }
    setBusyKey(null);
  }

  const tableLoading = loading || teamsLoading;

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/admin/settings">{msg('administration')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('navApps')}</span>
      </nav>

      <h1 className="admin-page-title">{msg('navApps')}</h1>

      {error && <p className="form-error">{error}</p>}
      {tableLoading && <p>{msg('loading')}</p>}

      {!tableLoading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{msg('adminAppsColName')}</th>
                <th>{msg('adminAppsColKey')}</th>
                <th>{msg('adminAppsColUi')}</th>
                <th aria-label={msg('adminAppsColSettings')} />
                {teams.map((team) => (
                  <th key={team.id}>{team.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalog.length === 0 ? (
                <tr>
                  <td colSpan={4 + teams.length} className="admin-table-empty">
                    {msg('adminAppsCatalogEmpty')}
                  </td>
                </tr>
              ) : (
                catalog.map((app) => (
                  <tr key={app.app_key}>
                    <td>{app.name}</td>
                    <td className="admin-table-muted">{app.app_key}</td>
                    <td>{app.has_react_ui ? msg('usersActiveYes') : msg('usersActiveNo')}</td>
                    <td>
                      {app.settings_path ? (
                        <Link
                          to={app.settings_path}
                          className="button-outline button-sm"
                          aria-label={`${msg('adminAppsColSettings')}: ${app.name}`}
                        >
                          <LuSettings size={18} aria-hidden />
                        </Link>
                      ) : (
                        <span className="admin-table-muted">—</span>
                      )}
                    </td>
                    {teams.map((team) => {
                      const status = teamStatus(app, team.id);
                      const isActive = status === 'active';
                      const busy = busyKey === `${app.app_key}:${team.id}`;
                      return (
                        <td key={team.id}>
                          <button
                            type="button"
                            className="button-link button-sm"
                            disabled={busy}
                            onClick={() =>
                              void toggleTeamStatus(app.app_key, team.id, !isActive)
                            }
                            aria-label={`${app.name} / ${team.name}: ${
                              isActive
                                ? msg('adminAppsDeactivate')
                                : msg('adminAppsActivate')
                            }`}
                          >
                            {isActive
                              ? msg('adminAppsStatusActive')
                              : msg('adminAppsStatusInactive')}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
