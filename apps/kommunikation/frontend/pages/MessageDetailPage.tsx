import { useCallback, useEffect, useState } from 'react';
import { LuSettings, LuTrash2 } from 'react-icons/lu';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import type { components } from '@shell/api/schema.js';
import { directionLabel, formatMessageDate, type Message } from '../lib/message-labels.js';

type MessageModel = components['schemas']['MessageModel'];

export function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const [message, setMessage] = useState<Message | null>(null);
  const [modelLabel, setModelLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const headers = apiHeaders(locale);
    const res = await api.GET('/v1/messages/{id}', { headers, params: { path: { id } } });
    if (res.error || !res.data) {
      setError(msg('errorGeneric'));
      setLoading(false);
      return;
    }
    setMessage(res.data);
    const modelRes = await api.GET('/v1/message-models/{id}', {
      headers,
      params: { path: { id: res.data.message_model_id } },
    });
    const model = modelRes.data as MessageModel | undefined;
    setModelLabel(
      model
        ? (model.display_name ?? labelFromTranslations(model.translations, model.key, locale))
        : res.data.message_model_id,
    );
    setLoading(false);
  }, [id, locale, msg]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!id || !window.confirm(msg('komDeleteConfirm'))) return;
    setDeleting(true);
    const res = await api.DELETE('/v1/messages/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id } },
    });
    setDeleting(false);
    if (res.error) {
      setError(msg('errorGeneric'));
      return;
    }
    navigate('/apps/kommunikation');
  }

  if (loading) return <p>{msg('loading')}</p>;
  if (!message) return <p className="form-error">{error ?? msg('errorGeneric')}</p>;

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/kommunikation">{msg('komAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{message.subject ?? message.id.slice(0, 8)}</span>
      </nav>

      <header className="admin-page-header">
        <h1 className="admin-page-title">{message.subject ?? msg('komUntitled')}</h1>
        <div className="admin-toolbar">
          <button
            type="button"
            className="button-icon button-icon--danger"
            disabled={deleting}
            onClick={() => void handleDelete()}
            title={msg('delete')}
            aria-label={msg('delete')}
          >
            <LuTrash2 size={18} aria-hidden />
          </button>
          <Link
            to="/apps/kommunikation/settings"
            className="button-icon"
            title={msg('settings')}
            aria-label={msg('settings')}
          >
            <LuSettings size={18} aria-hidden />
          </Link>
        </div>
      </header>

      <dl className="detail-list">
        <dt>{msg('komColModel')}</dt>
        <dd>{modelLabel}</dd>
        <dt>{msg('komColDirection')}</dt>
        <dd>{directionLabel(message.direction, locale)}</dd>
        <dt>{msg('komColDate')}</dt>
        <dd>{formatMessageDate(message.communicated_at, locale)}</dd>
        <dt>{msg('komColMessageId')}</dt>
        <dd>{message.external_message_id ?? '—'}</dd>
      </dl>

      {message.participants.length > 0 && (
        <section>
          <h2>{msg('komFieldParticipants')}</h2>
          <ul>
            {message.participants.map((p) => (
              <li key={p.id}>
                <strong>{p.role}</strong>:{' '}
                {p.display_name ?? p.address ?? p.actor_id ?? '—'}
              </li>
            ))}
          </ul>
        </section>
      )}

      {message.parts.map((part) => (
        <section key={part.id}>
          <h2>
            {part.role}
            {part.filename ? ` — ${part.filename}` : ''}
          </h2>
          {part.text_content && <pre className="message-body">{part.text_content}</pre>}
          {part.file_id && (
            <p>
              <a href={`/v1/message-files/${part.file_id}`} download={part.filename ?? undefined}>
                {msg('komDownloadAttachment')}
              </a>
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
