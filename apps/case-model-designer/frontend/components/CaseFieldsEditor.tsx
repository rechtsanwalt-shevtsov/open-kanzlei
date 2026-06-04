import { useId } from 'react';
import { useI18n } from '@shell/i18n/I18nContext.js';
import type { DataType } from '@shell/lib/attribute-api.js';
import {
  DATA_TYPES,
  dataTypeMessageKey,
  isSelectDataType,
} from '@shell/lib/data-type-label.js';

export type CaseFieldDraft = {
  id: string;
  name: string;
  dataType: DataType;
  isRequired: boolean;
  optionsText: string;
};

function newDraft(): CaseFieldDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    dataType: 'text',
    isRequired: false,
    optionsText: '',
  };
}

function parseOptionsText(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
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
                      updateField(field.id, { dataType: e.target.value as DataType })
                    }
                  >
                    {DATA_TYPES.map((t) => (
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
                  <label>
                    {msg('fieldsSelectOptions')}
                    <textarea
                      rows={3}
                      value={field.optionsText}
                      onChange={(e) =>
                        updateField(field.id, { optionsText: e.target.value })
                      }
                      placeholder={msg('fieldsSelectOptionsHint')}
                    />
                  </label>
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
  msg: (key: 'cmdModelNameRequired' | 'errorGeneric') => string,
): string | null {
  for (const field of fields) {
    const name = field.name.trim();
    if (!name) continue;

    if (isSelectDataType(field.dataType) && parseOptionsText(field.optionsText).length === 0) {
      return msg('errorGeneric');
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
      const selectOptions = isSelectDataType(f.dataType)
        ? parseOptionsText(f.optionsText)
        : undefined;
      return {
        name: f.name.trim(),
        locale,
        definition_scope: 'instance' as const,
        data_type: f.dataType,
        encryption_mode: encryptionMode,
        is_required: f.isRequired,
        ...(selectOptions?.length ? { select_options: selectOptions } : {}),
      };
    });
}
