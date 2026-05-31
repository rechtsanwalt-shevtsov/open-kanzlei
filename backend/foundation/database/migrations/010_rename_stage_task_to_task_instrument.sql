-- Terminology: Stage → Task, Task → Instrument (Konzept)
-- Order avoids table name collisions (task_models / tasks already exist).

-- 1) Former task_models / tasks → instrument_*
ALTER TABLE legal.task_models RENAME TO instrument_models;
ALTER TABLE legal.instrument_models RENAME COLUMN stage_model_id TO task_model_id;

ALTER TABLE legal.tasks RENAME TO instruments;
ALTER TABLE legal.instruments RENAME COLUMN stage_id TO task_id;
ALTER TABLE legal.instruments RENAME COLUMN task_model_id TO instrument_model_id;

ALTER INDEX legal.idx_tasks_stage RENAME TO idx_instruments_task;

-- 2) Former stage_models / stages → task_*
ALTER TABLE legal.stage_models RENAME TO task_models;
ALTER TABLE legal.stages RENAME TO tasks;
ALTER TABLE legal.tasks RENAME COLUMN stage_model_id TO task_model_id;

ALTER INDEX legal.idx_stages_case RENAME TO idx_tasks_case;

-- 3) Case ↔ task model links
ALTER TABLE legal.case_model_stage_models RENAME TO case_model_task_models;
ALTER TABLE legal.case_model_task_models RENAME COLUMN stage_model_id TO task_model_id;

-- 4) documents.owner_type
ALTER TABLE legal.documents DROP CONSTRAINT IF EXISTS documents_owner_type_check;
UPDATE legal.documents SET owner_type = 'instrument' WHERE owner_type = 'task';
UPDATE legal.documents SET owner_type = 'task' WHERE owner_type = 'stage';
ALTER TABLE legal.documents
    ADD CONSTRAINT documents_owner_type_check
    CHECK (owner_type IN ('case', 'task', 'instrument'));

-- 5) meta attribute owner_type values
ALTER TABLE meta.attribute_definitions DROP CONSTRAINT IF EXISTS attribute_definitions_owner_type_check;
UPDATE meta.attribute_definitions SET owner_type = 'instrument_model' WHERE owner_type = 'task_model';
UPDATE meta.attribute_definitions SET owner_type = 'task_model' WHERE owner_type = 'stage_model';
ALTER TABLE meta.attribute_definitions
    ADD CONSTRAINT attribute_definitions_owner_type_check
    CHECK (owner_type IN ('case_model', 'task_model', 'instrument_model'));

ALTER TABLE meta.attribute_values DROP CONSTRAINT IF EXISTS attribute_values_owner_type_check;
UPDATE meta.attribute_values SET owner_type = 'instrument' WHERE owner_type = 'task';
UPDATE meta.attribute_values SET owner_type = 'task' WHERE owner_type = 'stage';
ALTER TABLE meta.attribute_values
    ADD CONSTRAINT attribute_values_owner_type_check
    CHECK (owner_type IN ('case', 'task', 'instrument'));
