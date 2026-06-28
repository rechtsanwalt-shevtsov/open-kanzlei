-- Message models, messages, parts, participants, encrypted file storage.

CREATE TABLE legal.message_models (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    key                      TEXT NOT NULL,
    status                   TEXT NOT NULL DEFAULT 'draft',
    translations             JSONB NOT NULL DEFAULT '{}',
    description              TEXT NOT NULL DEFAULT '',
    description_translations JSONB NOT NULL DEFAULT '{}',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, key)
);

CREATE INDEX idx_message_models_tenant ON legal.message_models (tenant_id);

CREATE TABLE legal.message_files (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    storage_key                 TEXT NOT NULL,
    original_filename_encrypted BYTEA,
    content_type_encrypted      BYTEA,
    size_bytes                  BIGINT NOT NULL,
    encryption_status           TEXT NOT NULL DEFAULT 'encrypted',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_files_tenant ON legal.message_files (tenant_id);

CREATE TABLE legal.messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    message_model_id  UUID NOT NULL REFERENCES legal.message_models (id),
    direction         TEXT NOT NULL
        CHECK (direction IN ('incoming', 'outgoing', 'internal', 'draft')),
    communicated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    external_message_id TEXT,
    subject_encrypted BYTEA,
    encryption_status TEXT NOT NULL DEFAULT 'encrypted',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_tenant ON legal.messages (tenant_id);
CREATE INDEX idx_messages_model ON legal.messages (tenant_id, message_model_id);
CREATE INDEX idx_messages_communicated ON legal.messages (tenant_id, communicated_at DESC);

CREATE TABLE legal.message_parts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    message_id            UUID NOT NULL REFERENCES legal.messages (id) ON DELETE CASCADE,
    role                  TEXT NOT NULL
        CHECK (role IN ('body', 'attachment', 'inline', 'signature', 'metadata', 'annotation', 'summary', 'ocr')),
    sort_order            INT NOT NULL DEFAULT 0,
    content_type_encrypted BYTEA,
    text_encrypted        BYTEA,
    file_id               UUID REFERENCES legal.message_files (id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_parts_message ON legal.message_parts (tenant_id, message_id);

CREATE TABLE legal.message_participants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    message_id              UUID NOT NULL REFERENCES legal.messages (id) ON DELETE CASCADE,
    role                    TEXT NOT NULL
        CHECK (role IN ('from', 'to', 'cc', 'bcc', 'reply_to')),
    actor_id                UUID REFERENCES legal.actors (id) ON DELETE SET NULL,
    display_name_encrypted  BYTEA,
    address_encrypted       BYTEA,
    sort_order              INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_participants_message ON legal.message_participants (tenant_id, message_id);
CREATE INDEX idx_message_participants_actor ON legal.message_participants (tenant_id, actor_id)
    WHERE actor_id IS NOT NULL;

ALTER TABLE meta.attribute_definitions DROP CONSTRAINT IF EXISTS attribute_definitions_owner_type_check;
ALTER TABLE meta.attribute_definitions
    ADD CONSTRAINT attribute_definitions_owner_type_check
    CHECK (owner_type IN ('case_model', 'task_model', 'actor_model', 'message_model'));

ALTER TABLE meta.attribute_values DROP CONSTRAINT IF EXISTS attribute_values_owner_type_check;
ALTER TABLE meta.attribute_values
    ADD CONSTRAINT attribute_values_owner_type_check
    CHECK (owner_type IN ('case', 'case_model', 'task', 'task_model', 'actor', 'actor_model', 'message', 'message_model'));

ALTER TABLE platform.app_model_attribute_bindings DROP CONSTRAINT IF EXISTS app_model_attribute_bindings_owner_type_check;
ALTER TABLE platform.app_model_attribute_bindings
    ADD CONSTRAINT app_model_attribute_bindings_owner_type_check
    CHECK (owner_type IN ('case_model', 'task_model', 'actor_model', 'message_model'));

ALTER TABLE legal.message_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.message_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.message_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON legal.message_models
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON legal.messages
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON legal.message_parts
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON legal.message_participants
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON legal.message_files
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE legal.message_models FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.messages FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.message_parts FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.message_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.message_files FORCE ROW LEVEL SECURITY;
