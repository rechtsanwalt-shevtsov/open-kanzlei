import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuSettings, LuTrash2 } from 'react-icons/lu';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiHeaders, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { listTaskModelAttributes, type AttributeDefinition } from '@shell/lib/attribute-api.js';
import { dataTypeMessageKey } from '@shell/lib/data-type-label.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import {
  findTaskStatusDefinition,
  isTaskReferencePlatformKey,
} from '@shell/lib/task-instance-status.js';
import { selectOptionLabel } from '@shell/lib/select-option-labels.js';
import { instanceTitle } from '@shell/lib/work-instance.js';
import type { components } from '@shell/api/schema.js';
import { TaskFieldValueCell } from '../components/TaskFieldValueCell.js';
import { taskTitle } from '../lib/task-display.js';

type TaskItem = components['schemas']['Task'];

function isEditableDetailField(def: AttributeDefinition): boolean {
  if (def.key === 'status') return false;
  if (isTaskReferencePlatformKey(def.key)) return false;
  return true;
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [modelLabel, setModelLabel] = useState('');
  const [caseLabel, setCaseLabel] = useState('');
  const [fields, setFields] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const headers = apiHeaders(locale);
    const taskRes = await api.GET('/v1/tasks/{id}', { headers, params: { path: { id } } });
    if (taskRes.error || !taskRes.data) {
      setError(msg('errorGeneric'));
      setLoading(false);
      return;
    }
    const item = taskRes.data;
    setTask(item);

    const [modelRes, caseRes] = await Promise.all([
      api.GET('/v1/task-models/{id}', {
        headers,
        params: { path: { id: item.task_model_id } },
      }),
      api.GET('/v1/cases/{id}', {
        headers,
        params: { path: { id: item.case_id } },
      }),
    ]);

    if (modelRes.data) {
      setModelLabel(
        modelRes.data.display_name ??
          labelFromTranslations(modelRes.data.translations, modelRes.data.key, locale),
      );
    } else {
      setModelLabel(item.task_model_id);
    }

    if (caseRes.data) {
      const caseModelRes = await api.GET('/v1/case-models/{id}', {
        headers,
        params: { path: { id: caseRes.data.case_model_id } },
      });
      const caseModelLabel = caseModelRes.data
        ? (caseModelRes.data.display_name ??
          labelFromTranslations(caseModelRes.data.translations, caseModelRes.data.key, locale))
        : caseRes.data.case_model_id;
      setCaseLabel(instanceTitle(caseRes.data.attributes, caseModelLabel));
    } else {
      setCaseLabel(item.case_id);
    }

    const attrsRes = await listTaskModelAttributes(item.task_model_id, locale, 'instance');
    if (attrsRes.error) {
      setError(msg('errorGeneric'));
      setLoading(false);
      return;
    }
    setFields((attrsRes.data?.items ?? []) as AttributeDefinition[]);
    setLoading(false);
  }, [id, locale, msg]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const title = useMemo(() => {
    if (!task) return msg('loading');
    return taskTitle(task, modelLabel);
  }, [task, modelLabel, msg]);

  async function patchStatus(nextStatus: string) {
    if (!id) return;
    setFieldSaving(true);
    setError(null);
    const res = await api.PATCH('/v1/tasks/{id}', {
      headers: apiJsonHeaders(locale),
      params: { path: { id } },
      body: { status: nextStatus },
    });
    setFieldSaving(false);
    if (res.error || !res.response.ok) {
      setError(msg('errorGeneric'));
      return;
    }
    setTask(res.data ?? null);
  }

  async function handleDelete() {
    if (!id || deleting) return;
    if (!window.confirm(msg('tasDeleteTaskConfirm'))) return;

    setDeleting(true);
    setError(null);
    const res = await api.DELETE('/v1/tasks/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id } },
    });
    setDeleting(false);
    if (res.error || !res.response.ok) {
      setError(msg('errorGeneric'));
      return;
    }
    navigate('/apps/tasks');
  }

  function fieldName(def: AttributeDefinition): string {
    return def.display_name ?? labelFromTranslations(def.translations, def.key, locale);
  }

  const statusDefinition = useMemo(() => findTaskStatusDefinition(fields), [fields]);

  const sortedFields = useMemo(
    () =>
      [...fields]
        .filter(isEditableDetailField)
        .sort((a, b) => fieldName(a).localeCompare(fieldName(b), locale)),
    [fields, locale],
  );

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/tasks">{msg('tasAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{title}</span>
      </nav>

      {task && (
        <header className="admin-page-header">
          <h1 className="admin-page-title">{title}</h1>
          <div className="admin-toolbar">
            <button
              type="button"
              className="button-icon button-icon--danger"
              title={msg('tasDeleteTask')}
              aria-label={msg('tasDeleteTask')}
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              <LuTrash2 size={18} aria-hidden />
            </button>
            <Link
              to="/apps/tasks/settings"
              className="button-icon"
              title={msg('tasSettingsTitle')}
              aria-label={msg('tasSettingsTitle')}
            >
              <LuSettings size={18} aria-hidden />
            </Link>
          </div>
        </header>
      )}

      {loading && <p>{msg('loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && task && (
        <>
          <p className="admin-table-muted admin-page-subtitle">
            {msg('tasColCase')}:{' '}
            <Link to={`/apps/cases/${task.case_id}`}>{caseLabel}</Link>
            {' · '}
            {msg('tasColModel')}: {modelLabel}
          </p>

          <div className="admin-list-card">
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--fixed-cols">
                <thead>
                  <tr>
                    <th className="admin-table-col-label">{msg('tasColField')}</th>
                    <th className="admin-table-col-status">{msg('modelsColType')}</th>
                    <th>{msg('tasColFieldValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statusDefinition && (
                    <tr className="admin-table-row--system">
                      <td>
                        {statusDefinition.display_name ?? fieldName(statusDefinition)}
                        <span className="admin-table-sub"> ({msg('cmdSystemField')})</span>
                      </td>
                      <td className="admin-table-col-status">{msg('cmdFieldTypeEnum')}</td>
                      <td>
                        <select
                          className="admin-table-inline-input"
                          value={task.status}
                          disabled={fieldSaving}
                          onChange={(e) => void patchStatus(e.target.value)}
                          aria-label={statusDefinition.display_name ?? fieldName(statusDefinition)}
                        >
                          {(statusDefinition.select_options ?? []).map((optionKey) => (
                            <option key={optionKey} value={optionKey}>
                              {selectOptionLabel(optionKey, statusDefinition)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )}
                  {sortedFields.length === 0 ? (
                    <tr>
                      <td colSpan={3}>{msg('tasFieldsEmpty')}</td>
                    </tr>
                  ) : (
                    sortedFields.map((def) => (
                      <tr key={def.id}>
                        <td>{fieldName(def)}</td>
                        <td className="admin-table-col-status">
                          {msg(dataTypeMessageKey(def.data_type))}
                        </td>
                        <td>
                          <TaskFieldValueCell
                            taskId={task.id}
                            fieldKey={def.key}
                            definition={def}
                            value={task.attributes?.[def.key]}
                            locale={locale}
                            saving={fieldSaving}
                            onSavingChange={setFieldSaving}
                            onUpdated={() => void refresh()}
                          />
                        </td>
                      </tr>
                    ))
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
