import type { CustomRole } from '../types';

type RolePermissions = CustomRole['permissions'];

const PERMISSION_MODULE_KEYS: (keyof RolePermissions)[] = [
  'pos', 'products', 'purchases', 'suppliers', 'expenses',
  'reportsSalesExpenses', 'reportsProfitCogs', 'sync', 'settings',
];

// A well-formed permissions object has every module key, each shaped as
// { read, write, edit } (only `read` is checked here -- that's what every
// isTabAllowed() gate in Dashboard.tsx actually reads). A stored value
// missing even one module key silently denies that module everywhere it's
// checked, exactly like an empty object -- this was found in production:
// a tenant's Admin role_permissions was non-empty but missing "settings"
// and "pos", which is functionally indistinguishable from being empty.
const isWellFormedRolePermissions = (value: Record<string, unknown>): value is RolePermissions =>
  PERMISSION_MODULE_KEYS.every((key) => {
    const module = value[key];
    return Boolean(module) && typeof module === 'object' && !Array.isArray(module) && typeof (module as any).read === 'boolean';
  });

/**
 * An empty or malformed database JSON object means that no reliable per-user
 * permission override was ever saved. Returning undefined lets the dashboard
 * resolve the tenant's named role (including the built-in Admin role)
 * instead of denying every permission after a session reload.
 */
export const resolveProfileRolePermissions = (value: unknown): RolePermissions | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length === 0) return undefined;
  return isWellFormedRolePermissions(record) ? record : undefined;
};
