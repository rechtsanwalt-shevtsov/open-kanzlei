-- App group assignments per team and optional per-user overrides.

CREATE TABLE platform.team_app_assignments (
    tenant_id    UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    team_id      UUID NOT NULL REFERENCES platform.teams (id) ON DELETE CASCADE,
    assignments  JSONB NOT NULL DEFAULT '{
        "flight_level_0": null,
        "flight_level_1": null,
        "flight_level_2": null,
        "flight_level_3": null,
        "unassigned": []
    }'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, team_id)
);

CREATE TABLE platform.user_app_assignments (
    tenant_id    UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES platform.users (id) ON DELETE CASCADE,
    assignments  JSONB NOT NULL DEFAULT '{
        "flight_level_0": null,
        "flight_level_1": null,
        "flight_level_2": null,
        "flight_level_3": null,
        "unassigned": []
    }'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX idx_team_app_assignments_tenant ON platform.team_app_assignments (tenant_id);
CREATE INDEX idx_user_app_assignments_tenant ON platform.user_app_assignments (tenant_id);

-- Migrate existing team activations: active apps become "unassigned" selections.
INSERT INTO platform.team_app_assignments (tenant_id, team_id, assignments)
SELECT
    ata.tenant_id,
    ata.team_id,
    jsonb_build_object(
        'flight_level_0', NULL,
        'flight_level_1', NULL,
        'flight_level_2', NULL,
        'flight_level_3', NULL,
        'unassigned', COALESCE(
            jsonb_agg(ata.app_key ORDER BY ata.app_key) FILTER (WHERE ata.status = 'active'),
            '[]'::jsonb
        )
    )
FROM platform.app_team_activations ata
GROUP BY ata.tenant_id, ata.team_id
ON CONFLICT (tenant_id, team_id) DO NOTHING;

ALTER TABLE platform.team_app_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.user_app_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON platform.team_app_assignments
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON platform.user_app_assignments
    USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE platform.team_app_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE platform.user_app_assignments FORCE ROW LEVEL SECURITY;
