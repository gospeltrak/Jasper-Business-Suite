import { Product, Sale } from '../types';
import { stampProductsForSync } from './productSync';

export const SALE_TOMBSTONES_FIELD = '__saleTombstones';

export type SaleTombstones = Record<string, string>;

const runtimeTombstones = new Map<string, SaleTombstones>();

const parseTime = (value?: string | null): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const saleTime = (sale: any): number => {
  if (!sale || typeof sale !== 'object') return 0;
  return Math.max(
    parseTime(sale.syncUpdatedAt),
    parseTime(sale.updatedAt),
    parseTime(sale.updated_at),
    parseTime(sale.modifiedAt),
    parseTime(sale.lastModifiedAt),
    parseTime(sale.actualTimestamp),
    parseTime(sale.timestamp),
  );
};

export const isSaleDataKey = (dataKey: string): boolean =>
  dataKey === 'sales' || dataKey === 'sales_map';

export const saleHasTenantConflict = (
  requestedSale: Partial<Sale> | null | undefined,
  persistedSale: Partial<Sale> | null | undefined,
  activeTenantId: string,
): boolean => {
  const explicitTenantId = String(
    requestedSale?.tenantId
    || (requestedSale as any)?.tenant_id
    || persistedSale?.tenantId
    || (persistedSale as any)?.tenant_id
    || ''
  ).trim();
  return Boolean(explicitTenantId && explicitTenantId !== activeTenantId);
};

export const readLocalSaleTombstones = (tenantId: string): SaleTombstones => ({
  ...(runtimeTombstones.get(tenantId) || {}),
});

export const writeLocalSaleTombstones = (
  tenantId: string,
  tombstones: SaleTombstones,
): void => {
  runtimeTombstones.set(tenantId, { ...(tombstones || {}) });
};

export const markLocalSaleTombstone = (
  tenantId: string,
  saleId: string,
  deletedAt = new Date().toISOString(),
): SaleTombstones => {
  const next = readLocalSaleTombstones(tenantId);
  if (saleId) next[saleId] = deletedAt;
  writeLocalSaleTombstones(tenantId, next);
  return next;
};

export const mergeSaleTombstones = (
  ...sources: Array<SaleTombstones | null | undefined>
): SaleTombstones => {
  const merged: SaleTombstones = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [saleId, deletedAt] of Object.entries(source)) {
      if (!saleId || !deletedAt) continue;
      if (parseTime(deletedAt) >= parseTime(merged[saleId])) {
        merged[saleId] = deletedAt;
      }
    }
  }
  return merged;
};

export const extractPayloadSaleTombstones = (
  payload: any,
  tenantId: string,
): SaleTombstones => {
  const root = payload?.[SALE_TOMBSTONES_FIELD];
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    const scoped = root[tenantId];
    if (scoped && typeof scoped === 'object' && !Array.isArray(scoped)) {
      return scoped;
    }
  }
  return {};
};

export const attachPayloadSaleTombstones = <T>(
  payload: T,
  tenantId: string,
  tombstones: SaleTombstones,
): T => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  return {
    ...(payload as any),
    [SALE_TOMBSTONES_FIELD]: {
      ...((payload as any)[SALE_TOMBSTONES_FIELD] || {}),
      [tenantId]: tombstones || {},
    },
  } as T;
};

export const mergeSalesForSync = (
  incomingSales: Sale[] | null | undefined,
  currentSales: Sale[] | null | undefined,
  tombstones: SaleTombstones = {},
): Sale[] => {
  const incoming = Array.isArray(incomingSales) ? incomingSales : [];
  const current = Array.isArray(currentSales) ? currentSales : [];
  const chosen = new Map<string, Sale>();

  for (const sale of [...current, ...incoming]) {
    if (!sale?.id) continue;
    // A recorded deletion is authoritative. Remote workspace upserts and
    // realtime relays may stamp an old sale with a newer transport timestamp;
    // comparing those timestamps would allow the deleted sale to resurrect.
    // Sale IDs are immutable and never reused, so only an explicit tombstone
    // removal may make the same ID eligible again.
    if (tombstones[sale.id]) {
      chosen.delete(sale.id);
      continue;
    }
    const existing = chosen.get(sale.id);
    if (!existing || saleTime(sale) >= saleTime(existing)) {
      chosen.set(sale.id, sale);
    }
  }

  const ordered: Sale[] = [];
  for (const sale of incoming) {
    if (sale?.id && chosen.has(sale.id)) {
      ordered.push(chosen.get(sale.id)!);
      chosen.delete(sale.id);
    }
  }
  for (const sale of current) {
    if (sale?.id && chosen.has(sale.id)) {
      ordered.push(chosen.get(sale.id)!);
      chosen.delete(sale.id);
    }
  }
  return ordered;
};

export const reverseSaleInventory = (
  sale: Sale,
  products: Product[],
  updatedAt = new Date().toISOString(),
): Product[] => stampProductsForSync(
  products.map(product => {
    const soldItems = sale.items.filter(item => item.productId === product.id);
    if (soldItems.length === 0) return product;

    const restoredBaseQuantity = soldItems.reduce((sum, item) => {
      const quantity = Number(item.baseQuantityDeducted ?? item.qty);
      return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
    const restoredByBatch = new Map<string, number>();
    for (const item of soldItems) {
      for (const batch of item.batchesUsed || []) {
        const quantity = Number(batch.baseQty ?? batch.qty);
        if (!batch.batchId || !Number.isFinite(quantity) || quantity <= 0) continue;
        restoredByBatch.set(batch.batchId, (restoredByBatch.get(batch.batchId) || 0) + quantity);
      }
    }

    const nextShopQuantity = Number(((product.shopStockQty || 0) + restoredBaseQuantity).toFixed(3));
    const nextBatches = product.batches?.map(batch => {
      const restored = restoredByBatch.get(batch.id) || 0;
      if (restored <= 0) return batch;
      const maximum = Number(batch.quantityPurchasedBase ?? batch.quantityPurchased);
      const nextRemaining = Number(Math.min(
        Number.isFinite(maximum) && maximum > 0 ? maximum : Number.POSITIVE_INFINITY,
        Number(batch.quantityRemaining || 0) + restored,
      ).toFixed(3));
      return {
        ...batch,
        quantityRemaining: nextRemaining,
        quantityRemainingBase: nextRemaining,
        status: nextRemaining > 0 ? 'active' as const : batch.status,
      };
    });

    return {
      ...product,
      shopStockQty: nextShopQuantity,
      stockQty: Number((nextShopQuantity + Number(product.storeStockQty || 0)).toFixed(3)),
      batches: nextBatches,
    };
  }),
  products,
  updatedAt,
);
