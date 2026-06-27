-- Remove completed task instances (legacy data without reliable completed_at).

UPDATE legal.tasks t
SET
    predecessor_task_ids = COALESCE((
        SELECT array_agg(elem)
        FROM unnest(t.predecessor_task_ids) AS elem
        WHERE elem NOT IN (SELECT id FROM legal.tasks WHERE status = 'completed')
    ), '{}'),
    dependent_task_ids = COALESCE((
        SELECT array_agg(elem)
        FROM unnest(t.dependent_task_ids) AS elem
        WHERE elem NOT IN (SELECT id FROM legal.tasks WHERE status = 'completed')
    ), '{}')
WHERE status <> 'completed';

DELETE FROM meta.attribute_values
WHERE owner_type = 'task'
  AND owner_id IN (SELECT id FROM legal.tasks WHERE status = 'completed');

DELETE FROM legal.tasks
WHERE status = 'completed';
