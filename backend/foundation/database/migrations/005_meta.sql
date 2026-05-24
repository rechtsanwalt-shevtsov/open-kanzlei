-- Custom attributes: definitions on models, values on instances
-- See Konzept.txt §7

CREATE TABLE meta.attribute_definitions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    owner_type          TEXT NOT NULL
        CHECK (owner_type IN ('case_model', 'stage_model', 'task_model')),
    owner_id            UUID NOT NULL,
    key                 TEXT NOT NULL,
    data_type           TEXT NOT NULL,
    encryption_mode     TEXT NOT NULL DEFAULT 'server_readable'
        CHECK (encryption_mode IN ('server_readable', 'zero_knowledge')),
    translations        JSONB NOT NULL DEFAULT '{}',
    created_by          UUID REFERENCES platform.users (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, owner_type, owner_id, key)
);

CREATE INDEX idx_attribute_definitions_owner
    ON meta.attribute_definitions (tenant_id, owner_type, owner_id);

CREATE TABLE meta.attribute_values (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    attribute_definition_id UUID NOT NULL REFERENCES meta.attribute_definitions (id) ON DELETE CASCADE,
    owner_type              TEXT NOT NULL
        CHECK (owner_type IN ('case', 'stage', 'task')),
    owner_id                UUID NOT NULL,
    plaintext_value         TEXT,
    encrypted_value         BYTEA,
    encryption_status       TEXT NOT NULL DEFAULT 'none',
    encryption_version      INT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, attribute_definition_id, owner_type, owner_id)
);

CREATE INDEX idx_attribute_values_owner
    ON meta.attribute_values (tenant_id, owner_type, owner_id);
