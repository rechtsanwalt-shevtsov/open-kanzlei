-- Platform instance attribute "title" (zero_knowledge, required) on all existing case models.

INSERT INTO meta.attribute_definitions (
    tenant_id,
    owner_type,
    owner_id,
    definition_scope,
    key,
    data_type,
    encryption_mode,
    translations,
    is_required,
    select_options,
    select_option_translations,
    default_value
)
SELECT
    cm.tenant_id,
    'case_model',
    cm.id,
    'instance',
    'title',
    'text',
    'zero_knowledge',
    '{"de": "Titel", "en": "Title"}'::jsonb,
    true,
    '[]'::jsonb,
    '{}'::jsonb,
    NULL
FROM legal.case_models cm
WHERE NOT EXISTS (
    SELECT 1
    FROM meta.attribute_definitions ad
    WHERE ad.tenant_id = cm.tenant_id
      AND ad.owner_type = 'case_model'
      AND ad.owner_id = cm.id
      AND ad.definition_scope = 'instance'
      AND ad.key = 'title'
);
