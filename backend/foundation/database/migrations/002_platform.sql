-- Platform: tenants, users, roles, sessions
-- See Konzept.txt §10, §11

CREATE TABLE platform.tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT NOT NULL UNIQUE,
    default_language TEXT NOT NULL DEFAULT 'de' CHECK (default_language IN ('de', 'en')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform.tenant_profiles (
    tenant_id       UUID PRIMARY KEY REFERENCES platform.tenants (id) ON DELETE CASCADE,
    firm_name       TEXT NOT NULL,
    settings        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform.users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    username            TEXT NOT NULL,
    email               TEXT,
    password_hash       TEXT NOT NULL,
    preferred_language  TEXT CHECK (preferred_language IS NULL OR preferred_language IN ('de', 'en')),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, username)
);

CREATE INDEX idx_users_tenant_id ON platform.users (tenant_id);

CREATE TABLE platform.roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, key)
);

CREATE TABLE platform.user_roles (
    user_id     UUID NOT NULL REFERENCES platform.users (id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES platform.roles (id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE platform.sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES platform.users (id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id ON platform.sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON platform.sessions (expires_at);
