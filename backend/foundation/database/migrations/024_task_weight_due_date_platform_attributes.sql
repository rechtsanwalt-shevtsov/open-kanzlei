-- Platform instance attributes weight and due_date on all existing task models.

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
    tm.tenant_id,
    'task_model',
    tm.id,
    'instance',
    seed.key,
    seed.data_type,
    seed.encryption_mode,
    seed.translations::jsonb,
    seed.is_required,
    '[]'::jsonb,
    '{}'::jsonb,
    NULL
FROM legal.task_models tm
CROSS JOIN (
    VALUES
        (
            'weight',
            'number',
            'server_readable',
            false,
            '{"de": "Gewicht", "en": "Weight"}'
        ),
        (
            'due_date',
            'date',
            'server_readable',
            false,
            '{"de": "Fristende", "en": "Due date"}'
        )
) AS seed(key, data_type, encryption_mode, is_required, translations)
WHERE NOT EXISTS (
    SELECT 1
    FROM meta.attribute_definitions ad
    WHERE ad.tenant_id = tm.tenant_id
      AND ad.owner_type = 'task_model'
      AND ad.owner_id = tm.id
      AND ad.definition_scope = 'instance'
      AND ad.key = seed.key
);
