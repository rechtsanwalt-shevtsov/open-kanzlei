import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, apiHeaders } from '../../api/client.js';
import type { components } from '../../api/schema.js';
import { useAuth } from '../../context/AuthContext.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { Team } from '../../hooks/useTeams.js';
import type { PlatformUser } from '../../hooks/usePlatformUsers.js';

const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]{0,62}$/;

interface PlatformUserDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  user?: PlatformUser;
  teams: Team[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

export function PlatformUserDialog({
  open,
  mode,
  user,
  teams,
  onClose,
  onSaved,
  onDeleted,
}: PlatformUserDialogProps) {
  const { user: currentUser } = useAuth();
  const { locale, msg } = useI18n();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const assignableTeams = useMemo(
    () => teams.filter((t) => t.key !== 'plattformuser'),
    [teams],
  );

  const regularTeamId = useMemo(
    () => assignableTeams.find((t) => t.key === 'regular')?.id ?? null,
    [assignableTeams],
  );

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && user) {
      setUsername(user.username);
      setEmail(user.email ?? '');
      setPassword('');
      setTeamIds(user.teams.map((t) => t.id));
    } else {
      setUsername('');
      setEmail('');
      setPassword('');
      setTeamIds(regularTeamId ? [regularTeamId] : []);
    }
    setError(null);
  }, [open, mode, user, regularTeamId]);

  function toggleTeam(teamId: string) {
    setTeamIds((prev) => {
      if (prev.includes(teamId)) {
        const next = prev.filter((id) => id !== teamId);
        return next.length > 0 ? next : prev;
      }
      return [...prev, teamId];
    });
  }

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (teamIds.length === 0) {
      setError(msg('usersTeamsRequired'));
      return;
    }

    if (mode === 'create') {
      const trimmed = username.trim();
      if (!USERNAME_PATTERN.test(trimmed)) {
        setError(msg('usersUsernameInvalid'));
        return;
      }
      if (password.length < 8) {
        setError(msg('usersPasswordShort'));
        return;
      }
    } else if (password && password.length < 8) {
      setError(msg('usersPasswordShort'));
      return;
    }

    setSubmitting(true);

    if (mode === 'create') {
      const res = await api.POST('/v1/platform-users', {
        headers: apiHeaders(locale),
        body: {
          username: username.trim(),
          email: email.trim() || null,
          password,
          team_ids: teamIds,
        },
      });
      setSubmitting(false);
      if (res.error) {
        const err = res.error as { message?: string };
        setError(err?.message ?? msg('errorGeneric'));
        return;
      }
    } else if (user) {
      const body: components['schemas']['UpdatePlatformUserRequest'] = {
        email: email.trim() || null,
        team_ids: teamIds,
      };
      if (password) {
        body.password = password;
      }
      const res = await api.PATCH('/v1/platform-users/{id}', {
        headers: apiHeaders(locale),
        params: { path: { id: user.id } },
        body,
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

  const title = mode === 'create' ? msg('pusrCreateTitle') : msg('pusrEditTitle');
  const canRevoke =
    mode === 'edit' && user && currentUser && user.id !== currentUser.id;

  async function handleRevokeLogin() {
    if (!user || !canRevoke) return;
    if (!window.confirm(msg('pusrRevokeConfirm').replace('{username}', user.username))) {
      return;
    }

    setError(null);
    setSubmitting(true);
    const res = await api.DELETE('/v1/platform-users/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id: user.id } },
    });
    setSubmitting(false);

    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }

    onDeleted?.();
    onClose();
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-user-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="platform-user-dialog-title">{title}</h2>
        <form onSubmit={handleSubmit} className="form">
          {mode === 'create' ? (
            <label>
              {msg('username')}
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </label>
          ) : (
            <p className="admin-dialog-readonly">
              {msg('username')}: <strong>{username}</strong>
            </p>
          )}

          <label>
            {msg('email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
            <span className="hint">{msg('usersEmailHint')}</span>
          </label>

          <label>
            {mode === 'create' ? msg('password') : msg('usersPasswordOptional')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={mode === 'create'}
              minLength={mode === 'create' ? 8 : undefined}
              autoComplete="new-password"
            />
          </label>

          <fieldset className="admin-fieldset">
            <legend>{msg('usersColTeams')}</legend>
            {assignableTeams.map((team) => (
              <label key={team.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={teamIds.includes(team.id)}
                  onChange={() => toggleTeam(team.id)}
                />
                {team.name}
              </label>
            ))}
            <span className="hint">{msg('pusrTeamsHint')}</span>
          </fieldset>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="admin-dialog-actions">
            {canRevoke && (
              <button
                type="button"
                className="button-danger admin-dialog-actions-delete"
                disabled={submitting}
                onClick={() => void handleRevokeLogin()}
              >
                {msg('pusrRevokeLogin')}
              </button>
            )}
            <div className="admin-dialog-actions-main">
              <button type="button" className="button-secondary" onClick={onClose}>
                {msg('cancel')}
              </button>
              <button type="submit" className="button-primary" disabled={submitting}>
                {submitting ? msg('loading') : mode === 'create' ? msg('pusrCreate') : msg('submitSave')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
