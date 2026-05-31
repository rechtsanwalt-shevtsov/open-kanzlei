import type { components } from '../api/schema.js';
import type { MessageKey } from '../i18n/messages.js';

export type EncryptionMode = components['schemas']['EncryptionMode'];

export const ENCRYPTION_MODES: EncryptionMode[] = ['zero_knowledge', 'server_readable'];

export function encryptionModeMessageKey(mode: EncryptionMode): MessageKey {
  switch (mode) {
    case 'zero_knowledge':
      return 'encryptionZeroKnowledge';
    case 'server_readable':
      return 'encryptionServerReadable';
  }
}
