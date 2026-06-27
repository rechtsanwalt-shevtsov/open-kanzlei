-- Completion timestamp for task instances (set when status becomes completed).

ALTER TABLE legal.tasks
    ADD COLUMN completed_at TIMESTAMPTZ;

UPDATE legal.tasks
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

CREATE INDEX idx_tasks_tenant_completed_at
    ON legal.tasks (tenant_id, completed_at DESC NULLS LAST)
    WHERE completed_at IS NOT NULL;
