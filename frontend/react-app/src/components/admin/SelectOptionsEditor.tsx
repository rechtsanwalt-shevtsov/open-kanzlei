import { useState, type DragEvent } from 'react';
import { LuGripVertical, LuPlus, LuTrash2 } from 'react-icons/lu';
import { useI18n } from '../../i18n/I18nContext.js';
import type { SelectOptionRow } from '../../lib/select-options.js';
import { reorderSelectOptionRows } from '../../lib/select-options.js';

interface SelectOptionsEditorProps {
  rows: SelectOptionRow[];
  onChange: (rows: SelectOptionRow[]) => void;
  disabled?: boolean;
  minRows?: number;
}

export function SelectOptionsEditor({
  rows,
  onChange,
  disabled = false,
  minRows = 1,
}: SelectOptionsEditorProps) {
  const { msg } = useI18n();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function updateRow(index: number, patch: Partial<SelectOptionRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    onChange([...rows, { id: crypto.randomUUID(), key: '', label: '' }]);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function moveRow(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || disabled) return;
    onChange(reorderSelectOptionRows(rows, fromIndex, toIndex));
  }

  function handleDragStart(index: number, event: DragEvent) {
    if (disabled || rows.length <= minRows) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDraggedIndex(index);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragOver(index: number, event: DragEvent) {
    if (draggedIndex === null || draggedIndex === index) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }

  function handleDrop(index: number, event: DragEvent) {
    event.preventDefault();
    const fromRaw = event.dataTransfer.getData('text/plain');
    const fromIndex = fromRaw === '' ? draggedIndex : Number(fromRaw);
    if (fromIndex === null || Number.isNaN(fromIndex)) return;
    moveRow(fromIndex, index);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  const dragEnabled = !disabled && rows.length > minRows;

  return (
    <div className="select-options-editor">
      <table className="admin-table admin-table--compact">
        <thead>
          <tr>
            <th className="admin-table-col-drag" aria-hidden />
            <th>{msg('cmdStatusOptionLabel')}</th>
            <th className="admin-table-col-actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className={[
                draggedIndex === index ? 'select-options-row--dragging' : '',
                dragOverIndex === index ? 'select-options-row--drag-over' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined}
              onDragOver={(event) => handleDragOver(index, event)}
              onDragLeave={() => {
                if (dragOverIndex === index) setDragOverIndex(null);
              }}
              onDrop={(event) => handleDrop(index, event)}
            >
              <td className="admin-table-col-drag">
                <span
                  role="button"
                  tabIndex={dragEnabled ? 0 : -1}
                  className="select-options-drag-handle"
                  draggable={dragEnabled}
                  aria-disabled={!dragEnabled}
                  aria-label={msg('cmdStatusOptionDrag')}
                  title={msg('cmdStatusOptionDrag')}
                  onDragStart={(event) => handleDragStart(index, event)}
                  onDragEnd={handleDragEnd}
                >
                  <LuGripVertical size={16} aria-hidden />
                </span>
              </td>
              <td>
                <input
                  className="admin-table-inline-input"
                  value={row.label}
                  disabled={disabled}
                  placeholder={msg('cmdStatusOptionLabel')}
                  onChange={(e) => updateRow(index, { label: e.target.value })}
                />
              </td>
              <td className="admin-table-col-actions">
                <button
                  type="button"
                  className="button-icon button-icon--danger"
                  title={msg('attributesDelete')}
                  aria-label={msg('attributesDelete')}
                  disabled={disabled || rows.length <= minRows}
                  onClick={() => removeRow(index)}
                >
                  <LuTrash2 size={16} aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="button-outline select-options-add"
        disabled={disabled}
        onClick={addRow}
      >
        <LuPlus size={16} aria-hidden /> {msg('cmdStatusOptionAdd')}
      </button>
    </div>
  );
}
