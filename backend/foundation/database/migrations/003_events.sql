-- Events: domain events, outbox, webhooks
-- See Konzept.txt §12

CREATE TABLE events.domain_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    aggregate_type  TEXT NOT NULL,
    aggregate_id    UUID NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_domain_events_tenant_occurred
    ON events.domain_events (tenant_id, occurred_at DESC);
CREATE INDEX idx_domain_events_type
    ON events.domain_events (tenant_id, event_type);

CREATE TABLE events.outbox_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_event_id UUID NOT NULL REFERENCES events.domain_events (id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
    retry_count     INT NOT NULL DEFAULT 0,
    last_error      TEXT,
    last_attempt_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbox_pending
    ON events.outbox_events (status, created_at)
    WHERE status IN ('pending', 'failed');

CREATE TABLE events.webhook_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    event_types     TEXT[] NOT NULL,
    target_url      TEXT NOT NULL,
    secret          TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    retry_count     INT NOT NULL DEFAULT 0,
    last_error      TEXT,
    last_attempt_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_subscriptions_tenant
    ON events.webhook_subscriptions (tenant_id)
    WHERE is_active = true;
