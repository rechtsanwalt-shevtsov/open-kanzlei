import type { DataType } from './attribute-api.js';
import type { MessageKey } from '../i18n/messages.js';

export function dataTypeMessageKey(type: DataType): MessageKey {
  switch (type) {
    case 'text':
      return 'dataTypeText';
    case 'number':
      return 'dataTypeNumber';
    case 'boolean':
      return 'dataTypeBoolean';
    case 'date':
      return 'dataTypeDate';
  }
}
