import { useId } from 'react';
import { useI18n } from '@shell/i18n/I18nContext.js';
import { SelectOptionsEditor } from '@shell/components/admin/SelectOptionsEditor.js';
import type { DataType } from '@shell/lib/attribute-api.js';
import {
  DATA_TYPES,
  dataTypeMessageKey,
  isSelectDataType,
} from '@shell/lib/data-type-label.js';
import {
  buildSelectOptionsPayload,
  createEmptySelectOptionRow,
  normalizeSelectOptionRows,
  type SelectOptionRow,
} from '@shell/lib/select-options.js';

export type CaseFieldDraft = {
  id: string;
  name: string;
  dataType: DataType;
  isRequired: boolean;
  optionRows: SelectOptionRow[];
};

function newDraft(): CaseFieldDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    dataType: 'text',
    isRequired: false,
    optionRows: [],
  };
}

export function createEmptyCaseFieldDraft(): CaseFieldDraft {
  return newDraft();
}

interface CaseFieldsEditorProps {
  fields: CaseFieldDraft[];
  onChange: (fields: CaseFieldDraft[]) => void;
}

export function CaseFieldsEditor({ fields, onChange }: CaseFieldsEditorProps) {
  const { msg } = useI18n();
  const sectionId = useId();

  function updateField(id: string, patch: Partial<CaseFieldDraft>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  function handleDataTypeChange(id: string, dataType: DataType) {
    const field = fields.find((f) => f.id === id);
    if (!field) return;
    const patch: Partial<CaseFieldDraft> = { dataType };
    if (isSelectDataType(dataType) && field.optionRows.length === 0) {
      patch.optionRows = [createEmptySelectOptionRow()];
    }
    updateField(id, patch);
  }

  return (
    <fieldset className="cmd-case-fields-editor" aria-labelledby={sectionId}>
      <legend id={sectionId}>{msg('cmdTabCaseFields')}</legend>
      <p className="admin-table-muted">{msg('cmdCreateCaseFieldsHint')}</p>

      {fields.length === 0 ? (
        <p className="admin-table-muted">{msg('cmdCreateCaseFieldsEmpty')}</p>
      ) : (
        <ul className="cmd-case-fields-list">
          {fields.map((field, index) => {
            const showOptions = isSelectDataType(field.dataType);
            return (
              <li key={field.id} className="cmd-case-field-row">
                <div className="cmd-case-field-row-header">
                  <span className="cmd-case-field-row-num">
                    {index + 1}.
                  </span>
                  <button
                    type="button"
                    className="button-secondary cmd-case-field-remove"
                    onClick={() => removeField(field.id)}
                    aria-label={msg('cmdRemoveCaseField')}
                  >
                    {msg('cmdRemoveCaseField')}
                  </button>
                </div>

                <label>
                  {msg('cmdModelName')}
                  <input
                    value={field.name}
                    onChange={(e) => updateField(field.id, { name: e.target.value })}
                  />
                </label>

                <label>
                  {msg('modelsColType')}
                  <select
                    value={field.dataType}
                    onChange={(e) =>
                      handleDataTypeChange(field.id, e.target.value as DataType)
                    }
                  >
                    {DATA_TYPES.filter((t) => t !== 'reference').map((t) => (
                      <option key={t} value={t}>
                        {msg(dataTypeMessageKey(t))}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={field.isRequired}
                    onChange={(e) =>
                      updateField(field.id, { isRequired: e.target.checked })
                    }
                  />
                  {msg('fieldsRequiredLabel')}
                </label>

                {showOptions && (
                  <fieldset className="select-options-fieldset">
                    <legend>{msg('fieldsSelectOptions')}</legend>
                    <SelectOptionsEditor
                      rows={
                        field.optionRows.length > 0
                          ? field.optionRows
                          : [createEmptySelectOptionRow()]
                      }
                      onChange={(optionRows) => updateField(field.id, { optionRows })}
                    />
                  </fieldset>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="button-outline"
        onClick={() => onChange([...fields, newDraft()])}
      >
        {msg('cmdAddCaseField')}
      </button>
    </fieldset>
  );
}

export function validateCaseFieldDrafts(
  fields: CaseFieldDraft[],
  msg: (key: 'cmdModelNameRequired' | 'errorGeneric' | 'cmdStatusOptionLabelRequired') => string,
): string | null {
  for (const field of fields) {
    const name = field.name.trim();
    if (!name) continue;

    if (isSelectDataType(field.dataType)) {
      if (normalizeSelectOptionRows(field.optionRows).length === 0) {
        return msg('cmdStatusOptionLabelRequired');
      }
    }
  }

  const names = fields.map((f) => f.name.trim()).filter(Boolean);
  if (new Set(names).size !== names.length) {
    return msg('errorGeneric');
  }

  return null;
}

export function caseFieldDraftsToCreateBodies(
  fields: CaseFieldDraft[],
  locale: 'de' | 'en',
  encryptionMode: 'zero_knowledge' | 'server_readable',
) {
  return fields
    .filter((f) => f.name.trim())
    .map((f) => {
      if (isSelectDataType(f.dataType)) {
        const { select_options, select_option_translations } = buildSelectOptionsPayload(
          f.optionRows,
          locale,
        );
        return {
          name: f.name.trim(),
          locale,
          definition_scope: 'instance' as const,
          data_type: f.dataType,
          encryption_mode: encryptionMode,
          is_required: f.isRequired,
          select_options,
          select_option_translations,
        };
      }

      return {
        name: f.name.trim(),
        locale,
        definition_scope: 'instance' as const,
        data_type: f.dataType,
        encryption_mode: encryptionMode,
        is_required: f.isRequired,
      };
    });
}
