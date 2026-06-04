import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { buildStoredPayload } from './event-envelope.js';
import { eventVisibility, type EventType } from './event-types.js';

export interface DomainEventInput {
  tenantId: string;
  type: EventType;
  aggregateType: string;
  aggregateId: string;
  actorUserId?: string | null;
  schemaVersion?: number;
  data?: Record<string, unknown>;
}

/**
 * Persists domain events and outbox entries in the same DB transaction.
 * Payload follows the stored envelope format; see docs/event-catalog.md.
 */
export class EventService {
  async publish(client: pg.PoolClient, event: DomainEventInput): Promise<string> {
    const domainEventId = randomUUID();
    const schemaVersion = event.schemaVersion ?? 1;
    const visibility = eventVisibility(event.type);
    const payload = buildStoredPayload({
      schemaVersion,
      actorUserId: event.actorUserId,
      data: event.data,
    });

    await client.query(
      `INSERT INTO events.domain_events
         (id, tenant_id, event_type, aggregate_type, aggregate_id,
          schema_version, visibility, actor_user_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        domainEventId,
        event.tenantId,
        event.type,
        event.aggregateType,
        event.aggregateId,
        schemaVersion,
        visibility,
        event.actorUserId ?? null,
        JSON.stringify(payload),
      ],
    );

    await client.query(
      `INSERT INTO events.outbox_events (domain_event_id, tenant_id, status)
       VALUES ($1, $2, 'pending')`,
      [domainEventId, event.tenantId],
    );

    return domainEventId;
  }
}

let instance: EventService | undefined;

export function getEventService(): EventService {
  if (!instance) {
    instance = new EventService();
  }
  return instance;
}
