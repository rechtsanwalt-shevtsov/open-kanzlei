import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, apiHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { listModelAttributes, type AttributeDefinition } from '@shell/lib/attribute-api.js';
import { findCaseStatusDefinition } from '@shell/lib/case-instance-status.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import type { components } from '@shell/api/schema.js';
import { FieldSelectInput } from '@shell/components/admin/FieldSelectInput.js';
import {
  defaultFieldValue,
  defaultMultiSelectValue,
  parseFieldValueFromState,
} from '../lib/field-value.js';

type CaseModel = components['schemas']['CaseModel'];

function fieldLabel(def: AttributeDefinition, locale: string): string {
  return (
    def.display_name ?? labelFromTranslations(def.translations, def.key, locale as 'de' | 'en')
  );
}

interface CreateCaseDialogProps {
  open: boolean;
  models: CaseModel[];
  onClose: () => void;
  onCreated: (caseId: string) => void;
}

export function CreateCaseDialog({ open, models, onClose, onCreated }: CreateCaseDialogProps) {
  const { locale, msg } = useI18n();
  const activeModels = useMemo(() => models.filter((m) => m.status === 'active'), [models]);
  const [caseModelId, setCaseModelId] = useState('');
  const [status, setStatus] = useState('');
  const [instanceFields, setInstanceFields] = useState<AttributeDefinition[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [multiFieldValues, setMultiFieldValues] = useState<Record<string, string[]>>({});
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCaseModelId(activeModels[0]?.id ?? '');
    setStatus('');
    setInstanceFields([]);
    setFieldValues({});
    setMultiFieldValues({});
    setError(null);
  }, [open, activeModels]);

  useEffect(() => {
    if (!open || !caseModelId) {
      setInstanceFields([]);
      setFieldValues({});
      setMultiFieldValues({});
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
      const statusDef = findCaseStatusDefinition(defs);
      const initialStatus =
        typeof statusDef?.default_value === 'string'
          ? statusDef.default_value
          : (statusDef?.select_options?.[0] ?? '');
      setStatus(initialStatus);
      const initial: Record<string, string> = {};
      const initialMulti: Record<string, string[]> = {};
      for (const def of defs) {
        if (def.key === 'status') continue;
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
  }, [open, caseModelId, locale]);

  const statusDefinition = useMemo(
    () => findCaseStatusDefinition(instanceFields),
    [instanceFields],
  );

  const sortedFields = useMemo(
    () =>
      [...instanceFields]
        .filter((def) => def.key !== 'status')
        .sort((a, b) => fieldLabel(a, locale).localeCompare(fieldLabel(b, locale))),
    [instanceFields, locale],
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
    if (!caseModelId) {
      setError(msg('casNoModels'));
      return;
    }

    const attributes: Record<string, unknown> = {};
    for (const def of instanceFields) {
      if (def.key === 'status') continue;
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

    const res = await api.POST('/v1/cases', {
      headers: apiHeaders(locale),
      body: {
        case_model_id: caseModelId,
        status,
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
        aria-labelledby="create-case-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-case-dialog-title">{msg('casCreate')}</h2>
        <form onSubmit={handleSubmit} className="form admin-dialog-form">
          {activeModels.length === 0 ? (
            <p className="form-error">{msg('casNoModels')}</p>
          ) : (
            <>
              <label>
                {msg('casColModel')}
                <select
                  value={caseModelId}
                  onChange={(e) => setCaseModelId(e.target.value)}
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

              {statusDefinition && (
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

              {fieldsLoading && <p className="status">{msg('loading')}</p>}
              {!fieldsLoading && sortedFields.length > 0 && (
                <fieldset className="cas-create-fields">
                  <legend>{msg('casFieldsSection')}</legend>
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
              disabled={submitting || activeModels.length === 0}
            >
              {submitting ? msg('loading') : msg('casCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
