import { useMemo, useState } from 'react';
import { LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { AppAssignmentCells } from '../../components/admin/AppAssignmentCells.js';
import { useInstalledApps } from '../../context/InstalledAppsContext.js';
import {
  EMPTY_ASSIGNMENTS,
  useAppAssignments,
  type AppCatalogItem,
  type AppGroupAssignments,
  type TeamAppAssignmentRow,
  type UserAppAssignmentRow,
} from '../../hooks/useAppAssignments.js';
import { useAutoSaveAssignmentRow, type SaveAssignmentsResult } from '../../hooks/useAutoSaveAssignmentRow.js';
import { usePlatformUsers, type PlatformUser } from '../../hooks/usePlatformUsers.js';
import { useI18n } from '../../i18n/I18nContext.js';

interface DraftUserOverride {
  id: string;
  userId: string | null;
  assignments: AppGroupAssignments;
}

function TeamAssignmentRow({
  row,
  apps,
  onSave,
}: {
  row: TeamAppAssignmentRow;
  apps: AppCatalogItem[];
  onSave: (teamId: string, assignments: AppGroupAssignments) => Promise<SaveAssignmentsResult>;
}) {
  const { msg } = useI18n();
  const { assignments, saving, error, patchAssignments } = useAutoSaveAssignmentRow(
    row.assignments,
    row.team_id,
    (next) => onSave(row.team_id, next),
  );

  return (
    <tr>
      <td>
        <strong>{row.team_name}</strong>
        {saving && <p className="hint">{msg('loading')}</p>}
        {error && <p className="form-error">{error}</p>}
      </td>
      <AppAssignmentCells apps={apps} assignments={assignments} onPatch={patchAssignments} />
    </tr>
  );
}

function SavedUserOverrideRow({
  row,
  apps,
  users,
  usedUserIds,
  onSave,
  onUserChange,
  onDelete,
}: {
  row: UserAppAssignmentRow;
  apps: AppCatalogItem[];
  users: PlatformUser[];
  usedUserIds: Set<string>;
  onSave: (userId: string, assignments: AppGroupAssignments) => Promise<SaveAssignmentsResult>;
  onUserChange: (
    previousUserId: string,
    nextUserId: string,
    assignments: AppGroupAssignments,
  ) => Promise<string | null>;
  onDelete: (userId: string) => Promise<string | null>;
}) {
  const { msg } = useI18n();
  const { assignments, saving, error, patchAssignments } = useAutoSaveAssignmentRow(
    row.assignments,
    row.actor_id,
    (next) => onSave(row.actor_id, next),
  );
  const [userChangeError, setUserChangeError] = useState<string | null>(null);
  const [userChanging, setUserChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectableUsers = users.filter(
    (user) => user.id === row.actor_id || !usedUserIds.has(user.id),
  );

  async function handleUserSelect(nextUserId: string) {
    if (!nextUserId || nextUserId === row.actor_id) return;
    setUserChangeError(null);
    setUserChanging(true);
    const err = await onUserChange(row.actor_id, nextUserId, assignments);
    setUserChanging(false);
    if (err) setUserChangeError(err);
  }

  async function handleDelete() {
    setUserChangeError(null);
    setDeleting(true);
    const err = await onDelete(row.actor_id);
    setDeleting(false);
    if (err) setUserChangeError(err);
  }

  const busy = saving || userChanging || deleting;

  return (
    <tr>
      <td>
        <div className="admin-override-subject">
          <button
            type="button"
            className="button-icon button-icon--danger"
            title={msg('adminAppsUserOverrideClear')}
            aria-label={msg('adminAppsUserOverrideClear')}
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            <LuTrash2 size={18} aria-hidden />
          </button>
          <select
            className="admin-settings-select"
            value={row.actor_id}
            disabled={busy}
            onChange={(e) => void handleUserSelect(e.target.value)}
          >
            {selectableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-override-subject-meta">
          {busy && <p className="hint">{msg('loading')}</p>}
          {(error || userChangeError) && <p className="form-error">{error ?? userChangeError}</p>}
        </div>
      </td>
      <AppAssignmentCells apps={apps} assignments={assignments} disabled={busy} onPatch={patchAssignments} />
    </tr>
  );
}

function DraftUserOverrideRow({
  draft,
  apps,
  users,
  usedUserIds,
  onUserSelect,
  onPatch,
  onDelete,
}: {
  draft: DraftUserOverride;
  apps: AppCatalogItem[];
  users: PlatformUser[];
  usedUserIds: Set<string>;
  onUserSelect: (draftId: string, userId: string) => Promise<string | null>;
  onPatch: (draftId: string, patch: Partial<AppGroupAssignments>) => void;
  onDelete: (draftId: string) => void;
}) {
  const { msg } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectableUsers = users.filter((user) => !usedUserIds.has(user.id));

  function patchAssignments(patch: Partial<AppGroupAssignments>) {
    onPatch(draft.id, patch);
  }

  async function handleUserSelect(userId: string) {
    if (!userId) return;
    setError(null);
    setSaving(true);
    const err = await onUserSelect(draft.id, userId);
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <tr>
      <td>
        <div className="admin-override-subject">
          <button
            type="button"
            className="button-icon button-icon--danger"
            title={msg('adminAppsUserOverrideClear')}
            aria-label={msg('adminAppsUserOverrideClear')}
            disabled={saving}
            onClick={() => onDelete(draft.id)}
          >
            <LuTrash2 size={18} aria-hidden />
          </button>
          <select
            className="admin-settings-select"
            value={draft.userId ?? ''}
            disabled={saving}
            onChange={(e) => void handleUserSelect(e.target.value)}
          >
            <option value="">{msg('adminAppsUserOverrideSelect')}</option>
            {selectableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-override-subject-meta">
          {saving && <p className="hint">{msg('loading')}</p>}
          {error && <p className="form-error">{error}</p>}
        </div>
      </td>
      <AppAssignmentCells
        apps={apps}
        assignments={draft.assignments}
        disabled={saving}
        onPatch={patchAssignments}
      />
    </tr>
  );
}

export function AdminAppsPage() {
  const { msg } = useI18n();
  const { data, loading, saveTeamAssignments, saveUserAssignments, clearUserAssignments } =
    useAppAssignments();
  const { items: users, loading: usersLoading } = usePlatformUsers();
  const { refreshInstalledApps } = useInstalledApps();
  const [draftOverrides, setDraftOverrides] = useState<DraftUserOverride[]>([]);

  const usedUserIds = useMemo(() => {
    const overrides = data?.actor_overrides ?? data?.user_overrides ?? [];
    const ids = new Set(overrides.map((row) => row.actor_id));
    for (const draft of draftOverrides) {
      if (draft.userId) ids.add(draft.userId);
    }
    return ids;
  }, [data?.actor_overrides, data?.user_overrides, draftOverrides]);

  const hasOverrideRows =
    (data?.actor_overrides?.length ?? data?.user_overrides?.length ?? 0) > 0 ||
    draftOverrides.length > 0;

  async function handleTeamSave(
    teamId: string,
    assignments: AppGroupAssignments,
  ): Promise<SaveAssignmentsResult> {
    const res = await saveTeamAssignments(teamId, assignments);
    if (!res.ok) return res;
    await refreshInstalledApps({ silent: true });
    return res;
  }

  async function handleUserSave(
    userId: string,
    assignments: AppGroupAssignments,
  ): Promise<SaveAssignmentsResult> {
    const res = await saveUserAssignments(userId, assignments);
    if (!res.ok) return res;
    await refreshInstalledApps({ silent: true });
    return res;
  }

  async function handleUserClear(userId: string) {
    const err = await clearUserAssignments(userId);
    if (!err) await refreshInstalledApps({ silent: true });
    return err;
  }

  async function handleUserChange(
    previousUserId: string,
    nextUserId: string,
    assignments: AppGroupAssignments,
  ) {
    const clearErr = await clearUserAssignments(previousUserId);
    if (clearErr) return clearErr;
    const res = await saveUserAssignments(nextUserId, assignments);
    if (!res.ok) return res.error;
    await refreshInstalledApps({ silent: true });
    return null;
  }

  function addUserOverride() {
    setDraftOverrides((prev) => [
      ...prev,
      { id: crypto.randomUUID(), userId: null, assignments: { ...EMPTY_ASSIGNMENTS } },
    ]);
  }

  function removeDraftOverride(draftId: string) {
    setDraftOverrides((prev) => prev.filter((draft) => draft.id !== draftId));
  }

  function patchDraftOverride(draftId: string, patch: Partial<AppGroupAssignments>) {
    setDraftOverrides((prev) =>
      prev.map((draft) =>
        draft.id === draftId
          ? { ...draft, assignments: { ...draft.assignments, ...patch } }
          : draft,
      ),
    );
  }

  async function activateDraftOverride(draftId: string, userId: string) {
    const draft = draftOverrides.find((row) => row.id === draftId);
    if (!draft) return null;

    const res = await saveUserAssignments(userId, draft.assignments);
    if (!res.ok) return res.error;

    setDraftOverrides((prev) => prev.filter((row) => row.id !== draftId));
    await refreshInstalledApps({ silent: true });
    return null;
  }

  const tableLoading = loading || usersLoading;
  const apps = data?.apps ?? [];

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/admin/settings">{msg('administration')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{msg('navApps')}</span>
      </nav>

      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{msg('navApps')}</h1>
          <p className="hint">{msg('adminAppsAssignmentsHint')}</p>
        </div>
      </header>

      {tableLoading && <p>{msg('loading')}</p>}

      {!tableLoading && data && (
        <>
          <div className="admin-list-card">
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--fixed-cols">
                <thead>
                  <tr>
                    <th className="admin-table-col-label">{msg('adminAppsColSubject')}</th>
                    <th>{msg('adminAppsColFlightLevel0')}</th>
                    <th>{msg('adminAppsColFlightLevel1')}</th>
                    <th>{msg('adminAppsColFlightLevel2')}</th>
                    <th>{msg('adminAppsColFlightLevel3')}</th>
                    <th>{msg('adminAppsColOtherApps')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-table-empty">
                        {msg('adminAppsTeamsEmpty')}
                      </td>
                    </tr>
                  ) : (
                    data.teams.map((row) => (
                      <TeamAssignmentRow
                        key={row.team_id}
                        row={row}
                        apps={apps}
                        onSave={handleTeamSave}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <header className="admin-page-header admin-page-header--spaced">
            <div>
              <h2 className="admin-page-title admin-page-title--section">{msg('adminAppsUserOverrides')}</h2>
              <p className="hint">{msg('adminAppsUserOverridesHint')}</p>
            </div>
            <div className="admin-toolbar">
              <button type="button" className="button-outline" onClick={addUserOverride}>
                {msg('adminAppsUserOverrideAdd')}
              </button>
            </div>
          </header>

          <div className="admin-list-card">
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--fixed-cols">
                <thead>
                  <tr>
                    <th className="admin-table-col-label">{msg('adminAppsColSubject')}</th>
                    <th>{msg('adminAppsColFlightLevel0')}</th>
                    <th>{msg('adminAppsColFlightLevel1')}</th>
                    <th>{msg('adminAppsColFlightLevel2')}</th>
                    <th>{msg('adminAppsColFlightLevel3')}</th>
                    <th>{msg('adminAppsColOtherApps')}</th>
                  </tr>
                </thead>
                <tbody>
                  {!hasOverrideRows ? (
                    <tr>
                      <td colSpan={6} className="admin-table-empty">
                        {msg('adminAppsUserOverridesEmpty')}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {(data.actor_overrides ?? data.user_overrides ?? []).map((row) => (
                        <SavedUserOverrideRow
                          key={row.actor_id}
                          row={row}
                          apps={apps}
                          users={users}
                          usedUserIds={usedUserIds}
                          onSave={handleUserSave}
                          onUserChange={handleUserChange}
                          onDelete={handleUserClear}
                        />
                      ))}
                      {draftOverrides.map((draft) => (
                        <DraftUserOverrideRow
                          key={draft.id}
                          draft={draft}
                          apps={apps}
                          users={users}
                          usedUserIds={usedUserIds}
                          onUserSelect={activateDraftOverride}
                          onPatch={patchDraftOverride}
                          onDelete={removeDraftOverride}
                        />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
