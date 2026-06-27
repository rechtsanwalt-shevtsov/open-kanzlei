-- Tracks which apps require or provide attribute definitions on models.

CREATE TABLE platform.app_model_attribute_bindings (
    tenant_id           UUID NOT NULL REFERENCES platform.tenants (id) ON DELETE CASCADE,
    app_key             TEXT NOT NULL,
    owner_type          TEXT NOT NULL
                        CHECK (owner_type IN ('case_model', 'task_model')),
    owner_id            UUID NOT NULL,
    definition_scope    TEXT NOT NULL DEFAULT 'instance'
                        CHECK (definition_scope IN ('model', 'instance')),
    attribute_key       TEXT NOT NULL,
    binding_role        TEXT NOT NULL
                        CHECK (binding_role IN ('requires', 'provides')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, app_key, owner_type, owner_id, definition_scope, attribute_key)
);

CREATE INDEX idx_app_model_attribute_bindings_model
    ON platform.app_model_attribute_bindings (tenant_id, owner_type, owner_id);

CREATE INDEX idx_app_model_attribute_bindings_app
    ON platform.app_model_attribute_bindings (tenant_id, app_key);

ALTER TABLE platform.app_model_attribute_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON platform.app_model_attribute_bindings
    USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE platform.app_model_attribute_bindings FORCE ROW LEVEL SECURITY;
