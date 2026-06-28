import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, apiHeaders, apiJsonHeaders, readApiError } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { listMessageModelAttributes, type AttributeDefinition } from '@shell/lib/attribute-api.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import { FieldSelectInput } from '@shell/components/admin/FieldSelectInput.js';
import { ReferenceFieldInput } from '@shell/components/admin/ReferenceFieldInput.js';
import type { components } from '@shell/api/schema.js';
import {
  defaultFieldValue,
  defaultMultiSelectValue,
  parseFieldValueFromState,
} from '../lib/field-value.js';
import { actorLabel, buildActorModelLabels } from '../lib/actor-label.js';

type MessageModel = components['schemas']['MessageModel'];
type MessageDirection = components['schemas']['MessageDirection'];
type MessagePartRole = components['schemas']['MessagePartRole'];
type MessageParticipantRole = components['schemas']['MessageParticipantRole'];
type Actor = components['schemas']['Actor'];

type ParticipantDraft = {
  role: MessageParticipantRole;
  actor_id: string;
  display_name: string;
  address: string;
};

type FilePartDraft = {
  id: string;
  file: File;
  role: MessagePartRole;
};

const DIRECTIONS: MessageDirection[] = ['incoming', 'outgoing', 'internal', 'draft'];
const PARTICIPANT_ROLES: MessageParticipantRole[] = ['from', 'to', 'cc', 'bcc', 'reply_to'];
const PART_ROLES: MessagePartRole[] = [
  'body',
  'attachment',
  'inline',
  'signature',
  'metadata',
  'annotation',
  'summary',
  'ocr',
];

