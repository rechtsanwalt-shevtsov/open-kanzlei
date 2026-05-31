import { FormEvent, useEffect, useState } from 'react';
import { api, apiHeaders } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nContext.js';

interface CreateTeamDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTeamDialog({ open, onClose, onCreated }: CreateTeamDialogProps) {
  const { locale, msg } = useI18n();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(null);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(msg('teamsNameRequired'));
      return;
    }

    setSubmitting(true);
    const res = await api.POST('/v1/teams', {
      headers: apiHeaders(locale),
      body: { name: name.trim() },
    });
    setSubmitting(false);

    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }

    onCreated();
    onClose();
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-team-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-team-title">{msg('teamsCreateTitle')}</h2>
        <form onSubmit={handleSubmit} className="form">
          <label>
            {msg('teamsColName')}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
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
              {submitting ? msg('loading') : msg('teamsCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
