-- Platform apps: installations and settings (Konzept.txt §18)

CREATE TABLE platform.app_installations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    app_key         TEXT NOT NULL,
    version         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive')),
    installed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, app_key)
);

CREATE INDEX idx_app_installations_tenant ON platform.app_installations (tenant_id);

CREATE TABLE platform.app_tenant_settings (
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    app_key         TEXT NOT NULL,
    settings        JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, app_key)
);

CREATE TABLE platform.app_user_settings (
    tenant_id       UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES platform.users (id) ON DELETE CASCADE,
    app_key         TEXT NOT NULL,
    settings        JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id, app_key)
);

-- Backfill first-party app for existing tenants
INSERT INTO platform.app_installations (tenant_id, app_key, version, status)
SELECT id, 'case-model-designer', '1.0.0', 'active'
FROM platform.tenants
ON CONFLICT (tenant_id, app_key) DO NOTHING;
