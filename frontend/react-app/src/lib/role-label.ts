import type { components } from '../api/schema.js';
import type { MessageKey } from '../i18n/messages.js';

export type TenantRoleKey = components['schemas']['TenantRoleKey'];

export function roleMessageKey(role: TenantRoleKey): MessageKey {
  return role === 'admin' ? 'roleAdmin' : 'roleRegular';
}
