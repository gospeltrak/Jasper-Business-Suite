type DataSafetyReason = 'empty-overwrite' | 'shrink-save' | 'local-cache';

import { canWriteBusinessDataOnline, warnOfflineWriteBlocked } from './onlineOnly';

const PROTECTED_DATA_KEYS = new Set([
  'products',
  'products_map',
  'sales',
  'sales_map',
  'expenses',
  'expenses_map',
  'deliveries',
  'deliveries_map',
  'pendingDeliveryNotes',
  'pendingDeliveryNotes_map',
  'pending_delivery_notes_map',
  'purchases',
  'purchases_map',
  'branches',
  'branches_map',
  'branchStocks',
  'branchStocks_map',
  'branch_stocks_map',
  'branchStaffAssignments',
  'branchStaffAssignments_map',
  'branch_staff_assignments_map',
  'settings',
  'tenant_workspaces',
  'channels',
  'cash_bank_matrix',
  'docs',
  'till_settlements',
  'double_entry_ledgers',
  'expense_cats',
  'stock_adjustments',
]);

const backupIndexKey = (scope: string) => `jasper_data_safety_backups_${scope}`;
const backupLastKey = (scope: string, reason: DataSafetyReason) => `jasper_data_safety_backup_last_${scope}_${reason}`;
const backupItemKey = (scope: string, stamp: string) => `jasper_data_safety_backup_${scope}_${stamp}`;

const sanitizeScope = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

export function isProtectedDataKey(dataKey: string): boolean {
  return PROTECTED_DATA_KEYS.has(dataKey);
}

export function readJsonValue<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function payloadHasRecords(payload: any, tenantId?: string): boolean {
  if (Array.isArray(payload)) return payload.length > 0;
  if (!payload || typeof payload !== 'object') return payload !== undefined && payload !== null && payload !== '';
  if (tenantId && Array.isArray(payload[tenantId])) return payload[tenantId].length > 0;
  return Object.values(payload).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (!value || typeof value !== 'object') return value !== undefined && value !== null && value !== '';
    return Object.keys(value).length > 0;
  });
}

export function getTenantArray(payload: any, tenantId: string): any[] | null {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray(payload[tenantId])) return payload[tenantId];
  return null;
}

const isProductDataKey = (dataKey: string) => dataKey === 'products' || dataKey === 'products_map';

export function getProductPayloadQualityScore(items: any[] | null | undefined): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((score, item) => {
    if (!item || typeof item !== 'object') return score;
    const name = String(item.name || '').trim();
    const category = String(item.category || '').trim();
    const isRecoveredPlaceholder = /^Recovered Product\s+\d+/i.test(name);
    return score
      + (name && !isRecoveredPlaceholder ? 4 : 0)
      + (Number(item.sellingPrice || 0) > 0 ? 3 : 0)
      + (Number(item.costPrice || 0) > 0 ? 2 : 0)
      + (category && category !== 'Recovered from images' ? 1 : 0)
      + (item.brand ? 1 : 0)
      + (Number(item.stockQty || 0) > 0 || Number(item.shopStockQty || 0) > 0 || Number(item.storeStockQty || 0) > 0 ? 1 : 0);
  }, 0);
}

export function isProductPayloadQualityDowngrade(
  incomingItems: any[] | null | undefined,
  currentItems: any[] | null | undefined,
): boolean {
  if (!Array.isArray(incomingItems) || !Array.isArray(currentItems) || currentItems.length === 0) {
    return false;
  }
  if (incomingItems.length < currentItems.length) return false;

  const incomingScore = getProductPayloadQualityScore(incomingItems);
  const currentScore = getProductPayloadQualityScore(currentItems);
  const scoreDrop = currentScore - incomingScore;
  const meaningfulDrop = Math.max(12, Math.ceil(currentItems.length * 2));

  return (
    currentScore > 0
    && scoreDrop >= meaningfulDrop
    && incomingScore <= currentScore * 0.9
  );
}

export function isProductPayloadDestructiveShrink(
  incomingItems: any[] | null | undefined,
  currentItems: any[] | null | undefined,
): boolean {
  if (!Array.isArray(incomingItems) || !Array.isArray(currentItems) || currentItems.length === 0) {
    return false;
  }
  if (incomingItems.length >= currentItems.length) return false;

  const removedCount = currentItems.length - incomingItems.length;
  const maxExpectedSingleSaveRemoval = Math.max(10, Math.ceil(currentItems.length * 0.1));
  return removedCount > maxExpectedSingleSaveRemoval;
}

export function writeDataSafetyBackup(scope: string, value: any, reason: DataSafetyReason): void {
  if (!payloadHasRecords(value)) return;
  try {
    const safeScope = sanitizeScope(scope);
    const lastKey = backupLastKey(safeScope, reason);
    const last = Number(localStorage.getItem(lastKey) || 0);
    if (Date.now() - last < 10 * 60 * 1000) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = backupItemKey(safeScope, stamp);
    localStorage.setItem(key, JSON.stringify({ reason, createdAt: new Date().toISOString(), value }));
    localStorage.setItem(lastKey, String(Date.now()));

    const indexRaw = localStorage.getItem(backupIndexKey(safeScope));
    const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
    const next = [key, ...index.filter((entry) => entry !== key)];
    localStorage.setItem(backupIndexKey(safeScope), JSON.stringify(next));
  } catch {
    // Storage may be full or unavailable; backup must never block a user action.
  }
}

