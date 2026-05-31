import { COLOR_THEMES, THEME_PREVIEWS, type ColorTheme } from '../lib/color-themes.js';
import { useI18n } from '../i18n/I18nContext.js';
import type { MessageKey } from '../i18n/messages.js';

const THEME_LABEL_KEYS: Record<ColorTheme, MessageKey> = {
  classic: 'themeClassic',
  modern: 'themeModern',
  forest: 'themeForest',
  midnight: 'themeMidnight',
};

interface ThemeSelectProps {
  name: string;
  value: ColorTheme | 'tenant-default';
  onChange: (value: ColorTheme | 'tenant-default') => void;
  allowTenantDefault?: boolean;
  disabled?: boolean;
}

export function ThemeSelect({
  name,
  value,
  onChange,
  allowTenantDefault = false,
  disabled = false,
}: ThemeSelectProps) {
  const { msg } = useI18n();

  return (
    <div className="theme-select" role="radiogroup" aria-label={msg('colorTheme')}>
      {allowTenantDefault && (
        <label className={`theme-option${value === 'tenant-default' ? ' theme-option--active' : ''}`}>
          <input
            type="radio"
            name={name}
            value="tenant-default"
            checked={value === 'tenant-default'}
            disabled={disabled}
            onChange={() => onChange('tenant-default')}
          />
          <span className="theme-option-body theme-option-body--default">
            <span className="theme-option-label">{msg('themeUseTenantDefault')}</span>
          </span>
        </label>
      )}

      {COLOR_THEMES.map((themeId) => {
        const preview = THEME_PREVIEWS[themeId];
        return (
          <label
            key={themeId}
            className={`theme-option${value === themeId ? ' theme-option--active' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={themeId}
              checked={value === themeId}
              disabled={disabled}
              onChange={() => onChange(themeId)}
            />
            <span className="theme-option-body">
              <span className="theme-swatches" aria-hidden>
                <span style={{ background: preview.primary }} />
                <span style={{ background: preview.secondary }} />
                <span style={{ background: preview.accent }} />
                <span style={{ background: preview.background }} />
              </span>
              <span className="theme-option-label">{msg(THEME_LABEL_KEYS[themeId])}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
