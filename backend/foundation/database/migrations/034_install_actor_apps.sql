-- Install Actor Model Designer and Actors apps for existing tenants.

INSERT INTO platform.app_installations (tenant_id, app_key, version, status)
SELECT id, 'actor-model-designer', '1.0.0', 'active'
FROM platform.tenants
ON CONFLICT (tenant_id, app_key) DO NOTHING;

INSERT INTO platform.app_installations (tenant_id, app_key, version, status)
SELECT id, 'actors', '1.0.0', 'active'
FROM platform.tenants
ON CONFLICT (tenant_id, app_key) DO NOTHING;
