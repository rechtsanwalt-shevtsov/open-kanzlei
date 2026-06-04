import { useEffect, useState } from 'react';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { isSelectDataType } from '@shell/lib/data-type-label.js';
import type { AttributeDefinition } from '@shell/lib/attribute-api.js';
import { updateAttributeDefinition } from '@shell/lib/attribute-api.js';
import type { Locale } from '@shell/i18n/locale.js';

function formatDefault(attr: AttributeDefinition): string {
  const v = attr.default_value;
  if (v === null || v === undefined) return '';
  if (attr.data_type === 'multi_select' && Array.isArray(v)) return v.join(', ');
  if (attr.data_type === 'boolean') return v === true ? 'true' : 'false';
  return String(v);
}

interface InstanceDefaultValueCellProps {
  attribute: AttributeDefinition;
  locale: Locale;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onUpdated: () => void;
}

export function InstanceDefaultValueCell({
  attribute,
  locale,
  saving,
  onSavingChange,
  onUpdated,
}: InstanceDefaultValueCellProps) {
  const { msg } = useI18n();
  const [draft, setDraft] = useState(formatDefault(attribute));
  const options = attribute.select_options ?? [];

  useEffect(() => {
    setDraft(formatDefault(attribute));
  }, [attribute]);

  async function persist(next: unknown) {
    onSavingChange(true);
    const res = await updateAttributeDefinition(attribute.id, locale, {
      default_value: next,
    });
    onSavingChange(false);
    if (!res.error && res.response.ok) {
      onUpdated();
    }
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
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (attribute.data_type === 'multi_select') {
    return (
      <input
        type="text"
        className="admin-table-inline-input"
        value={draft}
        disabled={saving}
        placeholder={msg('fieldsSelectOptionsHint')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const items = draft
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean);
          const current = formatDefault(attribute);
          if (draft.trim() === current.trim()) return;
          void persist(items.length ? items : null);
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
