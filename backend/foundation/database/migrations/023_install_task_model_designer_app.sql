-- Install Task Model Designer app for existing tenants
INSERT INTO platform.app_installations (tenant_id, app_key, version, status)
SELECT id, 'task-model-designer', '1.0.0', 'active'
FROM platform.tenants
ON CONFLICT (tenant_id, app_key) DO NOTHING;
