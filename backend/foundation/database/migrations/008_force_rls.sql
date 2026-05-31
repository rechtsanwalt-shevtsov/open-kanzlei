-- Enforce RLS for table owners (Konzept.txt §10).
-- Without FORCE, the migration user bypasses policies.

ALTER TABLE platform.tenant_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE platform.users FORCE ROW LEVEL SECURITY;
ALTER TABLE platform.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE platform.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE platform.sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE events.domain_events FORCE ROW LEVEL SECURITY;
ALTER TABLE events.outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE events.webhook_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE legal.case_models FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.stage_models FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.task_models FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.case_model_stage_models FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.cases FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.stages FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.documents FORCE ROW LEVEL SECURITY;

ALTER TABLE meta.attribute_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE meta.attribute_values FORCE ROW LEVEL SECURITY;
