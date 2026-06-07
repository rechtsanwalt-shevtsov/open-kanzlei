-- Team-based app activation (replaces tenant-wide app_installations.status for access control).

CREATE TABLE platform.app_team_activations (
    tenant_id   UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    team_id     UUID NOT NULL REFERENCES platform.teams (id) ON DELETE CASCADE,
    app_key     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'inactive'
                CHECK (status IN ('active', 'inactive')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, team_id, app_key)
);

CREATE INDEX idx_app_team_activations_tenant_app
    ON platform.app_team_activations (tenant_id, app_key);

INSERT INTO platform.app_team_activations (tenant_id, team_id, app_key, status)
SELECT ai.tenant_id, t.id, ai.app_key,
       CASE WHEN ai.status = 'active' THEN 'active' ELSE 'inactive' END
FROM platform.app_installations ai
JOIN platform.teams t ON t.tenant_id = ai.tenant_id
ON CONFLICT (tenant_id, team_id, app_key) DO NOTHING;

ALTER TABLE platform.app_team_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON platform.app_team_activations
    USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE platform.app_team_activations FORCE ROW LEVEL SECURITY;
