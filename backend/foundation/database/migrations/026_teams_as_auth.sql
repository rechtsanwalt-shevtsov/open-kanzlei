-- Replace roles with team-based authorization (many-to-many membership).

CREATE TABLE platform.user_teams (
    user_id     UUID NOT NULL REFERENCES platform.users (id) ON DELETE CASCADE,
    team_id     UUID NOT NULL REFERENCES platform.teams (id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, team_id)
);

CREATE INDEX idx_user_teams_team_id ON platform.user_teams (team_id);

ALTER TABLE platform.teams ADD COLUMN key TEXT;

UPDATE platform.teams SET key = 'admin' WHERE name = 'Administratoren' AND key IS NULL;
UPDATE platform.teams SET key = 'regular' WHERE name = 'Benutzer' AND key IS NULL;

INSERT INTO platform.teams (tenant_id, name, key)
SELECT t.id, 'Administratoren', 'admin'
FROM platform.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM platform.teams tm
    WHERE tm.tenant_id = t.id AND tm.key = 'admin'
);

INSERT INTO platform.teams (tenant_id, name, key)
SELECT t.id, 'Benutzer', 'regular'
FROM platform.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM platform.teams tm
    WHERE tm.tenant_id = t.id AND tm.key = 'regular'
);

INSERT INTO platform.user_teams (user_id, team_id)
SELECT ur.user_id, tm.id
FROM platform.user_roles ur
JOIN platform.roles r ON r.id = ur.role_id
JOIN platform.users u ON u.id = ur.user_id
JOIN platform.teams tm ON tm.tenant_id = u.tenant_id AND tm.key = r.key
ON CONFLICT DO NOTHING;

INSERT INTO platform.user_teams (user_id, team_id)
SELECT ur.user_id, tm.id
FROM platform.user_roles ur
JOIN platform.roles r ON r.id = ur.role_id AND r.key = 'admin'
JOIN platform.users u ON u.id = ur.user_id
JOIN platform.teams tm ON tm.tenant_id = u.tenant_id AND tm.key = 'regular'
ON CONFLICT DO NOTHING;

INSERT INTO platform.user_teams (user_id, team_id)
SELECT u.id, u.team_id
FROM platform.users u
WHERE u.team_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO platform.user_teams (user_id, team_id)
SELECT u.id, tm.id
FROM platform.users u
JOIN platform.teams tm ON tm.tenant_id = u.tenant_id AND tm.key = 'regular'
WHERE NOT EXISTS (SELECT 1 FROM platform.user_teams ut WHERE ut.user_id = u.id)
ON CONFLICT DO NOTHING;

DROP INDEX IF EXISTS idx_users_team_id;
ALTER TABLE platform.users DROP COLUMN team_id;

CREATE UNIQUE INDEX idx_teams_tenant_key ON platform.teams (tenant_id, key) WHERE key IS NOT NULL;

DROP POLICY IF EXISTS tenant_isolation ON platform.user_roles;
DROP POLICY IF EXISTS tenant_isolation ON platform.roles;

DROP TABLE platform.user_roles;
DROP TABLE platform.roles;

ALTER TABLE platform.user_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON platform.user_teams
    USING (
        EXISTS (
            SELECT 1 FROM platform.users u
            WHERE u.id = user_teams.user_id
              AND u.tenant_id::text = current_setting('app.tenant_id', true)
        )
    );

ALTER TABLE platform.user_teams FORCE ROW LEVEL SECURITY;
