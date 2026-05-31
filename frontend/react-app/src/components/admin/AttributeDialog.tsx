import { FormEvent, useEffect, useState } from 'react';
import type { AttributeDefinition, DataType } from '../../lib/attribute-api.js';
import {
  ENCRYPTION_MODES,
  encryptionModeMessageKey,
  type EncryptionMode,
} from '../../lib/encryption-mode-label.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { Locale } from '../../i18n/locale.js';
import { dataTypeMessageKey } from '../../lib/data-type-label.js';
import { labelFromTranslations } from '../../lib/model-label.js';

const DATA_TYPES: DataType[] = ['text', 'number', 'boolean', 'date'];

interface AttributeDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  attribute?: AttributeDefinition;
  defaultEncryptionMode?: EncryptionMode;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    locale: Locale;
    data_type: DataType;
    encryption_mode: EncryptionMode;
  }) => Promise<string | null>;
}

export function AttributeDialog({
  open,
  mode,
  attribute,
  defaultEncryptionMode = 'zero_knowledge',
  onClose,
  onSubmit,
}: AttributeDialogProps) {
  const { locale, msg } = useI18n();
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState<DataType>('text');
  const [encryptionMode, setEncryptionMode] = useState<EncryptionMode>(defaultEncryptionMode);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    } else {
      setName('');
      setDataType('text');
      setEncryptionMode(defaultEncryptionMode);
    }
    setError(null);
  }, [open, mode, attribute, locale, defaultEncryptionMode]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(msg('cmdModelNameRequired'));
      return;
    }

    setSubmitting(true);
    const submitError = await onSubmit({
      name: name.trim(),
      locale,
      data_type: dataType,
      encryption_mode: encryptionMode,
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
