export const ROLE_ADMIN = 'admin' as const;
export const ROLE_REGULAR = 'regular' as const;

export const TENANT_ROLE_KEYS = [ROLE_ADMIN, ROLE_REGULAR] as const;

export type TenantRoleKey = (typeof TENANT_ROLE_KEYS)[number];

export function isTenantRoleKey(value: string): value is TenantRoleKey {
  return (TENANT_ROLE_KEYS as readonly string[]).includes(value);
}
