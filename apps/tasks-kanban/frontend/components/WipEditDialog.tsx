import { FormEvent, useState } from 'react';
import { useI18n } from '@shell/i18n/I18nContext.js';

interface WipEditDialogProps {
  columnKey: string;
  initialLimit: number | null;
  onClose: () => void;
  onSave: (limit: number | null) => Promise<void>;
}

export function WipEditDialog({
  columnKey,
  initialLimit,
  onClose,
  onSave,
}: WipEditDialogProps) {
  const { msg } = useI18n();
  const [value, setValue] = useState(initialLimit === null ? '' : String(initialLimit));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const trimmed = value.trim();
    const limit = trimmed === '' ? null : Number(trimmed);
    if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
      setError(msg('tkbWipInvalid'));
      setSubmitting(false);
      return;
    }
    try {
      await onSave(limit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : msg('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wip-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="wip-edit-title">{msg('tkbEditWipTitle')}</h2>
        <p className="admin-table-muted">{columnKey}</p>
        <form className="admin-dialog-form" onSubmit={handleSubmit}>
          <label>
            {msg('tkbWipLimitLabel')}
            <input
              type="number"
              min={0}
              value={value}
              placeholder={msg('tkbWipLimitPlaceholder')}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="admin-dialog-actions">
            <button type="button" className="button-outline" onClick={onClose}>
              {msg('cancel')}
            </button>
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? msg('loading') : msg('submitSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
