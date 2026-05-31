import { FormEvent, useEffect, useState } from 'react';
import { api, apiHeaders } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nContext.js';
import { WORK_STATUSES, workStatusLabel } from '../../lib/work-status.js';
import type { ModelOption } from '../../hooks/useModelOptions.js';
import type { components } from '../../api/schema.js';

type TenantUser = components['schemas']['TenantUser'];

interface CreateCaseDialogProps {
  open: boolean;
  models: ModelOption[];
  users: TenantUser[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCaseDialog({
  open,
  models,
  users,
  onClose,
  onCreated,
}: CreateCaseDialogProps) {
  const { locale, msg } = useI18n();
  const [caseModelId, setCaseModelId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('not_started');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCaseModelId(models[0]?.id ?? '');
    setTitle('');
    setStatus('not_started');
    setAssigneeIds([]);
    setError(null);
  }, [open, models]);

  if (!open) return null;

  function toggleAssignee(userId: string) {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!caseModelId) {
      setError(msg('workModelRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const attributes: Record<string, unknown> = {};
    if (title.trim()) attributes.title = title.trim();

    const res = await api.POST('/v1/cases', {
      headers: apiHeaders(locale),
      body: {
        case_model_id: caseModelId,
        status,
        attributes,
        assignee_user_ids: assigneeIds.length ? assigneeIds : undefined,
      },
    });
    setSubmitting(false);
    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="dialog"
        aria-labelledby="create-case-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-case-title">{msg('workCreateCaseTitle')}</h2>
        <form onSubmit={handleSubmit} className="admin-dialog-form">
          <label>
            {msg('workCaseModel')}
            <select
              value={caseModelId}
              onChange={(e) => setCaseModelId(e.target.value)}
              required
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {msg('workTitle')}
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            {msg('workColStatus')}
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {WORK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {workStatusLabel(s, msg)}
                </option>
              ))}
            </select>
          </label>
          {users.length > 0 && (
            <fieldset className="work-assignee-picker">
              <legend>{msg('workColAssignees')}</legend>
              <ul>
                {users.map((u) => (
                  <li key={u.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(u.id)}
                        onChange={() => toggleAssignee(u.id)}
                      />
                      {u.username}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="admin-dialog-actions">
            <button type="button" onClick={onClose}>
              {msg('cancel')}
            </button>
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? msg('loading') : msg('workCreateCase')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
