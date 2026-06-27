import { useMemo, useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { PlatformUserDialog } from '../../components/admin/PlatformUserDialog.js';
import { TeamDialog } from '../../components/admin/TeamDialog.js';
import { useAuth } from '../../context/AuthContext.js';
import { useTeams, type Team } from '../../hooks/useTeams.js';
import { usePlatformUsers, type PlatformUser } from '../../hooks/usePlatformUsers.js';
import { useI18n } from '../../i18n/I18nContext.js';
import { formatTeamNames } from '../../lib/is-admin.js';
import { api, apiHeaders } from '../../api/client.js';

function isTeamRenamable(team: Team): boolean {
  return team.key !== 'admin' && team.key !== 'plattformuser';
}

function isTeamDeletable(team: Team): boolean {
  return team.key !== 'admin' && team.key !== 'plattformuser';
}

function teamHasMembers(teamId: string, users: PlatformUser[]): boolean {
  return users.some((user) => user.teams.some((t) => t.id === teamId));
}

export function PlatformUsersPage() {
  const { user: currentUser } = useAuth();
  const { locale, msg } = useI18n();
  const { items: users, loading, error, refresh: refreshUsers } = usePlatformUsers();
  const { items: teams, loading: teamsLoading, error: teamsError, refresh: refreshTeams } = useTeams();

  const [search, setSearch] = useState('');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [editUser, setEditUser] = useState<PlatformUser | null>(null);
  const [editTeam, setEditTeam] = useState<Team | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        formatTeamNames(u.teams).toLowerCase().includes(q),
    );
  }, [users, search]);

  async function handleDeleteTeam(team: Team) {
    if (!window.confirm(msg('teamsDeleteConfirm').replace('{name}', team.name))) {
      return;
    }

    const res = await api.DELETE('/v1/teams/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id: team.id } },
    });
    if (res.error) {
      const err = res.error as { message?: string };
      window.alert(err?.message ?? msg('errorGeneric'));
      return;
    }
    void refreshTeams();
    void refreshUsers();
  }

  async function handleRevokeUser(user: PlatformUser) {
    if (!window.confirm(msg('pusrRevokeConfirm').replace('{username}', user.username))) {
      return;
    }

    const res = await api.DELETE('/v1/platform-users/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id: user.id } },
    });
    if (res.error) {
      const err = res.error as { message?: string };
      window.alert(err?.message ?? msg('errorGeneric'));
      return;
    }
    void refreshUsers();
  }

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">{msg('administration')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('navPlatformUsers')}</span>
      </nav>

      <header className="admin-page-header admin-page-header--actions-only">
        <div className="admin-toolbar">
          <button
            type="button"
            className="button-outline"
            onClick={() => setCreateTeamOpen(true)}
          >
            <span className="admin-btn-icon" aria-hidden>
              +
            </span>
            {msg('teamsCreate')}
          </button>
          <button
            type="button"
            className="button-outline"
            onClick={() => setCreateUserOpen(true)}
          >
            <span className="admin-btn-icon" aria-hidden>
              +
            </span>
            {msg('pusrCreate')}
          </button>
        </div>
      </header>

      <section className="admin-page-section">
        <h2 className="admin-section-title">{msg('teamsTitle')}</h2>
        {teamsLoading && <p className="status">{msg('loading')}</p>}
        {teamsError && (
          <p className="form-error" role="alert">
            {teamsError}
          </p>
        )}
        {!teamsLoading && !teamsError && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--with-actions">
              <thead>
                <tr>
                  <th>{msg('teamsColName')}</th>
                  <th className="admin-table-actions-col" aria-label={msg('teamsRowActions')} />
                </tr>
              </thead>
              <tbody>
                {teams.filter((t) => t.key !== 'plattformuser').length === 0 ? (
                  <tr>
                    <td colSpan={2} className="admin-table-empty">
                      {msg('teamsEmpty')}
                    </td>
                  </tr>
                ) : (
                  teams
                    .filter((t) => t.key !== 'plattformuser')
                    .map((team) => (
                      <tr key={team.id}>
                        <td>
                          {isTeamRenamable(team) ? (
                            <button
                              type="button"
                              className="admin-table-link admin-table-link--button"
                              onClick={() => setEditTeam(team)}
                            >
                              {team.name}
                            </button>
                          ) : (
                            <span>{team.name}</span>
                          )}
                        </td>
                        <td className="admin-table-actions-cell">
                          <div className="admin-table-icon-actions">
                            <button
                              type="button"
                              className="button-icon"
                              title={msg('teamsEdit')}
                              aria-label={msg('teamsEdit')}
                              disabled={!isTeamRenamable(team)}
                              onClick={() => setEditTeam(team)}
                            >
                              <LuPencil size={18} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="button-icon button-icon--danger"
                              title={msg('teamsDelete')}
                              aria-label={msg('teamsDelete')}
                              disabled={
                                !isTeamDeletable(team) || teamHasMembers(team.id, users)
                              }
                              onClick={() => void handleDeleteTeam(team)}
                            >
                              <LuTrash2 size={18} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-page-section">
        <h2 className="admin-section-title">{msg('pusrSectionTitle')}</h2>

        <div className="admin-search-wrap">
          <input
            type="search"
            className="admin-search"
            placeholder={msg('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={msg('search')}
          />
        </div>

        {loading && <p className="status">{msg('loading')}</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--with-actions">
              <thead>
                <tr>
                  <th>{msg('username')}</th>
                  <th>{msg('email')}</th>
                  <th>{msg('usersColTeams')}</th>
                  <th className="admin-table-actions-col" aria-label={msg('usersRowActions')} />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-table-empty">
                      {search ? msg('modelsNoResults') : msg('pusrEmpty')}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const canRevoke = currentUser?.id !== row.id;
                    return (
                      <tr key={row.id}>
                        <td>
                          <button
                            type="button"
                            className="admin-table-link admin-table-link--button"
                            onClick={() => setEditUser(row)}
                          >
                            {row.username}
                          </button>
                        </td>
                        <td className="admin-table-muted">{row.email ?? '—'}</td>
                        <td className="admin-table-muted">{formatTeamNames(row.teams) || '—'}</td>
                        <td className="admin-table-actions-cell">
                          <div className="admin-table-icon-actions">
                            <button
                              type="button"
                              className="button-icon"
                              title={msg('usersEdit')}
                              aria-label={msg('usersEdit')}
                              onClick={() => setEditUser(row)}
                            >
                              <LuPencil size={18} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="button-icon button-icon--danger"
                              title={msg('pusrRevokeLogin')}
                              aria-label={msg('pusrRevokeLogin')}
                              disabled={!canRevoke}
                              onClick={() => void handleRevokeUser(row)}
                            >
                              <LuTrash2 size={18} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PlatformUserDialog
        open={createUserOpen}
        mode="create"
        teams={teams}
        onClose={() => setCreateUserOpen(false)}
        onSaved={() => void refreshUsers()}
      />

      <PlatformUserDialog
        open={editUser !== null}
        mode="edit"
        user={editUser ?? undefined}
        teams={teams}
        onClose={() => setEditUser(null)}
        onSaved={() => void refreshUsers()}
        onDeleted={() => void refreshUsers()}
      />

      <TeamDialog
        open={createTeamOpen}
        mode="create"
        onClose={() => setCreateTeamOpen(false)}
        onSaved={() => void refreshTeams()}
      />

      <TeamDialog
        open={editTeam !== null}
        mode="edit"
        team={editTeam ?? undefined}
        onClose={() => setEditTeam(null)}
        onSaved={() => {
          void refreshTeams();
          void refreshUsers();
        }}
      />
    </div>
  );
}
