-- Assign cases and tasks to one or more users (work distribution).

CREATE TABLE legal.case_assignees (
    case_id     UUID NOT NULL REFERENCES legal.cases (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES platform.users (id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (case_id, user_id)
);

CREATE INDEX idx_case_assignees_tenant_user ON legal.case_assignees (tenant_id, user_id);

CREATE TABLE legal.task_assignees (
    task_id     UUID NOT NULL REFERENCES legal.tasks (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES platform.users (id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_task_assignees_tenant_user ON legal.task_assignees (tenant_id, user_id);

ALTER TABLE legal.case_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON legal.case_assignees
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON legal.task_assignees
    USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE legal.case_assignees FORCE ROW LEVEL SECURITY;
ALTER TABLE legal.task_assignees FORCE ROW LEVEL SECURITY;
