import { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext.js';
import type { AttributeDefinition } from '../../lib/attribute-api.js';
import { useReferenceOptions } from '../../hooks/useReferenceOptions.js';

interface ReferenceFieldInputProps {
  attribute: {
    reference_target_type?: AttributeDefinition['reference_target_type'];
    reference_target_model_id?: AttributeDefinition['reference_target_model_id'];
  };
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  readOnly?: boolean;
}

export function ReferenceFieldInput({
  attribute,
  value,
  onChange,
  disabled = false,
  className = 'admin-table-inline-input',
  readOnly = false,
}: ReferenceFieldInputProps) {
  const { msg } = useI18n();
  const { options, loading } = useReferenceOptions(
    attribute.reference_target_type,
    attribute.reference_target_model_id,
  );

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    return options.find((option) => option.id === value)?.label ?? value.slice(0, 8);
  }, [options, value]);

  if (readOnly) {
    return <span>{selectedLabel || '—'}</span>;
  }

  return (
    <select
      className={className}
      value={value}
      disabled={disabled || loading || !attribute.reference_target_type}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {value && !options.some((option) => option.id === value) && (
        <option value={value}>{selectedLabel}</option>
      )}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
      {loading && <option disabled>{msg('loading')}</option>}
    </select>
  );
}
