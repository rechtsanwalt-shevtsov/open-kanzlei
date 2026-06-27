-- Step 2: Replace platform.users with actors + actor_credentials.
-- DB is empty; no data migration required.

-- Credentials for login-capable actors (username globally unique).
CREATE TABLE platform.actor_credentials (
    actor_id                UUID PRIMARY KEY REFERENCES legal.actors (id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    username                TEXT NOT NULL UNIQUE,
    password_hash           TEXT NOT NULL,
    preferred_language      TEXT CHECK (
        preferred_language IS NULL OR preferred_language IN ('de', 'en')
    ),
    preferred_color_theme   TEXT CHECK (
        preferred_color_theme IS NULL
        OR preferred_color_theme IN ('classic', 'modern', 'forest', 'midnight')
    ),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_actor_credentials_tenant ON platform.actor_credentials (tenant_id);

-- Team membership for actors (replaces user_teams).
CREATE TABLE platform.actor_teams (
    actor_id    UUID NOT NULL REFERENCES legal.actors (id) ON DELETE CASCADE,
    team_id     UUID NOT NULL REFERENCES platform.teams (id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (actor_id, team_id)
);

CREATE INDEX idx_actor_teams_team_id ON platform.actor_teams (team_id);

DROP TABLE IF EXISTS platform.user_teams;

-- Sessions reference actors.
ALTER TABLE platform.sessions
    DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;

DROP INDEX IF EXISTS idx_sessions_user_id;

ALTER TABLE platform.sessions
    RENAME COLUMN user_id TO actor_id;

ALTER TABLE platform.sessions
    ADD CONSTRAINT sessions_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES legal.actors (id) ON DELETE CASCADE;

CREATE INDEX idx_sessions_actor_id ON platform.sessions (actor_id);

-- Assignees reference actors.
ALTER TABLE legal.case_assignees
    DROP CONSTRAINT IF EXISTS case_assignees_user_id_fkey;

ALTER TABLE legal.case_assignees
    RENAME COLUMN user_id TO actor_id;

ALTER TABLE legal.case_assignees
    ADD CONSTRAINT case_assignees_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES legal.actors (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_case_assignees_tenant_user;
CREATE INDEX idx_case_assignees_tenant_actor ON legal.case_assignees (tenant_id, actor_id);

ALTER TABLE legal.task_assignees
    DROP CONSTRAINT IF EXISTS task_assignees_user_id_fkey;

ALTER TABLE legal.task_assignees
    RENAME COLUMN user_id TO actor_id;

ALTER TABLE legal.task_assignees
    ADD CONSTRAINT task_assignees_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES legal.actors (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_task_assignees_tenant_user;
CREATE INDEX idx_task_assignees_tenant_actor ON legal.task_assignees (tenant_id, actor_id);

-- App settings / assignments per actor.
ALTER TABLE platform.app_user_settings
    DROP CONSTRAINT IF EXISTS app_user_settings_user_id_fkey;

ALTER TABLE platform.app_user_settings
    RENAME COLUMN user_id TO actor_id;

ALTER TABLE platform.app_user_settings
    ADD CONSTRAINT app_user_settings_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES legal.actors (id) ON DELETE CASCADE;

ALTER TABLE platform.user_app_assignments
    DROP CONSTRAINT IF EXISTS user_app_assignments_user_id_fkey;

ALTER TABLE platform.user_app_assignments
    RENAME TO actor_app_assignments;

ALTER TABLE platform.actor_app_assignments
    RENAME COLUMN user_id TO actor_id;

ALTER TABLE platform.actor_app_assignments
    ADD CONSTRAINT actor_app_assignments_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES legal.actors (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_user_app_assignments_tenant;
CREATE INDEX idx_actor_app_assignments_tenant ON platform.actor_app_assignments (tenant_id);

-- Events: actor_user_id -> actor_id (column + payload key migrated at write time in app).
ALTER TABLE events.domain_events
    DROP CONSTRAINT IF EXISTS domain_events_actor_user_id_fkey;

ALTER TABLE events.domain_events
    RENAME COLUMN actor_user_id TO actor_id;

ALTER TABLE events.domain_events
    ADD CONSTRAINT domain_events_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES legal.actors (id) ON DELETE SET NULL;

-- Attribute definitions created_by references actors.
ALTER TABLE meta.attribute_definitions
    DROP CONSTRAINT IF EXISTS attribute_definitions_created_by_fkey;

ALTER TABLE meta.attribute_definitions
    ADD CONSTRAINT attribute_definitions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES legal.actors (id) ON DELETE SET NULL;

-- Actor team RLS (same pattern as former user_teams).
ALTER TABLE platform.actor_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON platform.actor_teams
    USING (
        EXISTS (
            SELECT 1 FROM legal.actors a
            WHERE a.id = actor_teams.actor_id
              AND a.tenant_id::text = current_setting('app.tenant_id', true)
        )
    );

ALTER TABLE platform.actor_teams FORCE ROW LEVEL SECURITY;

ALTER TABLE platform.actor_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON platform.actor_credentials
    USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE platform.actor_credentials FORCE ROW LEVEL SECURITY;

-- Drop legacy users table.
DROP TABLE IF EXISTS platform.users;
