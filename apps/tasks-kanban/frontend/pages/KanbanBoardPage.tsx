import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuSettings, LuUserRoundCheck } from 'react-icons/lu';
import { CreateTaskDialog } from '@apps/tasks/frontend/components/CreateTaskDialog.js';
import { api, apiHeaders, readApiError } from '@shell/api/client.js';
import { useAuth } from '@shell/context/AuthContext.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { userIsAdmin } from '@shell/lib/is-admin.js';
import type { components } from '@shell/api/schema.js';
import {
  fetchKanbanBoard,
  patchKanbanWipLimit,
  postKanbanMove,
  type KanbanBoard,
  type KanbanMoveDirection,
} from '../api.js';
import { KanbanBoardView } from '../components/KanbanBoard.js';
import { WipEditDialog } from '../components/WipEditDialog.js';

type PlatformUser = components['schemas']['PlatformUser'];
type TaskModel = components['schemas']['TaskModel'];
type CaseItem = components['schemas']['Case'];
type CaseModel = components['schemas']['CaseModel'];

export function KanbanBoardPage() {
  const { user } = useAuth();
  const { locale, msg } = useI18n();
  const admin = userIsAdmin(user?.teams ?? []);

  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [assigneeUserId, setAssigneeUserId] = useState(user?.id ?? '');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [wipEdit, setWipEdit] = useState<{
    columnKey: string;
    limit: number | null;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [taskModels, setTaskModels] = useState<TaskModel[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [caseModels, setCaseModels] = useState<CaseModel[]>([]);
  const [createDataLoading, setCreateDataLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: apiError } = await api.GET('/v1/platform-users', {
        headers: apiHeaders(locale),
      });
      if (cancelled) return;
      if (apiError) return;
      setUsers(data?.items ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const loadBoard = useCallback(async () => {
    if (!assigneeUserId) return;
    setLoading(true);
    setError(null);
    const { data, error: apiError, response } = await fetchKanbanBoard(locale, assigneeUserId, search);
    if (apiError || !response.ok) {
      setError(await readApiError(apiError, msg('errorGeneric')));
      setBoard(null);
    } else {
      setBoard(data ?? null);
    }
    setLoading(false);
  }, [assigneeUserId, locale, search]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  async function handleMove(taskId: string, direction: KanbanMoveDirection) {
    setMoveError(null);
    setMovingTaskId(taskId);
    const { data, error: apiError, response } = await postKanbanMove(locale, {
      assignee_actor_id: assigneeUserId,
      task_id: taskId,
      direction,
    });
    setMovingTaskId(null);
    if (apiError || !response.ok) {
      setMoveError(await readApiError(apiError, msg('errorGeneric')));
      return;
    }
    if (data) setBoard(data);
  }

  async function handleDelete(taskId: string) {
    if (deletingTaskId) return;
    if (!window.confirm(msg('tkbDeleteTaskConfirm'))) return;

    setMoveError(null);
    setDeletingTaskId(taskId);
    const { error: apiError, response } = await api.DELETE('/v1/tasks/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id: taskId } },
    });
    setDeletingTaskId(null);
    if (apiError || !response.ok) {
      setMoveError(await readApiError(apiError, msg('errorGeneric')));
      return;
    }
    await loadBoard();
  }

  async function handleWipSave(limit: number | null) {
    if (!wipEdit) return;
    const { error: apiError, response } = await patchKanbanWipLimit(locale, {
      assignee_actor_id: assigneeUserId,
      column_key: wipEdit.columnKey,
      limit,
    });
    if (apiError || !response.ok) {
      throw new Error(await readApiError(apiError, msg('errorGeneric')));
    }
    await loadBoard();
  }

  async function openCreateDialog() {
    setCreateOpen(true);
    if (taskModels.length > 0 && cases.length > 0) return;

    setCreateDataLoading(true);
    const headers = apiHeaders(locale);
    const [modelsRes, casesRes, caseModelsRes] = await Promise.all([
      api.GET('/v1/task-models', { headers }),
      api.GET('/v1/cases', { headers }),
      api.GET('/v1/case-models', { headers }),
    ]);
    setCreateDataLoading(false);

    if (!modelsRes.error && modelsRes.data) {
      setTaskModels(modelsRes.data.items ?? []);
    }
    if (!casesRes.error && casesRes.data) {
      setCases(casesRes.data.items ?? []);
    }
    if (!caseModelsRes.error && caseModelsRes.data) {
      setCaseModels(caseModelsRes.data.items ?? []);
    }
  }

  return (
    <div className="work-page kanban-page">
      <header className="work-page-header">
        <h1>{msg('tkbAppTitle')}</h1>
        <div className="admin-toolbar">
          <button
            type="button"
            className="button-outline"
            disabled={createDataLoading}
            onClick={() => void openCreateDialog()}
          >
            + {msg('tasCreate')}
          </button>
          <Link
            to="/apps/tasks-kanban/settings"
            className="button-icon"
            title={msg('tkbSettings')}
            aria-label={msg('tkbSettings')}
          >
            <LuSettings size={18} aria-hidden />
          </Link>
        </div>
      </header>

      <div className="work-toolbar kanban-toolbar">
        <div className="work-toolbar-row kanban-toolbar-row">
          <div className="kanban-filter-user">
            <LuUserRoundCheck size={18} className="kanban-filter-user-icon" aria-hidden />
            <select
              className="work-filter-select"
              value={assigneeUserId}
              aria-label={msg('tkbFilterUser')}
              onChange={(e) => setAssigneeUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </div>
          <div className="work-search-wrap">
            <input
              className="work-search"
              type="search"
              placeholder={msg('tkbSearchPlaceholder')}
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearch(searchDraft);
              }}
            />
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setSearch(searchDraft)}
          >
            {msg('tkbSearch')}
          </button>
        </div>
      </div>

      {loading ? <p className="work-muted">{msg('loading')}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {moveError ? <p className="form-error">{moveError}</p> : null}

      {board && !loading ? (
        <div className="kanban-board-scroll">
          <KanbanBoardView
            board={board}
            admin={admin}
            movingTaskId={movingTaskId}
            deletingTaskId={deletingTaskId}
            onMove={handleMove}
            onDelete={handleDelete}
            onEditWip={(columnKey, limit) => setWipEdit({ columnKey, limit })}
          />
        </div>
      ) : null}

      {wipEdit ? (
        <WipEditDialog
          columnKey={wipEdit.columnKey}
          initialLimit={wipEdit.limit}
          onClose={() => setWipEdit(null)}
          onSave={handleWipSave}
        />
      ) : null}

      <CreateTaskDialog
        open={createOpen}
        taskModels={taskModels}
        cases={cases}
        caseModels={caseModels}
        hideStatus
        forcedStatus="not_started"
        hiddenFieldKeys={['activity', 'activity_status']}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void loadBoard();
        }}
      />
    </div>
  );
}
