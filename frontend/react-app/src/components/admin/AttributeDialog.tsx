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
import {
  buildFixedSelectOptionsLabelPayload,
  buildSelectOptionsPayload,
  buildSelectOptionsPayloadWithLockedKeys,
  createEmptySelectOptionRow,
  normalizeSelectOptionRows,
  toSelectOptionRows,
  type SelectOptionRow,
} from '../../lib/select-options.js';
import { FieldSelectInput } from './FieldSelectInput.js';
import { SelectOptionsEditor } from './SelectOptionsEditor.js';

export type AttributeDialogPayload = {
  name: string;
  locale: Locale;
  definition_scope: DefinitionScope;
  data_type: DataType;
  encryption_mode: EncryptionMode;
  is_required?: boolean;
  select_options?: string[];
  select_option_translations?: Record<string, Record<string, string>>;
  default_value?: unknown;
};

export type AttributeDialogLockFields = {
  name?: boolean;
  dataType?: boolean;
  isRequired?: boolean;
  encryption?: boolean;
  selectOptions?: boolean;
  defaultValue?: boolean;
};

interface AttributeDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  definitionScope: DefinitionScope;
  attribute?: AttributeDefinition;
  defaultEncryptionMode?: EncryptionMode;
  extendedFields?: boolean;
  lockFields?: AttributeDialogLockFields;
  onClose: () => void;
  onSubmit: (payload: AttributeDialogPayload) => Promise<string | null>;
}

