import type pg from 'pg';
import { badRequest, notFound } from '../api/errors.js';
import { getEventService } from '../foundation/events/event-service.js';
import type { PublicEventType } from '../foundation/events/event-types.js';
import { withTenantTransaction } from '../foundation/database/tenant-context.js';
import {
  buildMessageFileStorageKey,
  deleteEncryptedMessageFile,
  readEncryptedMessageFile,
  writeEncryptedMessageFile,
} from '../foundation/storage/message-file-storage.js';
import {
  loadInstanceAttributes,
  upsertInstanceAttributes,
} from './attributes.js';
import { openText, sealText } from './message-crypto.js';
import type { MessageDirection } from './message-direction.js';
import { isMessageDirection } from './message-direction.js';
import type { MessageParticipantRole } from './message-participant-role.js';
import { isMessageParticipantRole } from './message-participant-role.js';
import type { MessagePartRole } from './message-part-role.js';
import { isMessagePartRole } from './message-part-role.js';
import { getMessageModel } from './message-models.js';
import { deleteInstanceAttributeValues } from './entity-guards.js';
import { toIso } from './validation.js';

export type CreateMessageParticipantInput = {
  role: MessageParticipantRole;
  actor_id?: string | null;
  display_name?: string | null;
  address?: string | null;
  sort_order?: number;
};

export type CreateMessagePartInput = {
  role: MessagePartRole;
  content_type?: string | null;
  text_content?: string | null;
  file?: {
    data_base64: string;
    filename: string;
    content_type: string;
  } | null;
  sort_order?: number;
};

export type CreateMessageInput = {
  message_model_id: string;
  direction: MessageDirection;
  communicated_at?: string;
  external_message_id?: string | null;
  subject?: string | null;
  attributes?: Record<string, unknown>;
  participants?: CreateMessageParticipantInput[];
  parts?: CreateMessagePartInput[];
};

export type MessageParticipantDto = {
  id: string;
  role: MessageParticipantRole;
  actor_id: string | null;
  display_name: string | null;
  address: string | null;
  sort_order: number;
};

export type MessagePartDto = {
  id: string;
  role: MessagePartRole;
  sort_order: number;
  content_type: string | null;
  text_content: string | null;
  file_id: string | null;
  filename: string | null;
};

export type MessageDto = {
  id: string;
  message_model_id: string;
  direction: MessageDirection;
  communicated_at: string;
  external_message_id: string | null;
  subject: string | null;
  encryption_status: string;
  attributes?: Record<string, string | number | boolean | string[] | null>;
  participants: MessageParticipantDto[];
  parts: MessagePartDto[];
  created_at: string;
  updated_at: string;
};

export type MessageListItemDto = {
  id: string;
  message_model_id: string;
  direction: MessageDirection;
  communicated_at: string;
  external_message_id: string | null;
  subject: string | null;
  encryption_status: string;
  participant_actor_ids: string[];
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  message_model_id: string;
  direction: MessageDirection;
  communicated_at: Date;
  external_message_id: string | null;
  subject_encrypted: Buffer | null;
  encryption_status: string;
  created_at: Date;
  updated_at: Date;
};

type ParticipantRow = {
  id: string;
  role: MessageParticipantRole;
  actor_id: string | null;
  display_name_encrypted: Buffer | null;
  address_encrypted: Buffer | null;
  sort_order: number;
};

type PartRow = {
  id: string;
  role: MessagePartRole;
  sort_order: number;
  content_type_encrypted: Buffer | null;
  text_encrypted: Buffer | null;
  file_id: string | null;
};

type FileRow = {
  id: string;
  original_filename_encrypted: Buffer | null;
  content_type_encrypted: Buffer | null;
};

async function publish(
  client: pg.PoolClient,
  tenantId: string,
  type: PublicEventType,
  aggregateType: string,
  aggregateId: string,
  data: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  await getEventService().publish(client, {
    tenantId,
    type,
    aggregateType,
    aggregateId,
    data,
    actorId,
  });
}

function assertCreateInput(input: CreateMessageInput): void {
  if (!input.message_model_id) throw badRequest('error.validation_failed');
  if (!isMessageDirection(input.direction)) throw badRequest('error.validation_failed');
}

async function mapParticipantRow(row: ParticipantRow): Promise<MessageParticipantDto> {
  return {
    id: row.id,
    role: row.role,
    actor_id: row.actor_id,
    display_name: await openText(row.display_name_encrypted),
    address: await openText(row.address_encrypted),
    sort_order: row.sort_order,
  };
}

