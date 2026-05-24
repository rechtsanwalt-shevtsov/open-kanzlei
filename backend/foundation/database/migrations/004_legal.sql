-- Legal work: models, lazy instances, documents
-- See Konzept.txt §6, §8

-- Model definitions (tenant-scoped)
CREATE TABLE legal.case_models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    translations    JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, key)
);

CREATE TABLE legal.stage_models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    translations    JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, key)
);

CREATE TABLE legal.task_models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    stage_model_id  UUID NOT NULL REFERENCES legal.stage_models (id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    translations    JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, stage_model_id, key)
);

-- Optional M2M: typical stages for a case model (metadata only, no instances)
CREATE TABLE legal.case_model_stage_models (
    case_model_id   UUID NOT NULL REFERENCES legal.case_models (id) ON DELETE CASCADE,
    stage_model_id  UUID NOT NULL REFERENCES legal.stage_models (id) ON DELETE CASCADE,
    sort_order      INT,
    PRIMARY KEY (case_model_id, stage_model_id)
);

-- Instances (lazy — created explicitly, not auto-generated)
CREATE TABLE legal.cases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    case_model_id       UUID NOT NULL REFERENCES legal.case_models (id),
    status              TEXT NOT NULL DEFAULT 'open',
    encryption_status   TEXT NOT NULL DEFAULT 'none',
    encryption_version  INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_tenant ON legal.cases (tenant_id);
CREATE INDEX idx_cases_model ON legal.cases (tenant_id, case_model_id);

CREATE TABLE legal.stages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    case_id             UUID NOT NULL REFERENCES legal.cases (id) ON DELETE CASCADE,
    stage_model_id      UUID NOT NULL REFERENCES legal.stage_models (id),
    status              TEXT NOT NULL DEFAULT 'open',
    encryption_status   TEXT NOT NULL DEFAULT 'none',
    encryption_version  INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stages_case ON legal.stages (tenant_id, case_id);

CREATE TABLE legal.tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    stage_id            UUID NOT NULL REFERENCES legal.stages (id) ON DELETE CASCADE,
    task_model_id       UUID NOT NULL REFERENCES legal.task_models (id),
    status              TEXT NOT NULL DEFAULT 'open',
    encryption_status   TEXT NOT NULL DEFAULT 'none',
    encryption_version  INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_stage ON legal.tasks (tenant_id, stage_id);

CREATE TABLE legal.documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    owner_type          TEXT NOT NULL CHECK (owner_type IN ('case', 'stage', 'task')),
    owner_id            UUID NOT NULL,
    storage_key         TEXT NOT NULL,
    encryption_key_id   TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    encryption_status   TEXT NOT NULL DEFAULT 'none',
    encryption_version  INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_owner ON legal.documents (tenant_id, owner_type, owner_id);
