-- Teams and user membership (Konzept.txt §10 — Rechteverwaltung vorbereiten)

CREATE TABLE platform.teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_teams_tenant_id ON platform.teams (tenant_id);

ALTER TABLE platform.users
    ADD COLUMN team_id UUID REFERENCES platform.teams (id) ON DELETE SET NULL;

CREATE INDEX idx_users_team_id ON platform.users (team_id);

-- Standardrolle „regular“ für bestehende Mandanten
INSERT INTO platform.roles (tenant_id, key)
SELECT t.id, 'regular'
FROM platform.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM platform.roles r
    WHERE r.tenant_id = t.id AND r.key = 'regular'
);

ALTER TABLE platform.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON platform.teams
    USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE platform.teams FORCE ROW LEVEL SECURITY;
