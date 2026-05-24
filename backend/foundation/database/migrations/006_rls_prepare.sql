-- Row Level Security preparation (Konzept.txt §10)
-- Policies are defined but not enforced until Step 2 enables RLS per session.

ALTER TABLE platform.tenant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE events.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE legal.case_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.stage_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.task_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.case_model_stage_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE meta.attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta.attribute_values ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: current_setting('app.tenant_id') set per request in Step 2.
CREATE POLICY tenant_isolation ON platform.tenant_profiles
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON platform.users
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON platform.roles
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON platform.user_roles
    USING (
        EXISTS (
            SELECT 1 FROM platform.users u
            WHERE u.id = user_roles.user_id
              AND u.tenant_id::text = current_setting('app.tenant_id', true)
        )
    );

CREATE POLICY tenant_isolation ON platform.sessions
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON events.domain_events
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON events.outbox_events
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON events.webhook_subscriptions
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.case_models
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.stage_models
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.task_models
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.case_model_stage_models
    USING (
        EXISTS (
            SELECT 1 FROM legal.case_models cm
            WHERE cm.id = case_model_stage_models.case_model_id
              AND cm.tenant_id::text = current_setting('app.tenant_id', true)
        )
    );

CREATE POLICY tenant_isolation ON legal.cases
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.stages
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.tasks
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.documents
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON meta.attribute_definitions
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON meta.attribute_values
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Migration tracking
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
