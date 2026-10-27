/**
 * Optional, release-gated replacement for the tenant_data.application_state
 * whole-workspace JSON write. This persists only changed Storage API keys.
 *
 * It is deliberately disabled until an independently restored staging test
 * has passed and the tenant's DB status has been set to 'active'.
 */
export type TypedOnlineStateRow = {
  state_key: string;
  state_value: string | null;
  is_deleted: boolean;
};
export type TypedOnlineStateChange = {
  value: string | null;
  isDeleted: boolean;
  revision: number;
};
export type TypedOnlineStateWrite = TypedOnlineStateRow & {
  tenant_id: string;
};

/** Restore the original Storage API semantics: an absent key reads as null. */
export function hydrateTypedOnlineState(rows: TypedOnlineStateRow[]): Map<string, string> {
  const state = new Map<string, string>();
  for (const row of rows) {
    if (!row || typeof row.state_key !== 'string') {
      throw new Error('Invalid typed application state key');
    }
    if (typeof row.is_deleted !== 'boolean') {
      throw new Error('Invalid typed application state tombstone');
    }
    if (row.is_deleted) continue;
    if (typeof row.state_value !== 'string') {
      throw new Error('Typed application state entry cannot be null unless deleted');
    }
    if (state.has(row.state_key)) {
      throw new Error('Duplicate typed application state key');
    }
    state.set(row.state_key, row.state_value);
  }
  return state;
}

/** No whole-tenant JSON payload is written; just changed keys and tombstones. */
export function makeTypedOnlineStateWrites(
  tenantId: string,
  changes: ReadonlyArray<readonly [string, TypedOnlineStateChange]>,
): TypedOnlineStateWrite[] {
  if (!tenantId) throw new Error('Tenant is required for typed state changes');
  return changes.map(([key, change]) => {
    if (typeof key !== 'string') throw new Error('Storage key must be a string');
    if (!change.isDeleted && typeof change.value !== 'string') {
      throw new Error('Active typed state must have a string value');
    }
    return {
      tenant_id: tenantId,
      state_key: key,
      state_value: change.value,
      is_deleted: change.isDeleted,
    };
  });
}
