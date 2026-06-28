import { useEffect, useState } from 'react';
import { FieldSelectInput } from '@shell/components/admin/FieldSelectInput.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { isSelectDataType } from '@shell/lib/data-type-label.js';
import type { AttributeDefinition } from '@shell/lib/attribute-api.js';
import { updateAttributeDefinition } from '@shell/lib/attribute-api.js';
import { selectOptionLabel } from '@shell/lib/select-option-labels.js';
import { ReferenceFieldInput } from '@shell/components/admin/ReferenceFieldInput.js';
import type { Locale } from '@shell/i18n/locale.js';

function formatDefault(attr: AttributeDefinition): string {
  const v = attr.default_value;
  if (v === null || v === undefined) return '';
  if (attr.data_type === 'boolean') return v === true ? 'true' : 'false';
  return String(v);
}

function defaultMultiKeys(attr: AttributeDefinition): string[] {
  return attr.data_type === 'multi_select' && Array.isArray(attr.default_value)
    ? attr.default_value
    : [];
}

interface InstanceDefaultValueCellProps {
  attribute: AttributeDefinition;
  locale: Locale;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onUpdated: () => void;
  readOnly?: boolean;
}

export function InstanceDefaultValueCell({
  attribute,
  locale,
  saving,
  onSavingChange,
  onUpdated,
  readOnly = false,
}: InstanceDefaultValueCellProps) {
  const { msg } = useI18n();
  const [draft, setDraft] = useState(formatDefault(attribute));
  const [multiDraft, setMultiDraft] = useState<string[]>(() => defaultMultiKeys(attribute));
  const options = attribute.select_options ?? [];

  useEffect(() => {
    setDraft(formatDefault(attribute));
    setMultiDraft(defaultMultiKeys(attribute));
  }, [attribute]);

  async function persist(next: unknown) {
    if (readOnly) return;
    onSavingChange(true);
    const res = await updateAttributeDefinition(attribute.id, locale, {
      default_value: next,
    });
    onSavingChange(false);
    if (!res.error && res.response.ok) {
      onUpdated();
    }
  }

  if (readOnly) {
    if (attribute.data_type === 'single_select' && typeof attribute.default_value === 'string') {
      return <span>{selectOptionLabel(attribute.default_value, attribute)}</span>;
    }
    if (attribute.data_type === 'reference' && typeof attribute.default_value === 'string') {
      return (
        <ReferenceFieldInput
          attribute={attribute}
          value={attribute.default_value}
          onChange={() => {}}
          readOnly
        />
      );
    }
    const text = formatDefault(attribute);
    return <span>{text || '—'}</span>;
  }

  if (attribute.data_type === 'boolean') {
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

  if (attribute.data_type === 'reference') {
    return (
      <ReferenceFieldInput
        attribute={attribute}
        value={draft}
        disabled={saving}
        onChange={(next) => {
          setDraft(next);
          void persist(next === '' ? null : next);
        }}
      />
    );
  }

  if (attribute.data_type === 'single_select') {
    return (
      <select
        className="admin-table-inline-input"
        value={draft}
        disabled={saving}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          void persist(v === '' ? null : v);
        }}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {selectOptionLabel(opt, attribute)}
          </option>
        ))}
      </select>
    );
  }

  if (attribute.data_type === 'multi_select') {
    return (
      <FieldSelectInput
        dataType="multi_select"
        options={options}
        optionLabels={attribute.select_option_labels}
        value={multiDraft}
        disabled={saving}
        compact
        onChange={(value) => {
          const next = Array.isArray(value) ? value : [];
          setMultiDraft(next);
          void persist(next.length > 0 ? next : null);
        }}
      />
    );
  }

  const inputType =
    attribute.data_type === 'number' || attribute.data_type === 'money'
      ? 'number'
      : attribute.data_type === 'date'
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
        if (isSelectDataType(attribute.data_type)) return;
        let parsed: unknown = draft.trim() || null;
        if (parsed !== null) {
          if (attribute.data_type === 'number' || attribute.data_type === 'money') {
            parsed = Number(draft);
            if (Number.isNaN(parsed)) return;
          }
        }
        const current = attribute.default_value;
        if (JSON.stringify(parsed) === JSON.stringify(current)) return;
        void persist(parsed);
      }}
    />
  );
}
