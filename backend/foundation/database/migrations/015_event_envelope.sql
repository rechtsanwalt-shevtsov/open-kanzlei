-- Event envelope: schema_version, visibility, actor_user_id
-- See docs/event-catalog.md

ALTER TABLE events.domain_events
    ADD COLUMN schema_version SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'internal')),
    ADD COLUMN actor_user_id UUID REFERENCES platform.users (id);

CREATE INDEX idx_domain_events_public_type
    ON events.domain_events (tenant_id, visibility, event_type, occurred_at DESC)
    WHERE visibility = 'public';
