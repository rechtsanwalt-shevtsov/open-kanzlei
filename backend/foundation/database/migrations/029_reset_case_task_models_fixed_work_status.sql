-- Reset case/task models and instances; platform work status is fixed to 3 values (no deferred).

DELETE FROM legal.task_assignees;
DELETE FROM legal.tasks;
DELETE FROM legal.case_assignees;
DELETE FROM legal.cases;

DELETE FROM meta.attribute_values
WHERE owner_type IN ('case', 'task', 'case_model', 'task_model');

DELETE FROM platform.app_model_attribute_bindings
WHERE owner_type IN ('case_model', 'task_model');

DELETE FROM meta.attribute_definitions
WHERE owner_type IN ('case_model', 'task_model');

DELETE FROM legal.case_model_task_model_exclusions;
DELETE FROM legal.task_models;
DELETE FROM legal.case_models;
