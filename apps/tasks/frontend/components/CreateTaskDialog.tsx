import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, apiHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { listTaskModelAttributes, type AttributeDefinition } from '@shell/lib/attribute-api.js';
import {
  findTaskStatusDefinition,
  isTaskReferencePlatformKey,
} from '@shell/lib/task-instance-status.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import { instanceTitle } from '@shell/lib/work-instance.js';
import type { components } from '@shell/api/schema.js';
import { FieldSelectInput } from '@shell/components/admin/FieldSelectInput.js';
import {
  defaultFieldValue,
  defaultMultiSelectValue,
  parseFieldValueFromState,
} from '../lib/field-value.js';

type TaskModel = components['schemas']['TaskModel'];
type CaseItem = components['schemas']['Case'];
type CaseModel = components['schemas']['CaseModel'];

function fieldLabel(def: AttributeDefinition, locale: string): string {
  return (
    def.display_name ?? labelFromTranslations(def.translations, def.key, locale as 'de' | 'en')
  );
}

function isEditableCreateField(
  def: AttributeDefinition,
  hiddenFieldKeys: ReadonlySet<string>,
): boolean {
  if (def.key === 'status') return false;
  if (hiddenFieldKeys.has(def.key)) return false;
  if (isTaskReferencePlatformKey(def.key)) return false;
  return true;
}

interface CreateTaskDialogProps {
  open: boolean;
  taskModels: TaskModel[];
  cases: CaseItem[];
  caseModels: CaseModel[];
  onClose: () => void;
  onCreated: (taskId: string) => void;
  /** When true, status is not shown and `forcedStatus` is sent on create. */
  hideStatus?: boolean;
  forcedStatus?: string;
  /** Instance field keys hidden in the create form (e.g. activity). */
  hiddenFieldKeys?: string[];
}

