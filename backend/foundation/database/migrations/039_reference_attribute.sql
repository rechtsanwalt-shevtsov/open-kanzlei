-- Reference attribute type: stores entity UUID, configured via reference_target_type/model.

ALTER TABLE meta.attribute_definitions
    ADD COLUMN reference_target_type TEXT,
    ADD COLUMN reference_target_model_id UUID;

ALTER TABLE meta.attribute_definitions
    ADD CONSTRAINT attribute_definitions_reference_target_type_check
    CHECK (
        reference_target_type IS NULL
        OR reference_target_type IN ('actor', 'case', 'task')
    );
