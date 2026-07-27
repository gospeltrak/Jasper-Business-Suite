import { Product } from '../types';

export const PRODUCT_TOMBSTONES_FIELD = '__productTombstones';

type ProductTombstones = Record<string, string>;

const SYNC_METADATA_KEYS = new Set([
  'syncUpdatedAt',
  'updatedAt',
  'updated_at',
  'modifiedAt',
  'lastModifiedAt',
]);

// Runtime-only mirror. The durable copy is stored inside the tenant workspace
// payload in Supabase; no business metadata is persisted in the browser.
const runtimeTombstones = new Map<string, ProductTombstones>();

const parseTime = (value?: string | null): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const productTime = (product: any): number => {
  if (!product || typeof product !== 'object') return 0;
  return Math.max(
    parseTime(product.syncUpdatedAt),
    parseTime(product.updatedAt),
    parseTime(product.updated_at),
    parseTime(product.modifiedAt),
    parseTime(product.lastModifiedAt),
  );
};

const meaningfulProductSignature = (product: any): string => {
  if (!product || typeof product !== 'object') return '';
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(product)) {
    if (!SYNC_METADATA_KEYS.has(key)) clean[key] = value;
  }
  try {
    return JSON.stringify(clean);
  } catch {
    return String(product?.id || '');
  }
};

export const readLocalProductTombstones = (tenantId: string): ProductTombstones => {
  return { ...(runtimeTombstones.get(tenantId) || {}) };
};

export const writeLocalProductTombstones = (tenantId: string, tombstones: ProductTombstones): void => {
  runtimeTombstones.set(tenantId, { ...(tombstones || {}) });
};

export const markLocalProductTombstones = (
  tenantId: string,
  productIds: string[],
  deletedAt = new Date().toISOString(),
): ProductTombstones => {
  const next = { ...readLocalProductTombstones(tenantId) };
  for (const productId of productIds) {
    if (productId) next[productId] = deletedAt;
  }
  writeLocalProductTombstones(tenantId, next);
  return next;
};

export const mergeProductTombstones = (...sources: Array<ProductTombstones | null | undefined>): ProductTombstones => {
  const merged: ProductTombstones = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [productId, deletedAt] of Object.entries(source)) {
      if (!productId || !deletedAt) continue;
      if (parseTime(deletedAt) >= parseTime(merged[productId])) {
        merged[productId] = deletedAt;
      }
    }
  }
  return merged;
};

export const extractPayloadProductTombstones = (payload: any, tenantId: string): ProductTombstones => {
  const root = payload?.[PRODUCT_TOMBSTONES_FIELD];
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    const scoped = root[tenantId];
    if (scoped && typeof scoped === 'object' && !Array.isArray(scoped)) return scoped;
  }
  return {};
};

export const attachPayloadProductTombstones = <T>(payload: T, tenantId: string, tombstones: ProductTombstones): T => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  return {
    ...(payload as any),
    [PRODUCT_TOMBSTONES_FIELD]: {
      ...((payload as any)[PRODUCT_TOMBSTONES_FIELD] || {}),
      [tenantId]: tombstones || {},
    },
  } as T;
};

export const stampProductsForSync = (
  nextProducts: Product[],
  currentProducts: Product[],
  updatedAt = new Date().toISOString(),
): Product[] => {
  const currentById = new Map((currentProducts || []).map((product: any) => [product.id, product]));
  return (nextProducts || []).map((product: any) => {
    const current = currentById.get(product.id);
    const changed = !current || meaningfulProductSignature(product) !== meaningfulProductSignature(current);

    if (!changed) {
      // Product data unchanged — preserve existing timestamp, never go backwards
      const existingTs =
        product.syncUpdatedAt || product.updatedAt ||
        current?.syncUpdatedAt || current?.updatedAt || current?.updated_at;
      return { ...product, syncUpdatedAt: existingTs, updatedAt: existingTs };
    }

    // Product changed — use the timestamp that was explicitly set on the product
    // (set by the edit handler in DashboardProducts.tsx to new Date().toISOString())
    // or fall back to the updatedAt param (also new Date().toISOString()).
    // Always pick the LARGEST (newest) timestamp — never overwrite a newer one.
    const productTs = product.syncUpdatedAt || product.updatedAt;
    const finalTs = productTs && productTs > updatedAt ? productTs : updatedAt;
    return { ...product, syncUpdatedAt: finalTs, updatedAt: finalTs };
  }) as Product[];
};

export const mergeProductsForSync = (
  incomingProducts: Product[] | null | undefined,
  currentProducts: Product[] | null | undefined,
  tombstones: ProductTombstones = {},
): Product[] => {
  const incoming = Array.isArray(incomingProducts) ? incomingProducts : [];
  const current = Array.isArray(currentProducts) ? currentProducts : [];
  const incomingById = new Map(incoming.map((product: any) => [product.id, product]));
  const currentById = new Map(current.map((product: any) => [product.id, product]));
  const ids = new Set([...incomingById.keys(), ...currentById.keys()].filter(Boolean));
  const chosen = new Map<string, Product>();

  for (const id of ids) {
    const incomingProduct = incomingById.get(id) as Product | undefined;
    const currentProduct = currentById.get(id) as Product | undefined;
    const incomingTime = productTime(incomingProduct);
    const currentTime = productTime(currentProduct);
    const tombstoneTime = parseTime(tombstones[id]);

    if (tombstoneTime && tombstoneTime >= Math.max(incomingTime, currentTime)) {
      continue;
    }

    if (incomingProduct && currentProduct) {
      if (incomingTime > currentTime) {
        // Incoming is newer — user's edit wins
        chosen.set(id, incomingProduct);
      } else if (currentTime > incomingTime) {
        // Cache is newer — only possible if another device saved more recently
        // BUT: if incoming has explicit user edit markers, it still wins
        const incomingWasExplicitlyEdited =
          (incomingProduct as any).syncUpdatedAt || (incomingProduct as any).updatedAt;
        if (incomingWasExplicitlyEdited) {
          // User explicitly edited this product in this session — their edit wins
          // regardless of timestamp comparison (timestamp may be clock skew)
          chosen.set(id, incomingProduct);
        } else {
          chosen.set(id, currentProduct);
        }
      } else {
        // Timestamps equal or both zero — incoming is always the user's
        // current session data and wins. Spread current first so incoming
        // fields (the edits) override cached fields.
        chosen.set(id, { ...currentProduct, ...incomingProduct });
      }
      continue;
    }

    if (incomingProduct) {
      if (!tombstoneTime || incomingTime > tombstoneTime) chosen.set(id, incomingProduct);
      continue;
    }

    if (currentProduct) {
      if (!tombstoneTime || currentTime > tombstoneTime) chosen.set(id, currentProduct);
    }
  }

  const ordered: Product[] = [];
  for (const product of incoming) {
    if (product?.id && chosen.has(product.id)) {
      ordered.push(chosen.get(product.id)!);
      chosen.delete(product.id);
    }
  }
  for (const product of current) {
    if (product?.id && chosen.has(product.id)) {
      ordered.push(chosen.get(product.id)!);
      chosen.delete(product.id);
    }
  }
  return ordered;
};
