-- User UI color theme preference (overrides tenant default when set)

ALTER TABLE platform.users
    ADD COLUMN preferred_color_theme TEXT
    CHECK (
        preferred_color_theme IS NULL
        OR preferred_color_theme IN ('classic', 'modern', 'forest', 'midnight')
    );

-- Default tenant theme for existing tenants
UPDATE platform.tenant_profiles
SET settings = settings || '{"color_theme": "classic"}'::jsonb
WHERE NOT (settings ? 'color_theme');