function fieldLabel(def: AttributeDefinition, locale: string): string {
  return (
    def.display_name ?? labelFromTranslations(def.translations, def.key, locale as 'de' | 'en')
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('read failed'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

interface CreateMessageDialogProps {
  open: boolean;
  models: MessageModel[];
  onClose: () => void;
  onCreated: (messageId: string) => void;
}

export function CreateMessageDialog({
  open,
  models,
  onClose,
  onCreated,
}: CreateMessageDialogProps) {
  const { locale, msg } = useI18n();
  const selectableModels = useMemo(
    () => models.filter((m) => m.status !== 'archived'),
    [models],
  );

  const [messageModelId, setMessageModelId] = useState('');
  const [direction, setDirection] = useState<MessageDirection>('incoming');
  const [subject, setSubject] = useState('');
  const [communicatedAt, setCommunicatedAt] = useState('');
  const [externalMessageId, setExternalMessageId] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    { role: 'from', actor_id: '', display_name: '', address: '' },
    { role: 'to', actor_id: '', display_name: '', address: '' },
  ]);
  const [fileParts, setFileParts] = useState<FilePartDraft[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [actorModelLabels, setActorModelLabels] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [instanceFields, setInstanceFields] = useState<AttributeDefinition[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [multiFieldValues, setMultiFieldValues] = useState<Record<string, string[]>>({});
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessageModelId(selectableModels[0]?.id ?? '');
    setDirection('incoming');
    setSubject('');
    setCommunicatedAt(new Date().toISOString().slice(0, 16));
    setExternalMessageId('');
    setBodyText('');
    setParticipants([
      { role: 'from', actor_id: '', display_name: '', address: '' },
      { role: 'to', actor_id: '', display_name: '', address: '' },
    ]);
    setFileParts([]);
    setError(null);
    const headers = apiHeaders(locale);
    void Promise.all([
      api.GET('/v1/actors', { headers }),
      api.GET('/v1/actor-models', { headers }),
    ]).then(([actorsRes, modelsRes]) => {
      setActors(actorsRes.data?.items ?? []);
      setActorModelLabels(buildActorModelLabels(modelsRes.data?.items ?? [], locale));
    });
  }, [open, selectableModels, locale]);

  useEffect(() => {
    if (!open || !messageModelId) {
      setInstanceFields([]);
      setFieldValues({});
      setMultiFieldValues({});
      return;
    }
    let cancelled = false;
    setFieldsLoading(true);
    void listMessageModelAttributes(messageModelId, locale, 'instance').then((res) => {
      if (cancelled) return;
      setFieldsLoading(false);
      if (res.error) {
        setInstanceFields([]);
        return;
      }
      const defs = (res.data?.items ?? []) as AttributeDefinition[];
      setInstanceFields(defs);
      const initial: Record<string, string> = {};
      const initialMulti: Record<string, string[]> = {};
      for (const def of defs) {
        if (def.data_type === 'multi_select') {
          initialMulti[def.key] = defaultMultiSelectValue(def);
        } else {
          initial[def.key] = defaultFieldValue(def);
        }
      }
      setFieldValues(initial);
      setMultiFieldValues(initialMulti);
    });
    return () => {
      cancelled = true;
    };
  }, [open, messageModelId, locale]);

  const sortedFields = useMemo(
    () =>
      [...instanceFields].sort((a, b) =>
        fieldLabel(a, locale).localeCompare(fieldLabel(b, locale)),
      ),
    [instanceFields, locale],
  );

  const actorOptions = useMemo(
    () =>
      actors
        .map((a) => ({ id: a.id, label: actorLabel(a, actorModelLabels, locale) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [actors, actorModelLabels, locale],
  );

  if (!open) return null;

  function updateParticipant(index: number, patch: Partial<ParticipantDraft>) {
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addParticipant() {
    setParticipants((prev) => [
      ...prev,
      { role: 'to', actor_id: '', display_name: '', address: '' },
    ]);
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  function onFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next: FilePartDraft[] = [];
    for (const file of Array.from(fileList)) {
      next.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        role: 'attachment',
      });
    }
    setFileParts((prev) => [...prev, ...next]);
  }

  function updateFilePart(id: string, role: MessagePartRole) {
    setFileParts((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
  }

  function removeFilePart(id: string) {
    setFileParts((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!messageModelId) {
      setError(msg('komValidationModel'));
      return;
    }
    setSubmitting(true);
    setError(null);

    const attributes: Record<string, unknown> = {};
    for (const def of instanceFields) {
      const raw =
        def.data_type === 'multi_select'
          ? multiFieldValues[def.key]
          : parseFieldValueFromState(def, fieldValues[def.key] ?? '');
      if (raw !== null && raw !== '' && !(Array.isArray(raw) && raw.length === 0)) {
        attributes[def.key] = raw;
      }
    }

    const parts: components['schemas']['CreateMessagePartRequest'][] = [];
    if (bodyText.trim()) {
      parts.push({
        role: 'body',
        content_type: 'text/plain',
        text_content: bodyText.trim(),
      });
    }
    for (const fp of fileParts) {
      const data_base64 = await readFileAsBase64(fp.file);
      parts.push({
        role: fp.role,
        content_type: fp.file.type || 'application/octet-stream',
        file: {
          data_base64,
          filename: fp.file.name,
          content_type: fp.file.type || 'application/octet-stream',
        },
      });
    }

    const communicatedIso = communicatedAt
      ? new Date(communicatedAt).toISOString()
      : new Date().toISOString();

    const res = await api.POST('/v1/messages', {
      headers: apiJsonHeaders(locale),
      body: {
        message_model_id: messageModelId,
        direction,
        subject: subject.trim() || null,
        communicated_at: communicatedIso,
        external_message_id: externalMessageId.trim() || null,
        attributes,
        participants: participants
          .filter(
            (p) => p.actor_id || p.display_name.trim() || p.address.trim(),
          )
          .map((p, index) => ({
            role: p.role,
            actor_id: p.actor_id || null,
            display_name: p.display_name.trim() || null,
            address: p.address.trim() || null,
            sort_order: index,
          })),
        parts,
      },
    });

    setSubmitting(false);
    if (res.error || !res.data) {
      setError(await readApiError(res.error, msg('errorGeneric')));
      return;
    }
    onCreated(res.data.id);
    onClose();
  }

  function renderFieldInput(def: AttributeDefinition) {
    const value = fieldValues[def.key] ?? '';
    const label = fieldLabel(def, locale);
    const required = def.is_required;

    if (def.data_type === 'boolean') {
      return (
        <label key={def.key} className="checkbox-label">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) =>
              setFieldValues((prev) => ({ ...prev, [def.key]: e.target.checked ? 'true' : 'false' }))
            }
          />
          {label}
          {required ? ' *' : ''}
        </label>
      );
    }

    if (def.data_type === 'single_select' || def.data_type === 'multi_select') {
      return (
        <FieldSelectInput
          key={def.key}
          definition={def}
          locale={locale}
          value={def.data_type === 'multi_select' ? multiFieldValues[def.key] ?? [] : value}
          onChange={(next) => {
            if (def.data_type === 'multi_select') {
              setMultiFieldValues((prev) => ({ ...prev, [def.key]: next as string[] }));
            } else {
              setFieldValues((prev) => ({ ...prev, [def.key]: next as string }));
            }
          }}
          label={label}
          required={required}
        />
      );
    }

    if (def.data_type === 'reference') {
      return (
        <ReferenceFieldInput
          key={def.key}
          definition={def}
          locale={locale}
          value={value}
          onChange={(next) => setFieldValues((prev) => ({ ...prev, [def.key]: next }))}
          label={label}
          required={required}
        />
      );
    }

    const inputType =
      def.data_type === 'number' || def.data_type === 'money'
        ? 'number'
        : def.data_type === 'date'
          ? 'date'
          : 'text';

    return (
      <label key={def.key}>
        {label}
        {required ? ' *' : ''}
        <input
          type={inputType}
          value={value}
          onChange={(e) => setFieldValues((prev) => ({ ...prev, [def.key]: e.target.value }))}
          required={required}
        />
      </label>
    );
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog admin-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-message-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-message-title">{msg('komCreateTitle')}</h2>
        <form className="form admin-dialog-form" onSubmit={(e) => void handleSubmit(e)}>
          {error && <p className="form-error">{error}</p>}

          {selectableModels.length === 0 ? (
            <p className="form-error">{msg('komNoModels')}</p>
          ) : (
            <label>
              {msg('komFieldModel')} *
              <select
                value={messageModelId}
                onChange={(e) => setMessageModelId(e.target.value)}
                required
              >
                {selectableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name ?? labelFromTranslations(m.translations, m.key, locale)}
                    {m.status === 'draft' ? ` (${msg('komModelDraftSuffix')})` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            {msg('komFieldDirection')} *
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as MessageDirection)}
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {msg(`komDirection_${d}` as 'komDirection_incoming')}
                </option>
              ))}
            </select>
          </label>

          <label>
            {msg('komFieldSubject')}
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label>
            {msg('komFieldCommunicatedAt')}
            <input
              type="datetime-local"
              value={communicatedAt}
              onChange={(e) => setCommunicatedAt(e.target.value)}
            />
          </label>

          <label>
            {msg('komFieldMessageId')}
            <input
              type="text"
              value={externalMessageId}
              onChange={(e) => setExternalMessageId(e.target.value)}
            />
          </label>

          <fieldset>
            <legend>{msg('komFieldParticipants')}</legend>
            {participants.map((p, index) => (
              <div key={index} className="form-row form-row--participant">
                <select
                  value={p.role}
                  onChange={(e) =>
                    updateParticipant(index, {
                      role: e.target.value as MessageParticipantRole,
                    })
                  }
                >
                  {PARTICIPANT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={p.actor_id}
                  onChange={(e) => {
                    const actorId = e.target.value;
                    const selected = actorOptions.find((o) => o.id === actorId);
                    updateParticipant(index, {
                      actor_id: actorId,
                      display_name:
                        actorId && !p.display_name.trim() && selected
                          ? selected.label
                          : p.display_name,
                    });
                  }}
                >
                  <option value="">{msg('komParticipantNoActor')}</option>
                  {actorOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder={msg('komParticipantDisplayName')}
                  value={p.display_name}
                  onChange={(e) => updateParticipant(index, { display_name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder={msg('komParticipantAddress')}
                  value={p.address}
                  onChange={(e) => updateParticipant(index, { address: e.target.value })}
                />
                {participants.length > 1 && (
                  <button type="button" className="button-outline" onClick={() => removeParticipant(index)}>
                    −
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="button-outline" onClick={addParticipant}>
              + {msg('komAddParticipant')}
            </button>
          </fieldset>

          <label>
            {msg('komFieldBody')}
            <textarea rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
          </label>

          {fieldsLoading ? (
            <p>{msg('loading')}</p>
          ) : (
            sortedFields.map((def) => renderFieldInput(def))
          )}

          <fieldset>
            <legend>{msg('komFieldAttachments')}</legend>
            <input type="file" multiple onChange={(e) => onFilesSelected(e.target.files)} />
            {fileParts.map((fp) => (
              <div key={fp.id} className="form-row">
                <span>{fp.file.name}</span>
                <select
                  value={fp.role}
                  onChange={(e) => updateFilePart(fp.id, e.target.value as MessagePartRole)}
                >
                  {PART_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button type="button" className="button-outline" onClick={() => removeFilePart(fp.id)}>
                  −
                </button>
              </div>
            ))}
          </fieldset>

          <div className="admin-dialog-actions">
            <button type="button" className="button-outline" onClick={onClose} disabled={submitting}>
              {msg('cancel')}
            </button>
            <button type="submit" disabled={submitting || selectableModels.length === 0}>
              {submitting ? msg('saving') : msg('komCreateSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
