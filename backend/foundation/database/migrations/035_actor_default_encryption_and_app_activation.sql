-- Default actor instance attributes: zero-knowledge storage (tenant may change later in designer).
UPDATE meta.attribute_definitions
SET encryption_mode = 'zero_knowledge', updated_at = now()
WHERE owner_type = 'actor_model'
  AND definition_scope = 'instance'
  AND key IN ('name', 'first_name', 'email', 'phone', 'address')
  AND encryption_mode <> 'zero_knowledge';

-- Activate Actors app for teams that already use Cases (same work area).
UPDATE platform.team_app_assignments taa
SET assignments = jsonb_set(
      assignments,
      '{unassigned}',
      (
        SELECT COALESCE(jsonb_agg(DISTINCT elem ORDER BY elem), '[]'::jsonb)
        FROM (
          SELECT jsonb_array_elements_text(taa.assignments->'unassigned') AS elem
          UNION ALL
          SELECT 'actors'
        ) s
      ),
      true
    ),
    updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(taa.assignments->'unassigned') elem
  WHERE elem = 'cases'
)
AND NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(taa.assignments->'unassigned') elem
  WHERE elem = 'actors'
);

INSERT INTO platform.app_team_activations (tenant_id, team_id, app_key, status)
SELECT ata.tenant_id, ata.team_id, 'actors', 'active'
FROM platform.app_team_activations ata
WHERE ata.app_key = 'cases' AND ata.status = 'active'
ON CONFLICT (tenant_id, team_id, app_key) DO UPDATE
  SET status = 'active', updated_at = now();
