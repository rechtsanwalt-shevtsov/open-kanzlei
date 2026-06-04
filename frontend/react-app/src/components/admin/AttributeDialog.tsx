import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AttributeDefinition, DataType } from '../../lib/attribute-api.js';
import {
  DATA_TYPES,
  dataTypeMessageKey,
  isSelectDataType,
} from '../../lib/data-type-label.js';
import {
  ENCRYPTION_MODES,
  encryptionModeMessageKey,
  type EncryptionMode,
} from '../../lib/encryption-mode-label.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { Locale } from '../../i18n/locale.js';
import { labelFromTranslations } from '../../lib/model-label.js';
import type { DefinitionScope } from '../../lib/attribute-api.js';

export type AttributeDialogPayload = {
  name: string;
  locale: Locale;
  definition_scope: DefinitionScope;
  data_type: DataType;
  encryption_mode: EncryptionMode;
  is_required?: boolean;
  select_options?: string[];
  default_value?: unknown;
};

interface AttributeDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  definitionScope: DefinitionScope;
  attribute?: AttributeDefinition;
  defaultEncryptionMode?: EncryptionMode;
  extendedFields?: boolean;
  onClose: () => void;
  onSubmit: (payload: AttributeDialogPayload) => Promise<string | null>;
}

function parseOptionsText(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

function formatOptionsText(options: string[]): string {
  return options.join('\n');
}

function formatDefaultForInput(
  dataType: DataType,
  value: unknown,
): string {
  if (value === null || value === undefined) return '';
  if (dataType === 'multi_select' && Array.isArray(value)) return value.join('\n');
  if (dataType === 'boolean') return value === true ? 'true' : 'false';
  return String(value);
}

function parseDefaultFromInput(dataType: DataType, raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  switch (dataType) {
    case 'number':
    case 'money':
      return Number(trimmed);
    case 'boolean':
      return trimmed === 'true';
    case 'multi_select':
      return parseOptionsText(trimmed);
    default:
      return trimmed;
  }
}

export function AttributeDialog({
  open,
  mode,
  definitionScope,
  attribute,
  defaultEncryptionMode = 'zero_knowledge',
  extendedFields = false,
  onClose,
  onSubmit,
}: AttributeDialogProps) {
  const { locale, msg } = useI18n();
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState<DataType>('text');
  const [encryptionMode, setEncryptionMode] = useState<EncryptionMode>(defaultEncryptionMode);
  const [isRequired, setIsRequired] = useState(false);
  const [optionsText, setOptionsText] = useState('');
  const [defaultText, setDefaultText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showSelectOptions = isSelectDataType(dataType);
  const showEncryption = definitionScope === 'instance';

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && attribute) {
      setName(
        attribute.translations?.[locale] ??
          attribute.display_name ??
          labelFromTranslations(attribute.translations, attribute.key, locale),
      );
      setDataType(attribute.data_type);
      setEncryptionMode(attribute.encryption_mode);
      setIsRequired(Boolean(attribute.is_required));
      setOptionsText(formatOptionsText(attribute.select_options ?? []));
      setDefaultText(formatDefaultForInput(attribute.data_type, attribute.default_value));
    } else {
      setName('');
      setDataType('text');
      setEncryptionMode(defaultEncryptionMode);
      setIsRequired(false);
      setOptionsText('');
      setDefaultText('');
    }
    setError(null);
  }, [open, mode, attribute, locale, defaultEncryptionMode]);

  const defaultInputType = useMemo(() => {
    if (dataType === 'boolean') return 'select';
    if (dataType === 'date') return 'date';
    if (dataType === 'number' || dataType === 'money') return 'number';
    if (dataType === 'single_select') return 'select';
    if (dataType === 'multi_select') return 'textarea';
    return 'text';
  }, [dataType]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(msg('cmdModelNameRequired'));
      return;
    }

    const selectOptions = showSelectOptions ? parseOptionsText(optionsText) : [];
    if (showSelectOptions && selectOptions.length === 0) {
      setError(msg('errorGeneric'));
      return;
    }

    let defaultValue: unknown = null;
    if (extendedFields && defaultText.trim()) {
      defaultValue = parseDefaultFromInput(dataType, defaultText);
      if (dataType === 'single_select' && typeof defaultValue === 'string') {
        if (!selectOptions.includes(defaultValue)) {
          setError(msg('errorGeneric'));
          return;
        }
      }
    }

    setSubmitting(true);
    const submitError = await onSubmit({
      name: name.trim(),
      locale,
      definition_scope: definitionScope,
      data_type: dataType,
      encryption_mode: showEncryption ? encryptionMode : 'server_readable',
      ...(extendedFields
        ? {
            is_required: isRequired,
            select_options: showSelectOptions ? selectOptions : undefined,
            default_value: defaultValue,
          }
        : {}),
    });
    setSubmitting(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    onClose();
  }

  const title =
    mode === 'create' ? msg('attributesAddTitle') : msg('attributesEditTitle');

  if (!open) return null;

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attribute-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="attribute-dialog-title">{title}</h2>
        <form onSubmit={handleSubmit} className="form">
          <label>
            {msg('cmdModelName')}
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>

          <label>
            {msg('modelsColType')}
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value as DataType)}
            >
              {DATA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {msg(dataTypeMessageKey(t))}
                </option>
              ))}
            </select>
          </label>

          {extendedFields && (
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
              />
              {msg('fieldsRequiredLabel')}
            </label>
          )}

          {extendedFields && showSelectOptions && (
            <label>
              {msg('fieldsSelectOptions')}
              <textarea
                rows={4}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder={msg('fieldsSelectOptionsHint')}
              />
            </label>
          )}

          {extendedFields && (
            <label>
              {definitionScope === 'model' ? msg('cmdColValue') : msg('fieldsDefaultValue')}
              {defaultInputType === 'select' && dataType === 'boolean' ? (
                <select
                  value={defaultText}
                  onChange={(e) => setDefaultText(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="true">{msg('yes')}</option>
                  <option value="false">{msg('no')}</option>
                </select>
              ) : defaultInputType === 'select' && dataType === 'single_select' ? (
                <select
                  value={defaultText}
                  onChange={(e) => setDefaultText(e.target.value)}
                >
                  <option value="">—</option>
                  {parseOptionsText(optionsText).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : defaultInputType === 'textarea' ? (
                <textarea
                  rows={3}
                  value={defaultText}
                  onChange={(e) => setDefaultText(e.target.value)}
                  placeholder={msg('fieldsSelectOptionsHint')}
                />
              ) : (
                <input
                  type={defaultInputType === 'number' ? 'number' : defaultInputType === 'date' ? 'date' : 'text'}
                  value={defaultText}
                  onChange={(e) => setDefaultText(e.target.value)}
                />
              )}
            </label>
          )}

          {showEncryption && (
            <label>
              {msg('attributesEncryption')}
              <select
                value={encryptionMode}
                onChange={(e) => setEncryptionMode(e.target.value as EncryptionMode)}
              >
                {ENCRYPTION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {msg(encryptionModeMessageKey(m))}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="admin-dialog-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              {msg('cancel')}
            </button>
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? msg('loading') : mode === 'create' ? msg('attributesAdd') : msg('submitSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
