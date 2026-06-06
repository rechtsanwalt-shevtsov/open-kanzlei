-- Per-option locale labels for single_select / multi_select attribute definitions
-- See Konzept.txt §7 (Plattform-Standard-Instanzattribut status)

ALTER TABLE meta.attribute_definitions
    ADD COLUMN IF NOT EXISTS select_option_translations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Align legacy default with platform case status seed
ALTER TABLE legal.cases
    ALTER COLUMN status SET DEFAULT 'not_started';
