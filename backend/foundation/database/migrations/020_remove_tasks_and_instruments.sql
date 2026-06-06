-- Remove Task and Instrument entities (formerly Stage/Task in original concept).
-- Platform scope is now case_models + cases only.

DELETE FROM legal.documents WHERE owner_type IN ('task', 'instrument');

DELETE FROM meta.attribute_values
WHERE owner_type IN ('task', 'instrument', 'task_model', 'instrument_model');

DELETE FROM meta.attribute_definitions
WHERE owner_type IN ('task_model', 'instrument_model');

DROP TABLE IF EXISTS legal.task_assignees;
DROP TABLE IF EXISTS legal.instruments;
DROP TABLE IF EXISTS legal.tasks;
DROP TABLE IF EXISTS legal.instrument_models;
DROP TABLE IF EXISTS legal.case_model_task_models;
DROP TABLE IF EXISTS legal.task_models;

ALTER TABLE legal.documents DROP CONSTRAINT IF EXISTS documents_owner_type_check;
ALTER TABLE legal.documents
    ADD CONSTRAINT documents_owner_type_check
    CHECK (owner_type IN ('case'));

ALTER TABLE meta.attribute_definitions DROP CONSTRAINT IF EXISTS attribute_definitions_owner_type_check;
ALTER TABLE meta.attribute_definitions
    ADD CONSTRAINT attribute_definitions_owner_type_check
    CHECK (owner_type IN ('case_model'));

ALTER TABLE meta.attribute_values DROP CONSTRAINT IF EXISTS attribute_values_owner_type_check;
ALTER TABLE meta.attribute_values
    ADD CONSTRAINT attribute_values_owner_type_check
    CHECK (owner_type IN ('case', 'case_model'));
