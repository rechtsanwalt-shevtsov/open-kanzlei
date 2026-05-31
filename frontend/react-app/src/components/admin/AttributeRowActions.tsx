import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext.js';

interface AttributeRowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
}

export function AttributeRowActions({ onEdit, onDelete }: AttributeRowActionsProps) {
  const { msg } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="admin-row-actions" ref={wrapRef}>
      <button
        type="button"
        className="admin-row-actions-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={msg('attributesRowActions')}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="admin-row-actions-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(); }}>
            {msg('attributesEdit')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="admin-row-actions-menu--danger"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            {msg('attributesDelete')}
          </button>
        </div>
      )}
    </div>
  );
}
