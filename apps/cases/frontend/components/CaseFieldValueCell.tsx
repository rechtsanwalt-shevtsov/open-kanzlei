import { useEffect, useState } from 'react';
import { api, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { isSelectDataType } from '@shell/lib/data-type-label.js';
import type { AttributeDefinition } from '@shell/lib/attribute-api.js';
import type { Locale } from '@shell/i18n/locale.js';
import { formatFieldValue } from '../lib/case-display.js';
import { parseFieldValue } from '../lib/field-value.js';
import { FieldSelectInput } from '@shell/components/admin/FieldSelectInput.js';
import { ReferenceFieldInput } from '@shell/components/admin/ReferenceFieldInput.js';

interface CaseFieldValueCellProps {
  caseId: string;
  fieldKey: string;
  definition: AttributeDefinition;
  value: string | number | boolean | string[] | null | undefined;
  locale: Locale;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onUpdated: () => void;
}

export function CaseFieldValueCell({
  caseId,
  fieldKey,
  definition,
  value,
  locale,
  saving,
  onSavingChange,
  onUpdated,
}: CaseFieldValueCellProps) {
  const { msg } = useI18n();
  const [draft, setDraft] = useState(formatFieldValue(definition.data_type, value));
  const [multiDraft, setMultiDraft] = useState<string[]>(
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [],
  );
  const options = definition.select_options ?? [];

  useEffect(() => {
    setDraft(formatFieldValue(definition.data_type, value));
    setMultiDraft(
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [],
    );
  }, [definition.data_type, value]);

  async function persist(next: unknown) {
    onSavingChange(true);
    const res = await api.PATCH('/v1/cases/{id}', {
      headers: apiJsonHeaders(locale),
      params: { path: { id: caseId } },
      body: { attributes: { [fieldKey]: next } },
    });
    onSavingChange(false);
    if (!res.error && res.response.ok) {
      onUpdated();
    }
  }

  if (definition.data_type === 'boolean') {
    return (
      <select
        className="admin-table-inline-input"
        value={draft}
        disabled={saving}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          void persist(v === '' ? null : v === 'true');
        }}
      >
        <option value="">—</option>
        <option value="true">{msg('yes')}</option>
        <option value="false">{msg('no')}</option>
      </select>
    );
  }

  if (definition.data_type === 'reference') {
    return (
      <ReferenceFieldInput
        attribute={definition}
        value={typeof value === 'string' ? value : ''}
        disabled={saving}
        onChange={(next) => void persist(next === '' ? null : next)}
      />
    );
  }

  if (definition.data_type === 'single_select' || definition.data_type === 'multi_select') {
    return (
      <FieldSelectInput
        dataType={definition.data_type}
        options={options}
        optionLabels={definition.select_option_labels}
        value={definition.data_type === 'single_select' ? draft : multiDraft}
        disabled={saving}
        compact
        className="admin-table-inline-input"
        onChange={(next) => {
          if (definition.data_type === 'single_select') {
            const v = typeof next === 'string' ? next : '';
            setDraft(v);
            void persist(next);
            return;
          }
          const items = Array.isArray(next) ? next : [];
          setMultiDraft(items);
          const current = Array.isArray(value) ? value : [];
          if (JSON.stringify(items) === JSON.stringify(current)) return;
          void persist(items.length ? items : null);
        }}
      />
    );
  }

  const inputType =
    definition.data_type === 'number' || definition.data_type === 'money'
      ? 'number'
      : definition.data_type === 'date'
        ? 'date'
        : 'text';

  return (
    <input
      type={inputType}
      className="admin-table-inline-input"
      value={draft}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (isSelectDataType(definition.data_type)) return;
        const parsed = parseFieldValue(definition, draft);
        const current = value;
        if (JSON.stringify(parsed) === JSON.stringify(current ?? null)) return;
        void persist(parsed);
      }}
    />
  );
}
