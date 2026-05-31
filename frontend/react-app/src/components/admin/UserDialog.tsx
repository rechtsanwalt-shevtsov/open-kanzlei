import { FormEvent, useEffect, useState } from 'react';
import { api, apiHeaders } from '../../api/client.js';
import type { components } from '../../api/schema.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { Team } from '../../hooks/useTeams.js';
import type { TenantUser } from '../../hooks/useTenantUsers.js';

type TenantRoleKey = components['schemas']['TenantRoleKey'];

const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]{0,62}$/;

interface UserDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  user?: TenantUser;
  teams: Team[];
  onClose: () => void;
  onSaved: () => void;
}

export function UserDialog({
  open,
  mode,
  user,
  teams,
  onClose,
  onSaved,
}: UserDialogProps) {
  const { locale, msg } = useI18n();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<TenantRoleKey>('regular');
  const [teamId, setTeamId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && user) {
      setUsername(user.username);
      setEmail(user.email ?? '');
      setPassword('');
      setRole(user.role);
      setTeamId(user.team_id ?? '');
      setIsActive(user.is_active);
    } else {
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('regular');
      setTeamId('');
      setIsActive(true);
    }
    setError(null);
  }, [open, mode, user]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

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
      const res = await api.POST('/v1/users', {
        headers: apiHeaders(locale),
        body: {
          username: username.trim(),
          email: email.trim() || null,
          password,
          role,
          team_id: teamId || null,
        },
      });
      setSubmitting(false);
      if (res.error) {
        const err = res.error as { message?: string };
        setError(err?.message ?? msg('errorGeneric'));
        return;
      }
    } else if (user) {
      const body: components['schemas']['UpdateTenantUserRequest'] = {
        email: email.trim() || null,
        role,
        team_id: teamId || null,
        is_active: isActive,
      };
      if (password) {
        body.password = password;
      }
      const res = await api.PATCH('/v1/users/{id}', {
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

  const title = mode === 'create' ? msg('usersCreateTitle') : msg('usersEditTitle');

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="user-dialog-title">{title}</h2>
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

          <label>
            {msg('usersColRole')}
            <select value={role} onChange={(e) => setRole(e.target.value as TenantRoleKey)}>
              <option value="admin">{msg('roleAdmin')}</option>
              <option value="regular">{msg('roleRegular')}</option>
            </select>
          </label>

          <label>
            {msg('usersColTeam')}
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{msg('usersNoTeam')}</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {mode === 'edit' && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              {msg('usersActive')}
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
              {submitting ? msg('loading') : mode === 'create' ? msg('usersCreate') : msg('submitSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