export function CreateTaskDialog({
  open,
  taskModels,
  cases,
  caseModels,
  onClose,
  onCreated,
  hideStatus = false,
  forcedStatus = 'not_started',
  hiddenFieldKeys = [],
}: CreateTaskDialogProps) {
  const { locale, msg } = useI18n();
  const hiddenKeys = useMemo(() => new Set(hiddenFieldKeys), [hiddenFieldKeys]);

  const activeModels = useMemo(
    () => taskModels.filter((m) => m.status === 'active'),
    [taskModels],
  );

  const caseModelLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of caseModels) {
      map.set(
        m.id,
        m.display_name ?? labelFromTranslations(m.translations, m.key, locale),
      );
    }
    return map;
  }, [caseModels, locale]);

  const caseOptions = useMemo(() => {
    return cases.map((c) => {
      const modelLabel = caseModelLabels.get(c.case_model_id) ?? c.case_model_id;
      const title = instanceTitle(c.attributes, modelLabel);
      return { id: c.id, label: title };
    });
  }, [cases, caseModelLabels]);

  const [caseId, setCaseId] = useState('');
  const [taskModelId, setTaskModelId] = useState('');
  const [status, setStatus] = useState('');
  const [instanceFields, setInstanceFields] = useState<AttributeDefinition[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [multiFieldValues, setMultiFieldValues] = useState<Record<string, string[]>>({});
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [users, setUsers] = useState<components['schemas']['TenantUser'][]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCaseId(caseOptions[0]?.id ?? '');
    setTaskModelId(activeModels[0]?.id ?? '');
    setStatus('');
    setInstanceFields([]);
    setFieldValues({});
    setMultiFieldValues({});
    setAssigneeUserId('');
    setError(null);
  }, [open, activeModels, caseOptions]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void api.GET('/v1/users', { headers: apiHeaders(locale) }).then((res) => {
      if (cancelled || res.error || !res.data) return;
      setUsers(res.data.items ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, locale]);

  useEffect(() => {
    if (!open || !taskModelId) {
      setInstanceFields([]);
      setFieldValues({});
      setMultiFieldValues({});
      return;
    }
    let cancelled = false;
    setFieldsLoading(true);
    void listTaskModelAttributes(taskModelId, locale, 'instance').then((res) => {
      if (cancelled) return;
      setFieldsLoading(false);
      if (res.error) {
        setInstanceFields([]);
        return;
      }
      const defs = (res.data?.items ?? []) as AttributeDefinition[];
      setInstanceFields(defs);
      const statusDef = findTaskStatusDefinition(defs);
      const initialStatus =
        typeof statusDef?.default_value === 'string'
          ? statusDef.default_value
          : (statusDef?.select_options?.[0] ?? '');
      setStatus(initialStatus);
      const initial: Record<string, string> = {};
      const initialMulti: Record<string, string[]> = {};
      for (const def of defs) {
        if (!isEditableCreateField(def, hiddenKeys)) continue;
        if (def.data_type === 'multi_select') {
          initialMulti[def.key] = defaultMultiSelectValue(def);
        } else {
          initial[def.key] = defaultFieldValue(def);
        }
      }
      setFieldValues(initial);
      setMultiFieldValues(initialMulti);
    });
    return () => {
      cancelled = true;
    };
  }, [open, taskModelId, locale]);

  const statusDefinition = useMemo(
    () => findTaskStatusDefinition(instanceFields),
    [instanceFields],
  );

  const sortedFields = useMemo(
    () =>
      [...instanceFields]
        .filter((def) => isEditableCreateField(def, hiddenKeys))
        .sort((a, b) => fieldLabel(a, locale).localeCompare(fieldLabel(b, locale))),
    [instanceFields, hiddenKeys, locale],
  );

  if (!open) return null;

  function setField(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function renderFieldInput(def: AttributeDefinition) {
    const value = fieldValues[def.key] ?? '';
    const label = fieldLabel(def, locale);
    const required = def.is_required;

    if (def.data_type === 'boolean') {
      return (
        <label key={def.id} className="admin-checkbox-label">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => setField(def.key, e.target.checked ? 'true' : 'false')}
          />
          {label}
          {required ? ' *' : ''}
        </label>
      );
    }

    if (def.data_type === 'single_select' || def.data_type === 'multi_select') {
      const selectValue =
        def.data_type === 'single_select' ? value : (multiFieldValues[def.key] ?? []);
      return (
        <div key={def.id} className="cas-field-block">
          <span className="cas-field-block-label">
            {label}
            {required ? ' *' : ''}
          </span>
          <FieldSelectInput
            dataType={def.data_type}
            options={def.select_options ?? []}
            optionLabels={def.select_option_labels}
            value={selectValue}
            onChange={(next) => {
              if (def.data_type === 'single_select') {
                setField(def.key, typeof next === 'string' ? next : '');
              } else {
                setMultiFieldValues((prev) => ({
                  ...prev,
                  [def.key]: Array.isArray(next) ? next : [],
                }));
              }
            }}
          />
        </div>
      );
    }

    const inputType: 'text' | 'number' | 'date' =
      def.data_type === 'number' || def.data_type === 'money'
        ? 'number'
        : def.data_type === 'date'
          ? 'date'
          : 'text';

    return (
      <label key={def.id}>
        {label}
        {required ? ' *' : ''}
        <input
          type={inputType}
          value={value}
          onChange={(e) => setField(def.key, e.target.value)}
        />
      </label>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!caseId) {
      setError(msg('tasNoCases'));
      return;
    }
    if (!taskModelId) {
      setError(msg('tasNoModels'));
      return;
    }

    const attributes: Record<string, unknown> = {};
    for (const def of instanceFields) {
      if (!isEditableCreateField(def, hiddenKeys)) continue;
      const raw = fieldValues[def.key] ?? '';
      const multi = multiFieldValues[def.key] ?? [];
      const parsed = parseFieldValueFromState(def, raw, multi);
      if (def.is_required && (parsed === null || (Array.isArray(parsed) && parsed.length === 0))) {
        setError(msg('workRequiredFieldMissing'));
        return;
      }
      if (parsed !== null && !(Array.isArray(parsed) && parsed.length === 0)) {
        attributes[def.key] = parsed;
      }
    }

    setSubmitting(true);
    setError(null);

    const res = await api.POST('/v1/tasks', {
      headers: apiHeaders(locale),
      body: {
        case_id: caseId,
        task_model_id: taskModelId,
        status: hideStatus ? forcedStatus : status,
        assignee_user_ids: assigneeUserId ? [assigneeUserId] : undefined,
        attributes: Object.keys(attributes).length ? attributes : undefined,
      },
    });
    setSubmitting(false);
    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }
    onCreated(res.data!.id);
    onClose();
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-task-dialog-title">{msg('tasCreate')}</h2>
        <form onSubmit={handleSubmit} className="form admin-dialog-form">
          {caseOptions.length === 0 ? (
            <p className="form-error">{msg('tasNoCases')}</p>
          ) : activeModels.length === 0 ? (
            <p className="form-error">{msg('tasNoModels')}</p>
          ) : (
            <>
              <label>
                {msg('tasColCase')}
                <select value={caseId} onChange={(e) => setCaseId(e.target.value)} required>
                  {caseOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {msg('tasColModel')}
                <select
                  value={taskModelId}
                  onChange={(e) => setTaskModelId(e.target.value)}
                  required
                >
                  {activeModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name ??
                        labelFromTranslations(m.translations, m.key, locale)}
                    </option>
                  ))}
                </select>
              </label>

              {!hideStatus && statusDefinition && (
                <label>
                  {statusDefinition.display_name ??
                    labelFromTranslations(statusDefinition.translations, 'status', locale)}
                  <FieldSelectInput
                    dataType="single_select"
                    options={statusDefinition.select_options ?? []}
                    optionLabels={statusDefinition.select_option_labels}
                    value={status}
                    onChange={(next) => setStatus(typeof next === 'string' ? next : '')}
                  />
                </label>
              )}

              <label>
                {msg('tasColAssignee')}
                <select
                  value={assigneeUserId}
                  onChange={(e) => setAssigneeUserId(e.target.value)}
                >
                  <option value="">{msg('tasAssigneeNone')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </label>

              {fieldsLoading && <p className="status">{msg('loading')}</p>}
              {!fieldsLoading && sortedFields.length > 0 && (
                <fieldset className="cas-create-fields">
                  <legend>{msg('tasFieldsSection')}</legend>
                  {sortedFields.map((def) => renderFieldInput(def))}
                </fieldset>
              )}
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="admin-dialog-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              {msg('cancel')}
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={
                submitting || caseOptions.length === 0 || activeModels.length === 0
              }
            >
              {submitting ? msg('loading') : msg('tasCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
