import { useMemo, useState } from 'react';
import { LuPencil } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { PlatformUserDialog } from '../../components/admin/PlatformUserDialog.js';
import { useTeams } from '../../hooks/useTeams.js';
import { usePlatformUsers, type PlatformUser } from '../../hooks/usePlatformUsers.js';
import { useI18n } from '../../i18n/I18nContext.js';
import { formatGroupNames } from '../../lib/is-admin.js';

export function PlatformUsersPage() {
  const { msg } = useI18n();
  const { items: actors, loading, error, refresh } = usePlatformUsers();
  const { items: groups } = useTeams();

  const [search, setSearch] = useState('');
  const [editActor, setEditActor] = useState<PlatformUser | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return actors;
    return actors.filter(
      (a) =>
        a.display_name.toLowerCase().includes(q) ||
        (a.username?.toLowerCase().includes(q) ?? false) ||
        (a.email?.toLowerCase().includes(q) ?? false) ||
        formatGroupNames(a.groups).toLowerCase().includes(q),
    );
  }, [actors, search]);

  return (
    <div className="admin-page">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">{msg('administration')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('navPlatformUsers')}</span>
      </nav>

      <header className="admin-page-header">
        <h1 className="admin-page-title">{msg('pusrSectionTitle')}</h1>
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
          <table className="admin-table admin-table--with-actions">
            <thead>
              <tr>
                <th>{msg('pusrColActor')}</th>
                <th>{msg('username')}</th>
                <th>{msg('email')}</th>
                <th>{msg('usersColTeams')}</th>
                <th className="admin-table-actions-col" aria-label={msg('usersRowActions')} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {search ? msg('modelsNoResults') : msg('pusrEmptyActors')}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-table-link admin-table-link--button"
                        onClick={() => setEditActor(row)}
                      >
                        {row.display_name}
                      </button>
                    </td>
                    <td className="admin-table-muted">{row.username ?? '—'}</td>
                    <td className="admin-table-muted">{row.email ?? '—'}</td>
                    <td className="admin-table-muted">{formatGroupNames(row.groups) || '—'}</td>
                    <td className="admin-table-actions-cell">
                      <button
                        type="button"
                        className="button-icon"
                        title={msg('usersEdit')}
                        aria-label={msg('usersEdit')}
                        onClick={() => setEditActor(row)}
                      >
                        <LuPencil size={18} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <PlatformUserDialog
        open={editActor !== null}
        actor={editActor ?? undefined}
        groups={groups}
        onClose={() => setEditActor(null)}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
