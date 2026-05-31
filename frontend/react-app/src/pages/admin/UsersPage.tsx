import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreateTeamDialog } from '../../components/admin/CreateTeamDialog.js';
import { UserDialog } from '../../components/admin/UserDialog.js';
import { useTeams } from '../../hooks/useTeams.js';
import { useTenantUsers, type TenantUser } from '../../hooks/useTenantUsers.js';
import { useI18n } from '../../i18n/I18nContext.js';
import { roleMessageKey } from '../../lib/role-label.js';

export function UsersPage() {
  const { msg } = useI18n();
  const { items: users, loading, error, refresh: refreshUsers } = useTenantUsers();
  const { items: teams, refresh: refreshTeams } = useTeams();

  const [search, setSearch] = useState('');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [editUser, setEditUser] = useState<TenantUser | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.team_name?.toLowerCase().includes(q) ?? false),
    );
  }, [users, search]);

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">{msg('administration')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('usersTitle')}</span>
      </nav>

      <header className="admin-page-header">
        <h1 className="admin-page-title">{msg('usersTitle')}</h1>
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
            {msg('usersCreate')}
          </button>
        </div>
      </header>

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
          <table className="admin-table">
            <thead>
              <tr>
                <th>{msg('username')}</th>
                <th>{msg('email')}</th>
                <th>{msg('usersColRole')}</th>
                <th>{msg('usersColTeam')}</th>
                <th>{msg('usersColActive')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {search ? msg('modelsNoResults') : msg('usersEmpty')}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
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
                    <td>{msg(roleMessageKey(row.role))}</td>
                    <td className="admin-table-muted">{row.team_name ?? '—'}</td>
                    <td>{row.is_active ? msg('usersActiveYes') : msg('usersActiveNo')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <UserDialog
        open={createUserOpen}
        mode="create"
        teams={teams}
        onClose={() => setCreateUserOpen(false)}
        onSaved={() => void refreshUsers()}
      />

      <UserDialog
        open={editUser !== null}
        mode="edit"
        user={editUser ?? undefined}
        teams={teams}
        onClose={() => setEditUser(null)}
        onSaved={() => void refreshUsers()}
      />

      <CreateTeamDialog
        open={createTeamOpen}
        onClose={() => setCreateTeamOpen(false)}
        onCreated={() => void refreshTeams()}
      />
    </div>
  );
}
