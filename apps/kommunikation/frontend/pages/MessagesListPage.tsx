import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuSettings } from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import type { components } from '@shell/api/schema.js';
import { CreateMessageDialog } from '../components/CreateMessageDialog.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import { directionLabel, formatMessageDate, type MessageListItem } from '../lib/message-labels.js';

type MessageModel = components['schemas']['MessageModel'];

export function MessagesListPage() {
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const { settings, loading: settingsLoading } = useEffectiveSettings();
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [models, setModels] = useState<MessageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterModelId, setFilterModelId] = useState('');
  const [filterDirection, setFilterDirection] = useState('');
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const itemsPerPage = Math.max(5, Number(settings.itemsPerPage) || 25);

  const modelLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of models) {
      map.set(
        m.id,
        m.display_name ?? labelFromTranslations(m.translations, m.key, locale),
      );
    }
    return map;
  }, [models, locale]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers = apiHeaders(locale);
    const query: Record<string, string> = {};
    if (filterModelId) query.message_model_id = filterModelId;
    if (filterDirection) query.direction = filterDirection;
    const [messagesRes, modelsRes] = await Promise.all([
      api.GET('/v1/messages', { headers, params: { query } }),
      api.GET('/v1/message-models', { headers }),
    ]);
    if (messagesRes.error || modelsRes.error) {
      setError(msg('errorGeneric'));
      setLoading(false);
      return;
    }
    setMessages(messagesRes.data?.items ?? []);
    setModels(modelsRes.data?.items ?? []);
    setLoading(false);
  }, [locale, msg, filterModelId, filterDirection]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      const model = (modelLabels.get(m.message_model_id) ?? '').toLowerCase();
      const dir = directionLabel(m.direction, locale).toLowerCase();
      const ext = (m.external_message_id ?? '').toLowerCase();
      const subject = (m.subject ?? '').toLowerCase();
      const actors = m.participant_actor_ids.join(' ').toLowerCase();
      return (
        model.includes(q) ||
        dir.includes(q) ||
        ext.includes(q) ||
        subject.includes(q) ||
        actors.includes(q) ||
        m.id.toLowerCase().includes(q)
      );
    });
  }, [messages, search, modelLabels, locale]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageItems = filtered.slice(page * itemsPerPage, page * itemsPerPage + itemsPerPage);

  return (
    <div className="admin-page admin-page--shell">
      <header className="admin-page-header">
        <h1 className="admin-page-title">{msg('komAppTitle')}</h1>
        <div className="admin-toolbar">
          <button type="button" className="button-outline" onClick={() => setCreateOpen(true)}>
            + {msg('komCreateTitle')}
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

      <div className="admin-list-controls">
        <input
          type="search"
          className="admin-search"
          placeholder={msg('search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          value={filterModelId}
          onChange={(e) => {
            setFilterModelId(e.target.value);
            setPage(0);
          }}
        >
          <option value="">{msg('komFilterAllModels')}</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name ?? labelFromTranslations(m.translations, m.key, locale)}
            </option>
          ))}
        </select>
        <select
          value={filterDirection}
          onChange={(e) => {
            setFilterDirection(e.target.value);
            setPage(0);
          }}
        >
          <option value="">{msg('komFilterAllDirections')}</option>
          <option value="incoming">{msg('komDirection_incoming')}</option>
          <option value="outgoing">{msg('komDirection_outgoing')}</option>
          <option value="internal">{msg('komDirection_internal')}</option>
          <option value="draft">{msg('komDirection_draft')}</option>
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}
      {(loading || settingsLoading) && <p>{msg('loading')}</p>}

      {!loading && !settingsLoading && (
        <>
          <table className="admin-table admin-table--fixed-cols">
            <thead>
              <tr>
                <th>{msg('komColDate')}</th>
                <th>{msg('komColSubject')}</th>
                <th>{msg('komColModel')}</th>
                <th>{msg('komColDirection')}</th>
                <th>{msg('komColMessageId')}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {search ? msg('modelsNoResults') : msg('komEmpty')}
                  </td>
                </tr>
              ) : (
                pageItems.map((m) => (
                  <tr key={m.id}>
                    <td>{formatMessageDate(m.communicated_at, locale)}</td>
                    <td>
                      <Link to={`/apps/kommunikation/${m.id}`}>
                        {m.subject?.trim() || msg('komUntitled')}
                      </Link>
                    </td>
                    <td>{modelLabels.get(m.message_model_id) ?? m.message_model_id}</td>
                    <td>{directionLabel(m.direction, locale)}</td>
                    <td>{m.external_message_id ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {filtered.length > itemsPerPage && (
            <div className="admin-pagination">
              <button
                type="button"
                className="button-icon"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <LuChevronLeft size={18} />
              </button>
              <span>
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="button-icon"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                <LuChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}

      <CreateMessageDialog
        open={createOpen}
        models={models}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          void load();
          navigate(`/apps/kommunikation/${id}`);
        }}
      />
    </div>
  );
}
