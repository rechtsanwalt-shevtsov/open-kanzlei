-- Attribute scopes, extended types, case model description
-- See docs/event-catalog.md (attribute definitions)

ALTER TABLE legal.case_models
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

UPDATE legal.case_models
SET description = COALESCE(
    NULLIF(TRIM(description_translations->>'de'), ''),
    NULLIF(TRIM(description_translations->>'en'), ''),
    description
)
WHERE description = '' AND description_translations IS NOT NULL;

ALTER TABLE meta.attribute_definitions
    ADD COLUMN definition_scope TEXT NOT NULL DEFAULT 'instance'
        CHECK (definition_scope IN ('model', 'instance')),
    ADD COLUMN is_required BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN select_options JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN default_value JSONB;

ALTER TABLE meta.attribute_definitions
    DROP CONSTRAINT IF EXISTS attribute_definitions_tenant_id_owner_type_owner_id_key_key;

ALTER TABLE meta.attribute_definitions
    ADD CONSTRAINT attribute_definitions_owner_scope_key_unique
    UNIQUE (tenant_id, owner_type, owner_id, definition_scope, key);

ALTER TABLE meta.attribute_values DROP CONSTRAINT IF EXISTS attribute_values_owner_type_check;

ALTER TABLE meta.attribute_values
    ADD CONSTRAINT attribute_values_owner_type_check
    CHECK (owner_type IN ('case', 'task', 'instrument', 'case_model', 'task_model', 'instrument_model'));

CREATE INDEX idx_attribute_definitions_scope
    ON meta.attribute_definitions (tenant_id, owner_type, owner_id, definition_scope);