export function protectTenantPayload<T>(
  tenantId: string,
  dataKey: string,
  incoming: T,
  current: any,
): { payload: T; blockedEmptyOverwrite: boolean; shrank: boolean } {
  if (!tenantId || !isProtectedDataKey(dataKey)) {
    return { payload: incoming, blockedEmptyOverwrite: false, shrank: false };
  }

  const incomingItems = getTenantArray(incoming, tenantId);
  const currentItems = getTenantArray(current, tenantId);
  if (!incomingItems || !currentItems || currentItems.length === 0) {
    return { payload: incoming, blockedEmptyOverwrite: false, shrank: false };
  }

  if (incomingItems.length === 0) {
    const merged: any = Array.isArray(incoming)
      ? currentItems
      : { ...(incoming as any), [tenantId]: currentItems };
    return { payload: merged as T, blockedEmptyOverwrite: true, shrank: false };
  }

  if (
    isProductDataKey(dataKey)
    && (
      isProductPayloadQualityDowngrade(incomingItems, currentItems)
      || isProductPayloadDestructiveShrink(incomingItems, currentItems)
    )
  ) {
    const merged: any = Array.isArray(incoming)
      ? currentItems
      : { ...(incoming as any), [tenantId]: currentItems };
    return { payload: merged as T, blockedEmptyOverwrite: false, shrank: true };
  }

  return { payload: incoming, blockedEmptyOverwrite: false, shrank: incomingItems.length < currentItems.length };
}

export function safeSetJsonItem<T>(
  storageKey: string,
  value: T,
  options: { tenantId?: string; dataKey?: string; logLabel?: string } = {},
): T {
  const current = readJsonValue(storageKey);
  if (options.dataKey && isProtectedDataKey(options.dataKey) && !canWriteBusinessDataOnline()) {
    warnOfflineWriteBlocked(`safeSetJsonItem:${options.logLabel || storageKey}`);
    return (current ?? value) as T;
  }

  const protectedValue = options.tenantId && options.dataKey
    ? protectTenantPayload(options.tenantId, options.dataKey, value, current)
    : { payload: value, blockedEmptyOverwrite: false, shrank: false };
  if (
    options.dataKey
    && isProtectedDataKey(options.dataKey)
    && payloadHasRecords(current, options.tenantId)
    && !payloadHasRecords(protectedValue.payload, options.tenantId)
  ) {
    writeDataSafetyBackup(`${storageKey}_${options.tenantId || 'global'}`, current, 'empty-overwrite');
    console.warn(`[dataSafety] prevented empty overwrite for ${options.logLabel || storageKey}`);
    try {
      localStorage.setItem(storageKey, JSON.stringify(current));
    } catch (error) {
      console.warn(`[dataSafety] localStorage write failed for ${options.logLabel || storageKey}:`, error);
    }
    return current as T;
  }

  if (protectedValue.blockedEmptyOverwrite) {
    writeDataSafetyBackup(`${storageKey}_${options.tenantId}`, current, 'empty-overwrite');
    console.warn(`[dataSafety] prevented empty overwrite for ${options.logLabel || storageKey}`);
  } else if (protectedValue.shrank) {
    writeDataSafetyBackup(`${storageKey}_${options.tenantId}`, current, 'shrink-save');
  } else if (payloadHasRecords(current)) {
    writeDataSafetyBackup(`${storageKey}_${options.tenantId || 'global'}`, current, 'local-cache');
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(protectedValue.payload));
  } catch (error) {
    console.warn(`[dataSafety] localStorage write failed for ${options.logLabel || storageKey}:`, error);
  }
  return protectedValue.payload;
}

export function safeSetTenantMapItem<T extends Record<string, any[]>>(
  storageKey: string,
  dataKey: string,
  value: T,
): T {
  const current = readJsonValue<Record<string, any[]>>(storageKey);
  if (isProtectedDataKey(dataKey) && !canWriteBusinessDataOnline()) {
    warnOfflineWriteBlocked(`safeSetTenantMapItem:${storageKey}`);
    return (current ?? value) as T;
  }

  if (!current || typeof current !== 'object' || !isProtectedDataKey(dataKey)) {
    return safeSetJsonItem(storageKey, value, { dataKey, logLabel: storageKey });
  }

  let next: Record<string, any[]> = { ...value };
  let changed = false;
  let shrank = false;
  const tenantIds = new Set([...Object.keys(current), ...Object.keys(value || {})]);

  for (const tenantId of tenantIds) {
    const incomingItems = Array.isArray((value as any)?.[tenantId]) ? (value as any)[tenantId] : [];
    const currentItems = Array.isArray(current?.[tenantId]) ? current[tenantId] : [];
    if (currentItems.length > 0 && incomingItems.length === 0) {
      next[tenantId] = currentItems;
      changed = true;
    } else if (
      isProductDataKey(dataKey)
      && (
        isProductPayloadQualityDowngrade(incomingItems, currentItems)
        || isProductPayloadDestructiveShrink(incomingItems, currentItems)
      )
    ) {
      next[tenantId] = currentItems;
      shrank = true;
    } else if (incomingItems.length < currentItems.length) {
      shrank = true;
    }
  }

  if (changed) {
    writeDataSafetyBackup(storageKey, current, 'empty-overwrite');
    console.warn(`[dataSafety] prevented empty tenant-map overwrite for ${storageKey}`);
  } else if (shrank) {
    writeDataSafetyBackup(storageKey, current, 'shrink-save');
  } else if (payloadHasRecords(current)) {
    writeDataSafetyBackup(storageKey, current, 'local-cache');
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch (error) {
    console.warn(`[dataSafety] localStorage write failed for ${storageKey}:`, error);
  }

  return next as T;
}
