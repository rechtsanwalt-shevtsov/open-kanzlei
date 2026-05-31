import { useEffect, useRef, useState } from 'react';
import { LuLanguages } from 'react-icons/lu';
import { useI18n } from '../i18n/I18nContext.js';
import type { Locale } from '../i18n/locale.js';

const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];

export function LanguageSelect() {
  const { locale, setLocale, msg } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function selectLanguage(next: Locale) {
    setLocale(next);
    setOpen(false);
  }

  return (
    <div className="language-select" ref={rootRef}>
      <button
        type="button"
        className="app-nav-icon-btn"
        aria-label={msg('language')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <LuLanguages size={18} aria-hidden />
      </button>
      {open && (
        <div className="language-select-menu" role="menu">
          {LOCALES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitemradio"
              aria-checked={locale === item.value}
              className={locale === item.value ? 'language-select-menu--active' : undefined}
              onClick={() => selectLanguage(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
