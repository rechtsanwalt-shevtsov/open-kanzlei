-- Case model: description_translations and status enum (Konzept.txt §18.6)

ALTER TABLE legal.case_models
    ADD COLUMN IF NOT EXISTS description_translations JSONB NOT NULL DEFAULT '{}';

ALTER TABLE legal.case_models DROP CONSTRAINT IF EXISTS case_models_status_check;

UPDATE legal.case_models
SET status = 'active'
WHERE status NOT IN ('draft', 'active', 'archived');

ALTER TABLE legal.case_models
    ADD CONSTRAINT case_models_status_check
    CHECK (status IN ('draft', 'active', 'archived'));
