import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, apiHeaders } from '../../api/client.js';
import type { components } from '../../api/schema.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { Team } from '../../hooks/useTeams.js';
import type { PlatformUser } from '../../hooks/usePlatformUsers.js';

const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]{0,62}$/;

interface PlatformUserDialogProps {
  open: boolean;
  actor?: PlatformUser;
  groups: Team[];
  onClose: () => void;
  onSaved: () => void;
}

export function PlatformUserDialog({
  open,
  actor,
  groups,
  onClose,
  onSaved,
}: PlatformUserDialogProps) {
  const { locale, msg } = useI18n();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const platformUserGroupId = useMemo(
    () => groups.find((g) => g.key === 'plattformuser')?.id ?? null,
    [groups],
  );

  const hasLoginSelected = useMemo(
    () => (platformUserGroupId ? groupIds.includes(platformUserGroupId) : false),
    [groupIds, platformUserGroupId],
  );

  useEffect(() => {
    if (!open || !actor) return;
    setUsername(actor.username ?? '');
    setEmail(actor.email ?? '');
    setPassword('');
    setGroupIds(actor.groups.map((g) => g.id));
    setError(null);
  }, [open, actor]);

  function toggleGroup(groupId: string) {
    setGroupIds((prev) => {
      if (prev.includes(groupId)) {
        const next = prev.filter((id) => id !== groupId);
        return next.length > 0 ? next : prev;
      }
      return [...prev, groupId];
    });
  }

  if (!open || !actor) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!actor) return;
    setError(null);

    if (groupIds.length === 0) {
      setError(msg('usersTeamsRequired'));
      return;
    }

    const grantingLogin = hasLoginSelected && !actor.has_login;
    if (grantingLogin) {
      const trimmed = username.trim();
      if (!USERNAME_PATTERN.test(trimmed)) {
        setError(msg('usersUsernameInvalid'));
        return;
      }
      if (password.length < 8) {
        setError(msg('usersPasswordShort'));
        return;
      }
    } else if (hasLoginSelected && password && password.length < 8) {
      setError(msg('usersPasswordShort'));
      return;
    }

    setSubmitting(true);

    const body: components['schemas']['UpdatePlatformUserRequest'] = {
      email: email.trim() || null,
      group_ids: groupIds,
    };

    if (hasLoginSelected) {
      if (username.trim()) {
        body.username = username.trim();
      }
      if (password) {
        body.password = password;
      }
    }

    const res = await api.PATCH('/v1/platform-users/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id: actor.id } },
      body,
    });
    setSubmitting(false);

    if (res.error) {
      const err = res.error as { message?: string };
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }

    onSaved();
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
        <h2 id="platform-user-dialog-title">{msg('pusrEditTitle')}</h2>
        <form onSubmit={handleSubmit} className="form">
          <p className="admin-dialog-readonly">
            {msg('pusrColActor')}: <strong>{actor.display_name}</strong>
          </p>

          <fieldset className="admin-fieldset">
            <legend>{msg('usersColTeams')}</legend>
            {groups.map((group) => (
              <label key={group.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={groupIds.includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                />
                {group.name}
              </label>
            ))}
            <span className="hint">{msg('pusrGroupsHint')}</span>
          </fieldset>

          {hasLoginSelected && (
            <>
              <label>
                {msg('username')}
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={!actor.has_login}
                  autoComplete="off"
                />
              </label>

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
                {actor.has_login ? msg('usersPasswordOptional') : msg('password')}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!actor.has_login}
                  minLength={!actor.has_login ? 8 : undefined}
                  autoComplete="new-password"
                />
              </label>
            </>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="admin-dialog-actions">
            <div className="admin-dialog-actions-main">
              <button type="button" className="button-secondary" onClick={onClose}>
                {msg('cancel')}
              </button>
              <button type="submit" className="button-primary" disabled={submitting}>
                {submitting ? msg('loading') : msg('submitSave')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
