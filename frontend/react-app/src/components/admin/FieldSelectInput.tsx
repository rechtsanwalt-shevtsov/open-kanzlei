import { useI18n } from '../../i18n/I18nContext.js';

interface FieldSelectInputProps {
  dataType: 'single_select' | 'multi_select';
  options: string[];
  optionLabels?: Record<string, string>;
  value: string | string[];
  onChange: (value: string | string[] | null) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

function labelFor(option: string, optionLabels?: Record<string, string>): string {
  return optionLabels?.[option] ?? option;
}

export function FieldSelectInput({
  dataType,
  options,
  optionLabels,
  value,
  onChange,
  disabled = false,
  className,
  compact = false,
}: FieldSelectInputProps) {
  const { msg } = useI18n();

  if (dataType === 'single_select') {
    const selected = typeof value === 'string' ? value : '';
    return (
      <select
        className={className ?? (compact ? 'admin-table-inline-input' : undefined)}
        value={selected}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : v);
        }}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labelFor(opt, optionLabels)}
          </option>
        ))}
      </select>
    );
  }

  const selected = new Set(Array.isArray(value) ? value : []);
  const listClass = compact
    ? 'cas-field-option-list cas-field-option-list--compact'
    : 'cas-field-option-list';

  return (
    <ul className={listClass} role="listbox" aria-multiselectable="true">
      {options.length === 0 ? (
        <li className="admin-table-muted">{msg('casSelectOptionsEmpty')}</li>
      ) : (
        options.map((opt) => (
          <li key={opt}>
            <label className="cas-field-option-label">
              <input
                type="checkbox"
                checked={selected.has(opt)}
                disabled={disabled}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(opt);
                  else next.delete(opt);
                  onChange(next.size > 0 ? [...next] : null);
                }}
              />
              <span>{labelFor(opt, optionLabels)}</span>
            </label>
          </li>
        ))
      )}
    </ul>
  );
}
