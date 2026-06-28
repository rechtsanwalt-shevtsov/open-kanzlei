import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, apiHeaders } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nContext.js';
import { WORK_STATUSES, workStatusLabel } from '../../lib/work-status.js';
import { listModelAttributes, type AttributeDefinition } from '../../lib/attribute-api.js';
import { labelFromTranslations } from '../../lib/model-label.js';
import { ReferenceFieldInput } from '../../components/admin/ReferenceFieldInput.js';
import type { ActorOption } from '../../hooks/useActorsList.js';
import type { ModelOption } from '../../hooks/useModelOptions.js';

interface CreateCaseDialogProps {
  open: boolean;
  models: ModelOption[];
  actors: ActorOption[];
  onClose: () => void;
  onCreated: () => void;
}

function fieldLabel(def: AttributeDefinition, locale: string): string {
  return (
    def.display_name ?? labelFromTranslations(def.translations, def.key, locale as 'de' | 'en')
  );
}

function parseFieldValue(def: AttributeDefinition, raw: string): unknown {
  if (!raw.trim() && def.data_type !== 'boolean') return null;
  switch (def.data_type) {
    case 'number':
    case 'money':
      return raw === '' ? null : Number(raw);
    case 'boolean':
      return raw === 'true';
    case 'multi_select':
      return raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    default:
      return raw.trim() || null;
  }
}

function defaultFieldValue(def: AttributeDefinition): string {
  const v = def.default_value;
  if (v === null || v === undefined) return '';
  if (def.data_type === 'boolean') return v === true ? 'true' : 'false';
  if (def.data_type === 'multi_select' && Array.isArray(v)) return v.join(', ');
  return String(v);
}

export function CreateCaseDialog({
  open,
  models,
  actors,
  onClose,
  onCreated,
}: CreateCaseDialogProps) {
  const { locale, msg } = useI18n();
  const [caseModelId, setCaseModelId] = useState('');
  const [status, setStatus] = useState('not_started');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [instanceFields, setInstanceFields] = useState<AttributeDefinition[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCaseModelId(models[0]?.id ?? '');
    setStatus('not_started');
    setAssigneeIds([]);
    setInstanceFields([]);
    setFieldValues({});
    setError(null);
  }, [open, models]);

  useEffect(() => {
    if (!open || !caseModelId) {
      setInstanceFields([]);
      setFieldValues({});
      return;
    }
    let cancelled = false;
    setFieldsLoading(true);
    void listModelAttributes(caseModelId, locale, 'instance').then((res) => {
      if (cancelled) return;
      setFieldsLoading(false);
      if (res.error) {
        setInstanceFields([]);
        return;
      }
      const defs = (res.data?.items ?? []) as AttributeDefinition[];
      setInstanceFields(defs);
      const initial: Record<string, string> = {};
      for (const def of defs) {
        initial[def.key] = defaultFieldValue(def);
      }
      setFieldValues(initial);
    });
    return () => {
      cancelled = true;
    };
  }, [open, caseModelId, locale]);

  const sortedFields = useMemo(
    () => [...instanceFields].sort((a, b) => fieldLabel(a, locale).localeCompare(fieldLabel(b, locale))),
    [instanceFields, locale],
  );

  if (!open) return null;

  function toggleAssignee(userId: string) {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

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

    if (def.data_type === 'reference') {
      return (
        <label key={def.id}>
          {label}
          {required ? ' *' : ''}
          <ReferenceFieldInput
            attribute={def}
            value={value}
            onChange={(next) => setField(def.key, next)}
          />
        </label>
      );
    }

    if (def.data_type === 'single_select') {
      return (
        <label key={def.id}>
          {label}
          {required ? ' *' : ''}
          <select value={value} onChange={(e) => setField(def.key, e.target.value)}>
            <option value="">—</option>
            {(def.select_options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (def.data_type === 'multi_select') {
      return (
        <label key={def.id}>
          {label}
          {required ? ' *' : ''}
          <textarea
            rows={2}
            value={value}
            placeholder={msg('fieldsSelectOptionsHint')}
            onChange={(e) => setField(def.key, e.target.value)}
          />
        </label>
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
    if (!caseModelId) {
      setError(msg('workModelRequired'));
      return;
    }

    const attributes: Record<string, unknown> = {};
    for (const def of instanceFields) {
      const raw = fieldValues[def.key] ?? '';
      const parsed = parseFieldValue(def, raw);
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

    const res = await api.POST('/v1/cases', {
      headers: apiHeaders(locale),
      body: {
        case_model_id: caseModelId,
        status,
        attributes: Object.keys(attributes).length ? attributes : undefined,
        assignee_actor_ids: assigneeIds.length ? assigneeIds : undefined,
      },
    });
    setSubmitting(false);
    if (res.error) {
      const err = res.error as { message?: string; code?: string };
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

          {fieldsLoading && <p>{msg('loading')}</p>}

          {!fieldsLoading && sortedFields.length === 0 && (
            <p className="admin-table-muted">{msg('workNoCaseFieldsDefined')}</p>
          )}

          {!fieldsLoading && sortedFields.map((def) => renderFieldInput(def))}

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

          {actors.length > 0 && (
            <fieldset className="work-assignee-picker">
              <legend>{msg('workColAssignees')}</legend>
              <ul>
                {actors.map((a) => (
                  <li key={a.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(a.id)}
                        onChange={() => toggleAssignee(a.id)}
                      />
                      {a.label}
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
            <button type="submit" className="button-primary" disabled={submitting || fieldsLoading}>
              {submitting ? msg('loading') : msg('workCreateCase')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
