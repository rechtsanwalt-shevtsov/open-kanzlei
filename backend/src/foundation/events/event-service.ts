import type pg from 'pg';
import { randomUUID } from 'node:crypto';

export interface DomainEventInput {
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
}

/**
 * Persists domain events and outbox entries in the same DB transaction.
 * Konzept.txt §12 — no sensitive plaintext in payloads.
 */
export class EventService {
  async publish(client: pg.PoolClient, event: DomainEventInput): Promise<string> {
    const domainEventId = randomUUID();
    const payload = event.payload ?? {};

    await client.query(
      `INSERT INTO events.domain_events
         (id, tenant_id, event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        domainEventId,
        event.tenantId,
        event.eventType,
        event.aggregateType,
        event.aggregateId,
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
