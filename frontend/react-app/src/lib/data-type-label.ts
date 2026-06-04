import type { DataType } from './attribute-api.js';
import type { MessageKey } from '../i18n/messages.js';

export const DATA_TYPES: DataType[] = [
  'text',
  'number',
  'money',
  'date',
  'boolean',
  'single_select',
  'multi_select',
];

export function dataTypeMessageKey(type: DataType): MessageKey {
  switch (type) {
    case 'text':
      return 'dataTypeText';
    case 'number':
      return 'dataTypeNumber';
    case 'money':
      return 'dataTypeMoney';
    case 'boolean':
      return 'dataTypeBoolean';
    case 'date':
      return 'dataTypeDate';
    case 'single_select':
      return 'dataTypeSingleSelect';
    case 'multi_select':
      return 'dataTypeMultiSelect';
  }
}

export function isSelectDataType(type: DataType): boolean {
  return type === 'single_select' || type === 'multi_select';
}
