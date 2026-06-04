import type { EventType } from './event-types.js';

/** Payload stored in events.domain_events.payload (JSONB). */
export interface StoredEventPayload {
  schema_version: number;
  actor_user_id: string | null;
  data: Record<string, unknown>;
}

/**
 * Envelope delivered to webhook subscribers and external app consumers.
 * aggregate_type / aggregate_id are DB-only routing fields and are not included.
 */
export interface WebhookEventEnvelope {
  event_id: string;
  type: EventType;
  schema_version: number;
  tenant_id: string;
  occurred_at: string;
  actor_user_id: string | null;
  data: Record<string, unknown>;
}

export interface BuildStoredPayloadInput {
  schemaVersion?: number;
  actorUserId?: string | null;
  data?: Record<string, unknown>;
}

export function buildStoredPayload(input: BuildStoredPayloadInput): StoredEventPayload {
  return {
    schema_version: input.schemaVersion ?? 1,
    actor_user_id: input.actorUserId ?? null,
    data: input.data ?? {},
  };
}

export interface DomainEventRow {
  id: string;
  tenant_id: string;
  event_type: EventType;
  schema_version: number;
  actor_user_id: string | null;
  payload: StoredEventPayload;
  occurred_at: Date;
}

export function parseStoredPayload(raw: unknown): StoredEventPayload {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if ('schema_version' in obj && 'data' in obj) {
      return {
        schema_version: typeof obj.schema_version === 'number' ? obj.schema_version : 1,
        actor_user_id: typeof obj.actor_user_id === 'string' ? obj.actor_user_id : null,
        data:
          obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
            ? (obj.data as Record<string, unknown>)
            : {},
      };
    }
    // Legacy rows: entire payload treated as data
    return {
      schema_version: 1,
      actor_user_id: null,
      data: obj,
    };
  }
  return { schema_version: 1, actor_user_id: null, data: {} };
}

export function buildWebhookEnvelope(row: DomainEventRow): WebhookEventEnvelope {
  const payload = parseStoredPayload(row.payload);
  return {
    event_id: row.id,
    type: row.event_type,
    schema_version: row.schema_version,
    tenant_id: row.tenant_id,
    occurred_at: row.occurred_at.toISOString(),
    actor_user_id: row.actor_user_id ?? payload.actor_user_id,
    data: payload.data,
  };
}