async function mapPartRow(
  client: pg.PoolClient,
  tenantId: string,
  row: PartRow,
): Promise<MessagePartDto> {
  let filename: string | null = null;
  if (row.file_id) {
    const fileResult = await client.query<FileRow>(
      `SELECT id, original_filename_encrypted, content_type_encrypted
       FROM legal.message_files WHERE id = $1 AND tenant_id = $2`,
      [row.file_id, tenantId],
    );
    const fileRow = fileResult.rows[0];
    if (fileRow) {
      filename = await openText(fileRow.original_filename_encrypted);
    }
  }

  return {
    id: row.id,
    role: row.role,
    sort_order: row.sort_order,
    content_type: await openText(row.content_type_encrypted),
    text_content: await openText(row.text_encrypted),
    file_id: row.file_id,
    filename,
  };
}

async function mapMessageRow(
  client: pg.PoolClient,
  tenantId: string,
  row: MessageRow,
  includeDetails: boolean,
): Promise<MessageDto | MessageListItemDto> {
  if (!includeDetails) {
    const actors = await client.query<{ actor_id: string }>(
      `SELECT actor_id FROM legal.message_participants
       WHERE message_id = $1 AND tenant_id = $2 AND actor_id IS NOT NULL`,
      [row.id, tenantId],
    );
    return {
      id: row.id,
      message_model_id: row.message_model_id,
      direction: row.direction,
      communicated_at: toIso(row.communicated_at),
      external_message_id: row.external_message_id,
      subject: await openText(row.subject_encrypted),
      encryption_status: row.encryption_status,
      participant_actor_ids: actors.rows.map((r) => r.actor_id),
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }

  const participantResult = await client.query<ParticipantRow>(
    `SELECT id, role, actor_id, display_name_encrypted, address_encrypted, sort_order
     FROM legal.message_participants
     WHERE message_id = $1 AND tenant_id = $2
     ORDER BY sort_order, created_at`,
    [row.id, tenantId],
  );
  const partResult = await client.query<PartRow>(
    `SELECT id, role, sort_order, content_type_encrypted, text_encrypted, file_id
     FROM legal.message_parts
     WHERE message_id = $1 AND tenant_id = $2
     ORDER BY sort_order, created_at`,
    [row.id, tenantId],
  );

  const attrs = await loadInstanceAttributes(
    client,
    tenantId,
    'message',
    row.id,
    'message_model',
    row.message_model_id,
  );

  const participants = await Promise.all(participantResult.rows.map(mapParticipantRow));
  const parts = await Promise.all(
    partResult.rows.map((partRow) => mapPartRow(client, tenantId, partRow)),
  );

  return {
    id: row.id,
    message_model_id: row.message_model_id,
    direction: row.direction,
    communicated_at: toIso(row.communicated_at),
    external_message_id: row.external_message_id,
    subject: await openText(row.subject_encrypted),
    encryption_status: row.encryption_status,
    attributes: attrs,
    participants,
    parts,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export type ListMessagesQuery = {
  message_model_id?: string;
  direction?: string;
  actor_id?: string;
  communicated_from?: string;
  communicated_to?: string;
  limit?: number;
  offset?: number;
};

export async function listMessages(
  tenantId: string,
  query: ListMessagesQuery = {},
): Promise<MessageListItemDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const conditions = ['m.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (query.message_model_id) {
      conditions.push(`m.message_model_id = $${paramIndex++}`);
      params.push(query.message_model_id);
    }
    if (query.direction && isMessageDirection(query.direction)) {
      conditions.push(`m.direction = $${paramIndex++}`);
      params.push(query.direction);
    }
    if (query.communicated_from) {
      conditions.push(`m.communicated_at >= $${paramIndex++}`);
      params.push(query.communicated_from);
    }
    if (query.communicated_to) {
      conditions.push(`m.communicated_at <= $${paramIndex++}`);
      params.push(query.communicated_to);
    }
    if (query.actor_id) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM legal.message_participants mp
           WHERE mp.message_id = m.id AND mp.tenant_id = m.tenant_id AND mp.actor_id = $${paramIndex++}
         )`,
      );
      params.push(query.actor_id);
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    params.push(limit, offset);

    const result = await client.query<MessageRow>(
      `SELECT m.id, m.message_model_id, m.direction, m.communicated_at, m.external_message_id,
              m.subject_encrypted, m.encryption_status, m.created_at, m.updated_at
       FROM legal.messages m
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.communicated_at DESC, m.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params,
    );

    const items: MessageListItemDto[] = [];
    for (const row of result.rows) {
      const mapped = await mapMessageRow(client, tenantId, row, false);
      items.push(mapped as MessageListItemDto);
    }
    return items;
  });
}

