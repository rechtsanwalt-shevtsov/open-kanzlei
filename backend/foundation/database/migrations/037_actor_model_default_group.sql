-- Default platform group (admin/regular) per actor model; instances inherit via group attribute.

ALTER TABLE legal.actor_models
    ADD COLUMN default_group_key TEXT;

ALTER TABLE legal.actor_models
    ADD CONSTRAINT actor_models_default_group_key_check
    CHECK (default_group_key IS NULL OR default_group_key IN ('admin', 'regular'));

UPDATE legal.actor_models
SET default_group_key = 'regular'
WHERE default_group_key IS NULL;