function formatDefaultForInput(dataType: DataType, value: unknown): string {
  if (value === null || value === undefined) return '';
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
  lockFields,
  onClose,
  onSubmit,
}: AttributeDialogProps) {
  const { locale, msg } = useI18n();
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState<DataType>('text');
  const [encryptionMode, setEncryptionMode] = useState<EncryptionMode>(defaultEncryptionMode);
  const [isRequired, setIsRequired] = useState(false);
  const [optionRows, setOptionRows] = useState<SelectOptionRow[]>([]);
  const [defaultText, setDefaultText] = useState('');
  const [defaultMultiKeys, setDefaultMultiKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSingleSelect = dataType === 'single_select';
  const isMultiSelect = dataType === 'multi_select';
  const showSelectOptions = isSelectDataType(dataType);
  const showEncryption = definitionScope === 'instance';
  const lockedOptionKeys = attribute?.locked_select_options ?? [];

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
      if (isSelectDataType(attribute.data_type)) {
        const rows = toSelectOptionRows(attribute, locale);
        setOptionRows(rows.length > 0 ? rows : [createEmptySelectOptionRow()]);
      } else {
        setOptionRows([]);
      }
      setDefaultText(formatDefaultForInput(attribute.data_type, attribute.default_value));
      setDefaultMultiKeys(
        attribute.data_type === 'multi_select' && Array.isArray(attribute.default_value)
          ? attribute.default_value
          : [],
      );
    } else {
      setName('');
      setDataType('text');
      setEncryptionMode(defaultEncryptionMode);
      setIsRequired(false);
      setOptionRows([]);
      setDefaultText('');
      setDefaultMultiKeys([]);
    }
    setError(null);
  }, [open, mode, attribute, locale, defaultEncryptionMode]);

  useEffect(() => {
    if (!open || !showSelectOptions) return;
    if (optionRows.length === 0) {
      setOptionRows([createEmptySelectOptionRow()]);
    }
  }, [open, showSelectOptions, optionRows.length]);

  const normalizedSelectOptions = useMemo(
    () => normalizeSelectOptionRows(optionRows),
    [optionRows],
  );

  const optionLabels = useMemo(
    () =>
      Object.fromEntries(
        normalizedSelectOptions.map((opt) => [opt.key, opt.label.trim() || opt.key]),
      ),
    [normalizedSelectOptions],
  );

  const defaultInputType = useMemo(() => {
    if (dataType === 'boolean') return 'select';
    if (dataType === 'date') return 'date';
    if (dataType === 'number' || dataType === 'money') return 'number';
    if (dataType === 'single_select') return 'select';
    if (dataType === 'multi_select') return 'multi';
    return 'text';
  }, [dataType]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(msg('cmdModelNameRequired'));
      return;
    }

    let selectOptions: string[] | undefined;
    let selectOptionTranslations: Record<string, Record<string, string>> | undefined;

    if (extendedFields && showSelectOptions) {
      if (lockFields?.selectOptions && attribute) {
        const fixedKeys = attribute.select_options ?? [];
        const payload = buildFixedSelectOptionsLabelPayload(
          optionRows,
          locale,
          fixedKeys,
          attribute,
        );
        if (!payload.select_options.every((key) => fixedKeys.includes(key))) {
          setError(msg('errorGeneric'));
          return;
        }
        selectOptions = payload.select_options;
        selectOptionTranslations = payload.select_option_translations;
      } else if (lockedOptionKeys.length > 0 && attribute) {
        const payload = buildSelectOptionsPayloadWithLockedKeys(
          optionRows,
          locale,
          lockedOptionKeys,
          attribute,
        );
        selectOptions = payload.select_options;
        selectOptionTranslations = payload.select_option_translations;
      } else {
        const payload = buildSelectOptionsPayload(optionRows, locale, attribute);
        if (payload.select_options.length === 0) {
          setError(msg('cmdStatusOptionLabelRequired'));
          return;
        }
        selectOptions = payload.select_options;
        selectOptionTranslations = payload.select_option_translations;
      }
    }

    let defaultValue: unknown = null;
    if (extendedFields && !lockFields?.defaultValue) {
      if (isSingleSelect && defaultText.trim()) {
        defaultValue = defaultText.trim();
        if (!selectOptions?.includes(defaultValue as string)) {
          setError(msg('errorGeneric'));
          return;
        }
      } else if (isMultiSelect) {
        defaultValue = defaultMultiKeys.length > 0 ? defaultMultiKeys : null;
        if (defaultMultiKeys.some((key) => !selectOptions?.includes(key))) {
          setError(msg('errorGeneric'));
          return;
        }
      } else if (defaultText.trim()) {
        defaultValue = parseDefaultFromInput(dataType, defaultText);
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
            select_option_translations: showSelectOptions ? selectOptionTranslations : undefined,
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
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus={!lockFields?.name}
              disabled={lockFields?.name}
            />
          </label>

          <label>
            {msg('modelsColType')}
            <select
              value={dataType}
              disabled={lockFields?.dataType}
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
                disabled={lockFields?.isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
              />
              {msg('fieldsRequiredLabel')}
            </label>
          )}

          {extendedFields && showSelectOptions && (
            <fieldset className="select-options-fieldset">
              <legend>{msg('fieldsSelectOptions')}</legend>
              <SelectOptionsEditor
                rows={optionRows}
                onChange={setOptionRows}
                labelsOnly={lockFields?.selectOptions}
                lockedOptionKeys={lockFields?.selectOptions ? undefined : lockedOptionKeys}
              />
            </fieldset>
          )}

          {extendedFields && !lockFields?.defaultValue && (
            <div className="attribute-default-value">
              <span className="attribute-default-value-label">
                {definitionScope === 'model' ? msg('cmdColValue') : msg('fieldsDefaultValue')}
              </span>
              {defaultInputType === 'select' && dataType === 'boolean' ? (
                <select
                  value={defaultText}
                  onChange={(e) => setDefaultText(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="true">{msg('yes')}</option>
                  <option value="false">{msg('no')}</option>
                </select>
              ) : defaultInputType === 'select' && isSingleSelect ? (
                <select
                  value={defaultText}
                  onChange={(e) => setDefaultText(e.target.value)}
                >
                  <option value="">—</option>
                  {normalizedSelectOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label.trim() || opt.key}
                    </option>
                  ))}
                </select>
              ) : defaultInputType === 'multi' && isMultiSelect ? (
                <FieldSelectInput
                  dataType="multi_select"
                  options={normalizedSelectOptions.map((opt) => opt.key)}
                  optionLabels={optionLabels}
                  value={defaultMultiKeys}
                  onChange={(value) =>
                    setDefaultMultiKeys(Array.isArray(value) ? value : [])
                  }
                />
              ) : (
                <input
                  type={
                    defaultInputType === 'number'
                      ? 'number'
                      : defaultInputType === 'date'
                        ? 'date'
                        : 'text'
                  }
                  value={defaultText}
                  onChange={(e) => setDefaultText(e.target.value)}
                />
              )}
            </div>
          )}

          {showEncryption && (
            <label>
              {msg('attributesEncryption')}
              <select
                value={encryptionMode}
                disabled={lockFields?.encryption}
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