export async function getMessage(tenantId: string, id: string): Promise<MessageDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<MessageRow>(
      `SELECT id, message_model_id, direction, communicated_at, external_message_id,
              subject_encrypted, encryption_status, created_at, updated_at
       FROM legal.messages WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return (await mapMessageRow(client, tenantId, row, true)) as MessageDto;
  });
}

async function insertMessageFile(
  client: pg.PoolClient,
  tenantId: string,
  file: { data_base64: string; filename: string; content_type: string },
): Promise<string> {
  const data = Buffer.from(file.data_base64, 'base64');
  const storageKey = buildMessageFileStorageKey(tenantId);
  await writeEncryptedMessageFile(tenantId, storageKey, data);

  const result = await client.query<{ id: string }>(
    `INSERT INTO legal.message_files
       (tenant_id, storage_key, original_filename_encrypted, content_type_encrypted, size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      tenantId,
      storageKey,
      await sealText(file.filename),
      await sealText(file.content_type),
      data.length,
    ],
  );
  return result.rows[0]!.id;
}

export async function createMessage(
  tenantId: string,
  input: CreateMessageInput,
  options?: { actorId?: string },
): Promise<MessageDto> {
  assertCreateInput(input);
  if (!(await getMessageModel(tenantId, input.message_model_id))) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    const communicatedAt = input.communicated_at ?? new Date().toISOString();
    const messageResult = await client.query<MessageRow>(
      `INSERT INTO legal.messages
         (tenant_id, message_model_id, direction, communicated_at, external_message_id, subject_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, message_model_id, direction, communicated_at, external_message_id,
                 subject_encrypted, encryption_status, created_at, updated_at`,
      [
        tenantId,
        input.message_model_id,
        input.direction,
        communicatedAt,
        input.external_message_id ?? null,
        await sealText(input.subject ?? null),
      ],
    );
    const message = messageResult.rows[0]!;

    for (const [index, participant] of (input.participants ?? []).entries()) {
      if (!isMessageParticipantRole(participant.role)) {
        throw badRequest('error.validation_failed');
      }
      await client.query(
        `INSERT INTO legal.message_participants
           (tenant_id, message_id, role, actor_id, display_name_encrypted, address_encrypted, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          message.id,
          participant.role,
          participant.actor_id ?? null,
          await sealText(participant.display_name ?? null),
          await sealText(participant.address ?? null),
          participant.sort_order ?? index,
        ],
      );
    }

    for (const [index, part] of (input.parts ?? []).entries()) {
      if (!isMessagePartRole(part.role)) {
        throw badRequest('error.validation_failed');
      }
      let fileId: string | null = null;
      if (part.file?.data_base64) {
        fileId = await insertMessageFile(client, tenantId, part.file);
      }
      await client.query(
        `INSERT INTO legal.message_parts
           (tenant_id, message_id, role, sort_order, content_type_encrypted, text_encrypted, file_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          message.id,
          part.role,
          part.sort_order ?? index,
          await sealText(part.content_type ?? null),
          await sealText(part.text_content ?? null),
          fileId,
        ],
      );
    }

    if (input.attributes && Object.keys(input.attributes).length > 0) {
      await upsertInstanceAttributes(
        client,
        tenantId,
        'message',
        message.id,
        'message_model',
        input.message_model_id,
        input.attributes,
      );
    }

    await publish(
      client,
      tenantId,
      'message.created',
      'message',
      message.id,
      { message_id: message.id, message_model_id: input.message_model_id },
      options?.actorId,
    );

    return (await mapMessageRow(client, tenantId, message, true)) as MessageDto;
  });
}

export async function deleteMessage(
  tenantId: string,
  id: string,
  actorId?: string,
): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const files = await client.query<{ id: string; storage_key: string }>(
      `SELECT mf.id, mf.storage_key
       FROM legal.message_files mf
       INNER JOIN legal.message_parts mp ON mp.file_id = mf.id AND mp.tenant_id = mf.tenant_id
       WHERE mp.message_id = $1 AND mp.tenant_id = $2`,
      [id, tenantId],
    );

    await deleteInstanceAttributeValues(client, tenantId, 'message', id);

    const result = await client.query(
      `DELETE FROM legal.messages WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!result.rowCount) throw notFound();

    for (const file of files.rows) {
      await deleteEncryptedMessageFile(tenantId, file.storage_key);
    }

    await publish(
      client,
      tenantId,
      'message.deleted',
      'message',
      id,
      { message_id: id },
      actorId,
    );
  });
}

export async function getMessageFileContent(
  tenantId: string,
  fileId: string,
): Promise<{ data: Buffer; content_type: string | null; filename: string | null } | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<{
      storage_key: string;
      original_filename_encrypted: Buffer | null;
      content_type_encrypted: Buffer | null;
    }>(
      `SELECT storage_key, original_filename_encrypted, content_type_encrypted
       FROM legal.message_files WHERE id = $1 AND tenant_id = $2`,
      [fileId, tenantId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const data = await readEncryptedMessageFile(tenantId, row.storage_key);
    return {
      data,
      content_type: await openText(row.content_type_encrypted),
      filename: await openText(row.original_filename_encrypted),
    };
  });
}
