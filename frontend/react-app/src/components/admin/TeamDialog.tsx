import { FormEvent, useEffect, useState } from 'react';
import { api, apiHeaders } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { Team } from '../../hooks/useTeams.js';

interface TeamDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  team?: Team;
  onClose: () => void;
  onSaved: () => void;
}

export function TeamDialog({ open, mode, team, onClose, onSaved }: TeamDialogProps) {
  const { locale, msg } = useI18n();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(mode === 'edit' && team ? team.name : '');
    setError(null);
  }, [open, mode, team]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(msg('teamsNameRequired'));
      return;
    }

    setSubmitting(true);

    if (mode === 'create') {
      const res = await api.POST('/v1/groups', {
        headers: apiHeaders(locale),
        body: { name: name.trim() },
      });
      setSubmitting(false);
      if (res.error) {
        const err = res.error as { message?: string };
        setError(err?.message ?? msg('errorGeneric'));
        return;
      }
    } else if (team) {
      const res = await api.PATCH('/v1/groups/{id}', {
        headers: apiHeaders(locale),
        params: { path: { id: team.id } },
        body: { name: name.trim() },
      });
      setSubmitting(false);
      if (res.error) {
        const err = res.error as { message?: string };
        setError(err?.message ?? msg('errorGeneric'));
        return;
      }
    }

    onSaved();
    onClose();
  }

  const title = mode === 'create' ? msg('teamsCreateTitle') : msg('teamsEditTitle');

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="team-dialog-title">{title}</h2>
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
              {submitting ? msg('loading') : mode === 'create' ? msg('teamsCreate') : msg('submitSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
