import { useEffect, useState } from 'react';
import type { components } from '@shell/api/schema.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import {
  TASK_MODEL_STATUSES,
  taskModelStatusLabel,
  type TaskModelStatus,
} from '../lib/task-model-status.js';
import type { SystemFieldRow } from '../lib/task-model-system-fields.js';

type TaskModel = components['schemas']['TaskModel'];

interface SystemFieldValueCellProps {
  row: SystemFieldRow;
  model: TaskModel;
  saving: boolean;
  onPatch: (body: components['schemas']['UpdateTaskModelRequest']) => Promise<boolean>;
}

export function SystemFieldValueCell({
  row,
  model,
  saving,
  onPatch,
}: SystemFieldValueCellProps) {
  const { locale, msg } = useI18n();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (row.fieldKey === 'translations') {
      setDraft(model.translations?.[locale] ?? '');
    } else if (row.fieldKey === 'description') {
      setDraft(model.description ?? '');
    }
  }, [model, row.fieldKey, locale]);

  if (row.readOnly) {
    return <span className="admin-table-muted">{row.valueText}</span>;
  }

  if (row.fieldKey === 'status') {
    return (
      <select
        className="admin-settings-select admin-table-inline-input"
        value={model.status}
        disabled={saving}
        onChange={(e) => void onPatch({ status: e.target.value as TaskModelStatus })}
        aria-label={msg(row.labelKey)}
      >
        {TASK_MODEL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {taskModelStatusLabel(s, msg)}
          </option>
        ))}
      </select>
    );
  }

  if (row.fieldKey === 'translations') {
    return (
      <input
        type="text"
        className="admin-table-inline-input"
        value={draft}
        disabled={saving}
        aria-label={msg(row.labelKey)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim();
          const current = (model.translations?.[locale] ?? '').trim();
          if (!next || next === current) {
            setDraft(model.translations?.[locale] ?? '');
            return;
          }
          void onPatch({ name: next, locale });
        }}
      />
    );
  }

  if (row.fieldKey === 'description') {
    return (
      <textarea
        className="admin-table-inline-input"
        rows={2}
        value={draft}
        disabled={saving}
        aria-label={msg(row.labelKey)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim();
          const current = (model.description ?? '').trim();
          if (next === current) {
            setDraft(model.description ?? '');
            return;
          }
          void onPatch({ description: next });
        }}
      />
    );
  }

  return <span className="admin-table-muted">{row.valueText}</span>;
}
