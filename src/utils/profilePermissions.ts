import type { CustomRole } from '../types';

type RolePermissions = CustomRole['permissions'];

/**
 * An empty database JSON object means that no per-user permission override
 * was saved. Returning undefined lets the dashboard resolve the tenant's
 * named role (including the built-in Admin role) instead of denying every
 * permission after a session reload.
 */
export const resolveProfileRolePermissions = (value: unknown): RolePermissions | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.keys(value as Record<string, unknown>).length > 0
    ? value as RolePermissions
    : undefined;
};
