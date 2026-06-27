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
  /** Fixed platform options: labels editable, keys/order immutable. */
  labelsOnly?: boolean;
  /** Shared-registry options: labels editable, keys immutable, may add custom options. */
  lockedOptionKeys?: readonly string[];
}

export function SelectOptionsEditor({
  rows,
  onChange,
  disabled = false,
  minRows = 1,
  labelsOnly = false,
  lockedOptionKeys = [],
}: SelectOptionsEditorProps) {
  const { msg } = useI18n();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const lockedSet = new Set(lockedOptionKeys);
  const partialLock = !labelsOnly && lockedOptionKeys.length > 0;

  function isRowLocked(row: SelectOptionRow): boolean {
    return lockedSet.has(row.key);
  }

  function updateRow(index: number, patch: Partial<SelectOptionRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    onChange([...rows, { id: crypto.randomUUID(), key: '', label: '' }]);
  }

  function removeRow(index: number) {
    const row = rows[index];
    if (row && isRowLocked(row)) return;
    onChange(rows.filter((_, i) => i !== index));
  }

  function moveRow(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || disabled) return;
    const fromRow = rows[fromIndex];
    const toRow = rows[toIndex];
    if ((fromRow && isRowLocked(fromRow)) || (toRow && isRowLocked(toRow))) return;
    onChange(reorderSelectOptionRows(rows, fromIndex, toIndex));
  }

  function handleDragStart(index: number, event: DragEvent) {
    const row = rows[index];
    if (disabled || !row || isRowLocked(row)) return;
    if (!labelsOnly && rows.length <= minRows) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDraggedIndex(index);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragOver(index: number, event: DragEvent) {
    const row = rows[index];
    if (draggedIndex === null || draggedIndex === index || (row && isRowLocked(row))) return;
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

  const showKeyColumn = labelsOnly || partialLock;
  const showActionsColumn = !labelsOnly;
  const dragEnabled = !disabled && !labelsOnly;

  return (
    <div className="select-options-editor">
      <table className="admin-table admin-table--compact">
        <thead>
          <tr>
            {!labelsOnly && <th className="admin-table-col-drag" aria-hidden />}
            {showKeyColumn && <th>{msg('cmdStatusOptionKey')}</th>}
            <th>{msg('cmdStatusOptionLabel')}</th>
            {showActionsColumn && <th className="admin-table-col-actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const locked = isRowLocked(row);
            const rowDragEnabled = dragEnabled && !locked && rows.length > minRows;
            return (
              <tr
                key={row.id}
                className={
                  !labelsOnly
                    ? [
                        draggedIndex === index ? 'select-options-row--dragging' : '',
                        dragOverIndex === index ? 'select-options-row--drag-over' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    : undefined
                }
                onDragOver={labelsOnly ? undefined : (event) => handleDragOver(index, event)}
                onDragLeave={
                  labelsOnly
                    ? undefined
                    : () => {
                        if (dragOverIndex === index) setDragOverIndex(null);
                      }
                }
                onDrop={labelsOnly ? undefined : (event) => handleDrop(index, event)}
              >
                {!labelsOnly && (
                  <td className="admin-table-col-drag">
                    <span
                      role="button"
                      tabIndex={rowDragEnabled ? 0 : -1}
                      className="select-options-drag-handle"
                      draggable={rowDragEnabled}
                      aria-disabled={!rowDragEnabled}
                      aria-label={msg('cmdStatusOptionDrag')}
                      title={msg('cmdStatusOptionDrag')}
                      onDragStart={(event) => handleDragStart(index, event)}
                      onDragEnd={handleDragEnd}
                    >
                      <LuGripVertical size={16} aria-hidden />
                    </span>
                  </td>
                )}
                {showKeyColumn && (
                  <td>
                    {locked || labelsOnly ? <code>{row.key}</code> : null}
                  </td>
                )}
                <td>
                  <input
                    className="admin-table-inline-input"
                    value={row.label}
                    disabled={disabled}
                    placeholder={msg('cmdStatusOptionLabel')}
                    onChange={(e) => updateRow(index, { label: e.target.value })}
                  />
                </td>
                {showActionsColumn && (
                  <td className="admin-table-col-actions">
                    <button
                      type="button"
                      className="button-icon button-icon--danger"
                      title={msg('attributesDelete')}
                      aria-label={msg('attributesDelete')}
                      disabled={disabled || locked || rows.length <= minRows}
                      onClick={() => removeRow(index)}
                    >
                      <LuTrash2 size={16} aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!labelsOnly && (
        <button
          type="button"
          className="button-outline select-options-add"
          disabled={disabled}
          onClick={addRow}
        >
          <LuPlus size={16} aria-hidden /> {msg('cmdStatusOptionAdd')}
        </button>
      )}
    </div>
  );
}
