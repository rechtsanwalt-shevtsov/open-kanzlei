import { useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { TeamDialog } from '@shell/components/admin/TeamDialog.js';
import { useTeams, type Team } from '@shell/hooks/useTeams.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { api, apiHeaders } from '@shell/api/client.js';
import { LuSettings } from 'react-icons/lu';

function isGroupRenamable(group: Team): boolean {
  return group.key !== 'admin' && group.key !== 'plattformuser';
}

function isGroupDeletable(group: Team): boolean {
  return group.key !== 'admin' && group.key !== 'plattformuser';
}

export function GroupsPage() {
  const { locale, msg } = useI18n();
  const { items: groups, loading, error, refresh } = useTeams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Team | null>(null);

  async function handleDeleteGroup(group: Team) {
    if (!window.confirm(msg('teamsDeleteConfirm').replace('{name}', group.name))) {
      return;
    }

    const res = await api.DELETE('/v1/groups/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id: group.id } },
    });
    if (res.error) {
      const err = res.error as { message?: string };
      window.alert(err?.message ?? msg('errorGeneric'));
      return;
    }
    void refresh();
  }

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/actor-model-designer">{msg('amdAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('teamsTitle')}</span>
      </nav>

      <header className="admin-page-header">
        <h1 className="admin-page-title">{msg('teamsTitle')}</h1>
        <div className="admin-toolbar">
          <button type="button" className="button-outline" onClick={() => setCreateOpen(true)}>
            <span className="admin-btn-icon" aria-hidden>
              +
            </span>
            {msg('teamsCreate')}
          </button>
          <Link
            to="/apps/actor-model-designer/settings"
            className="button-icon"
            title={msg('appSettings')}
            aria-label={msg('appSettings')}
          >
            <LuSettings size={18} aria-hidden />
          </Link>
        </div>
      </header>

      {loading && <p className="status">{msg('loading')}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="admin-list-card">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--with-actions">
              <thead>
                <tr>
                  <th>{msg('teamsColName')}</th>
                  <th className="admin-table-actions-col" aria-label={msg('teamsRowActions')} />
                </tr>
              </thead>
              <tbody>
                {groups.filter((g) => g.key !== 'plattformuser').length === 0 ? (
                  <tr>
                    <td colSpan={2} className="admin-table-empty">
                      {msg('teamsEmpty')}
                    </td>
                  </tr>
                ) : (
                  groups
                    .filter((g) => g.key !== 'plattformuser')
                    .map((group) => (
                      <tr key={group.id}>
                        <td>
                          {isGroupRenamable(group) ? (
                            <button
                              type="button"
                              className="admin-table-link admin-table-link--button"
                              onClick={() => setEditGroup(group)}
                            >
                              {group.name}
                            </button>
                          ) : (
                            <span>{group.name}</span>
                          )}
                        </td>
                        <td className="admin-table-actions-cell">
                          <div className="admin-table-icon-actions">
                            <button
                              type="button"
                              className="button-icon"
                              title={msg('teamsEdit')}
                              aria-label={msg('teamsEdit')}
                              disabled={!isGroupRenamable(group)}
                              onClick={() => setEditGroup(group)}
                            >
                              <LuPencil size={18} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="button-icon button-icon--danger"
                              title={msg('teamsDelete')}
                              aria-label={msg('teamsDelete')}
                              disabled={!isGroupDeletable(group)}
                              onClick={() => void handleDeleteGroup(group)}
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
        </div>
      )}

      <TeamDialog
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={() => void refresh()}
      />

      <TeamDialog
        open={editGroup !== null}
        mode="edit"
        team={editGroup ?? undefined}
        onClose={() => setEditGroup(null)}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
