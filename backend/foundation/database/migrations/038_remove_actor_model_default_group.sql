-- The default group is now stored only on the actor instance "group" attribute.

ALTER TABLE legal.actor_models
    DROP CONSTRAINT IF EXISTS actor_models_default_group_key_check;

ALTER TABLE legal.actor_models
    DROP COLUMN IF EXISTS default_group_key;
