-- Standard instance attribute definitions on all existing task models (weight, predecessor_task_id)

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
    default_value
)
SELECT
    tm.tenant_id,
    'task_model',
    tm.id,
    'instance',
    seed.key,
    seed.data_type,
    'server_readable',
    seed.translations::jsonb,
    false,
    '[]'::jsonb,
    NULL
FROM legal.task_models tm
CROSS JOIN (
    VALUES
        (
            'weight',
            'number',
            '{"de": "Gewicht", "en": "Weight"}'
        ),
        (
            'predecessor_task_id',
            'text',
            '{"de": "Vorgängeraufgabe", "en": "Predecessor task"}'
        )
) AS seed(key, data_type, translations)
WHERE NOT EXISTS (
    SELECT 1
    FROM meta.attribute_definitions ad
    WHERE ad.tenant_id = tm.tenant_id
      AND ad.owner_type = 'task_model'
      AND ad.owner_id = tm.id
      AND ad.definition_scope = 'instance'
      AND ad.key = seed.key
);
