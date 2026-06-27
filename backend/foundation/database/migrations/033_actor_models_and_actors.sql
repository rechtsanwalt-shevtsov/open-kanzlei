-- Actor models and actor instances (Beteiligte).

CREATE TABLE legal.actor_models (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    key                      TEXT NOT NULL,
    status                   TEXT NOT NULL DEFAULT 'draft',
    is_system                BOOLEAN NOT NULL DEFAULT false,
    translations             JSONB NOT NULL DEFAULT '{}',
    description              TEXT NOT NULL DEFAULT '',
    description_translations JSONB NOT NULL DEFAULT '{}',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, key)
);

CREATE INDEX idx_actor_models_tenant ON legal.actor_models (tenant_id);

CREATE TABLE legal.actors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    actor_model_id      UUID NOT NULL REFERENCES legal.actor_models (id),
    status              TEXT NOT NULL DEFAULT 'active',
    is_tenant_root      BOOLEAN NOT NULL DEFAULT false,
    encryption_status   TEXT NOT NULL DEFAULT 'none',
    encryption_version  INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_actors_tenant_root
    ON legal.actors (tenant_id)
    WHERE is_tenant_root = true;

CREATE INDEX idx_actors_tenant ON legal.actors (tenant_id);
CREATE INDEX idx_actors_model ON legal.actors (tenant_id, actor_model_id);

ALTER TABLE meta.attribute_definitions DROP CONSTRAINT IF EXISTS attribute_definitions_owner_type_check;
ALTER TABLE meta.attribute_definitions
    ADD CONSTRAINT attribute_definitions_owner_type_check
    CHECK (owner_type IN ('case_model', 'task_model', 'actor_model'));

ALTER TABLE meta.attribute_values DROP CONSTRAINT IF EXISTS attribute_values_owner_type_check;
ALTER TABLE meta.attribute_values
    ADD CONSTRAINT attribute_values_owner_type_check
    CHECK (owner_type IN ('case', 'case_model', 'task', 'task_model', 'actor', 'actor_model'));

ALTER TABLE platform.app_model_attribute_bindings DROP CONSTRAINT IF EXISTS app_model_attribute_bindings_owner_type_check;
ALTER TABLE platform.app_model_attribute_bindings
    ADD CONSTRAINT app_model_attribute_bindings_owner_type_check
    CHECK (owner_type IN ('case_model', 'task_model', 'actor_model'));

ALTER TABLE legal.actor_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.actors ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON legal.actor_models
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.actors
    USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE legal.actor_models FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.actors FORCE ROW LEVEL SECURITY;
