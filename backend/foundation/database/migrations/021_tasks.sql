-- Re-introduce Task models and instances (Case → Task hierarchy, no Stage).
-- Task models are tenant-scoped; instances belong to one case and one task model.

CREATE TABLE legal.task_models (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    key                     TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'draft',
    translations            JSONB NOT NULL DEFAULT '{}',
    description             TEXT NOT NULL DEFAULT '',
    description_translations JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, key)
);

CREATE INDEX idx_task_models_tenant ON legal.task_models (tenant_id);

CREATE TABLE legal.tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    case_id                 UUID NOT NULL REFERENCES legal.cases (id) ON DELETE CASCADE,
    task_model_id           UUID NOT NULL REFERENCES legal.task_models (id),
    status                  TEXT NOT NULL DEFAULT 'not_started',
    predecessor_task_ids    UUID[] NOT NULL DEFAULT '{}',
    dependent_task_ids      UUID[] NOT NULL DEFAULT '{}',
    encryption_status       TEXT NOT NULL DEFAULT 'none',
    encryption_version      INT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_tenant ON legal.tasks (tenant_id);
CREATE INDEX idx_tasks_case ON legal.tasks (tenant_id, case_id);
CREATE INDEX idx_tasks_model ON legal.tasks (tenant_id, task_model_id);

CREATE TABLE legal.task_assignees (
    task_id     UUID NOT NULL REFERENCES legal.tasks (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES platform.users (id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_task_assignees_tenant_user ON legal.task_assignees (tenant_id, user_id);

-- Opt-out: task models allowed on all case models unless explicitly excluded.
CREATE TABLE legal.case_model_task_model_exclusions (
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    case_model_id   UUID NOT NULL REFERENCES legal.case_models (id) ON DELETE CASCADE,
    task_model_id   UUID NOT NULL REFERENCES legal.task_models (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (case_model_id, task_model_id)
);

CREATE INDEX idx_case_model_task_model_exclusions_tenant
    ON legal.case_model_task_model_exclusions (tenant_id);

ALTER TABLE meta.attribute_definitions DROP CONSTRAINT IF EXISTS attribute_definitions_owner_type_check;
ALTER TABLE meta.attribute_definitions
    ADD CONSTRAINT attribute_definitions_owner_type_check
    CHECK (owner_type IN ('case_model', 'task_model'));

ALTER TABLE meta.attribute_values DROP CONSTRAINT IF EXISTS attribute_values_owner_type_check;
ALTER TABLE meta.attribute_values
    ADD CONSTRAINT attribute_values_owner_type_check
    CHECK (owner_type IN ('case', 'case_model', 'task', 'task_model'));

ALTER TABLE legal.task_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.case_model_task_model_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON legal.task_models
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.tasks
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.task_assignees
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.case_model_task_model_exclusions
    USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE legal.task_models FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.task_assignees FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.case_model_task_model_exclusions FORCE ROW LEVEL SECURITY;
