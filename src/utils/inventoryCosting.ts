import {
  FractionSaleOption,
  InventoryCostingMethod,
  PriceChangeInfo,
  Product,
  ProductBatch,
  SaleBatchInfo,
} from '../types';

export const mapLegacySellingMethod = (method?: Product['sellingMethod']): InventoryCostingMethod => {
  if (method === 'average_cost') return 'average_price';
  if (method === 'manual_batch') return 'batch_price';
  return 'fifo';
};

export const mapCostingMethodToLegacy = (method?: InventoryCostingMethod): Product['sellingMethod'] => {
  if (method === 'average_price') return 'average_cost';
  if (method === 'batch_price') return 'manual_batch';
  return 'fifo';
};

export const getProductCostingMethod = (product: Product): InventoryCostingMethod => (
  product.inventorySettings?.costingMethod ||
  product.costingMethod ||
  mapLegacySellingMethod(product.sellingMethod)
);

export const getDefaultFractionOptions = (baseUnit = 'Kg', pricePerBaseUnit = 0): FractionSaleOption[] => (
  [
    { id: 'quarter', label: `1/4 ${baseUnit}`, quantityInBaseUnit: 0.25, price: pricePerBaseUnit * 0.25, isDefault: true },
    { id: 'half', label: `1/2 ${baseUnit}`, quantityInBaseUnit: 0.5, price: pricePerBaseUnit * 0.5, isDefault: true },
    { id: 'three-quarter', label: `3/4 ${baseUnit}`, quantityInBaseUnit: 0.75, price: pricePerBaseUnit * 0.75, isDefault: true },
    { id: 'one', label: `1 ${baseUnit}`, quantityInBaseUnit: 1, price: pricePerBaseUnit, isDefault: true },
  ]
);

export const detectPriceChange = (previousBuyingPrice: number, newBuyingPrice: number): PriceChangeInfo => {
  const percentage = previousBuyingPrice > 0
    ? ((newBuyingPrice - previousBuyingPrice) / previousBuyingPrice) * 100
    : 0;

  return {
    previousBuyingPrice,
    newBuyingPrice,
    percentage,
    direction: Math.abs(percentage) < 0.0001 ? 'unchanged' : percentage > 0 ? 'increased' : 'decreased',
  };
};

export const suggestSellingPriceFromPreviousMargin = (
  previousBuyingPrice: number,
  previousSellingPrice: number,
  newBuyingPrice: number,
) => {
  const marginRatio = previousBuyingPrice > 0 ? previousSellingPrice / previousBuyingPrice : 1.5;
  return Math.round(newBuyingPrice * marginRatio);
};

export const calculateWeightedAverageCost = (batches: ProductBatch[], fallbackCost = 0) => {
  const active = batches.filter(batch => batch.status === 'active' && batch.quantityRemaining > 0);
  const totalQuantity = active.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
  const totalValue = active.reduce((sum, batch) => sum + (batch.quantityRemaining * batch.buyingPrice), 0);

  return totalQuantity > 0 ? totalValue / totalQuantity : fallbackCost;
};

export const getActiveBatchesOldestFirst = (product: Product) => (
  [...(product.batches || [])]
    .filter(batch => batch.status === 'active' && batch.quantityRemaining > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
);

export const calculateWeightedAverageSellingPrice = (product: Product, fallbackPrice = product.sellingPrice) => {
  const active = getActiveBatchesOldestFirst(product);
  const totalQuantity = active.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
  const totalValue = active.reduce((sum, batch) => {
    const batchSellingPrice = batch.finalSellingPrice || batch.suggestedSellingPrice || fallbackPrice;
    return sum + (batch.quantityRemaining * batchSellingPrice);
  }, 0);

  return totalQuantity > 0 ? totalValue / totalQuantity : fallbackPrice;
};

export const getPosSellingPriceForCostingMethod = (
  product: Product,
  fallbackPrice = product.sellingPrice,
  method: InventoryCostingMethod = getProductCostingMethod(product),
) => {
  const active = getActiveBatchesOldestFirst(product);

  if ((method === 'fifo' || method === 'batch_price') && active.length > 0) {
    return active[0].finalSellingPrice || active[0].suggestedSellingPrice || fallbackPrice;
  }

  if (method === 'average_price') {
    return calculateWeightedAverageSellingPrice(product, fallbackPrice);
  }

  return fallbackPrice;
};

export const createInventoryBatch = (
  product: Product,
  quantityPurchased: number,
  buyingPrice: number,
  options: {
    supplierName?: string;
    finalSellingPrice?: number;
    createdBy?: string;
    purchaseDate?: string;
  } = {},
): ProductBatch => {
  const previousBuyingPrice = product.latestBuyingPrice ?? product.costPrice ?? 0;
  const priceChange = detectPriceChange(previousBuyingPrice, buyingPrice);
  const suggestedSellingPrice = suggestSellingPriceFromPreviousMargin(
    previousBuyingPrice,
    product.sellingPrice,
    buyingPrice,
  );
  const baseUnit = product.inventorySettings?.baseUnit || product.baseUnit || product.sellUnit || product.unit;

  return {
    id: 'b-' + Math.random().toString(36).slice(2, 11),
    productId: product.id,
    batchNumber: 'B-' + Date.now().toString().slice(-6),
    supplierName: options.supplierName,
    purchaseDate: options.purchaseDate || new Date().toISOString(),
    quantityPurchased,
    quantityRemaining: quantityPurchased,
    buyingPrice,
    previousBuyingPrice,
    priceChangePercentage: priceChange.percentage,
    suggestedSellingPrice,
    finalSellingPrice: options.finalSellingPrice ?? product.sellingPrice,
    baseUnit,
    quantityPurchasedBase: quantityPurchased,
    quantityRemainingBase: quantityPurchased,
    costingMethodAtCreation: getProductCostingMethod(product),
    status: 'active',
    createdBy: options.createdBy || 'Admin',
    createdAt: new Date().toISOString(),
  };
};

export const addBatchToProduct = (
  product: Product,
  batch: ProductBatch,
  destination: 'shop' | 'store' = 'store',
): Product => {
  const batches = [...(product.batches || []), batch];
  const shopStockQty = destination === 'shop'
    ? (product.shopStockQty || 0) + batch.quantityPurchased
    : (product.shopStockQty || 0);
  const storeStockQty = destination === 'store'
    ? (product.storeStockQty || 0) + batch.quantityPurchased
    : (product.storeStockQty || 0);
  const averageBuyingCost = calculateWeightedAverageCost(batches, batch.buyingPrice);
  const costingMethod = getProductCostingMethod(product);

  return {
    ...product,
    batches,
    costPrice: batch.buyingPrice,
    latestBuyingPrice: batch.buyingPrice,
    averageBuyingCost,
    shopStockQty: Number(shopStockQty.toFixed(3)),
    storeStockQty: Number(storeStockQty.toFixed(3)),
    stockQty: Number((shopStockQty + storeStockQty).toFixed(3)),
    costingMethod,
    sellingMethod: mapCostingMethodToLegacy(costingMethod),
    inventorySettings: {
      costingMethod,
      allowPosMethodOverride: product.inventorySettings?.allowPosMethodOverride ?? product.allowPosMethodOverride ?? false,
      allowScaleSelling: product.inventorySettings?.allowScaleSelling ?? product.allowScaleSelling ?? !!product.isBulkProduct,
      purchaseUnit: product.inventorySettings?.purchaseUnit || product.purchaseUnit || product.bulkUnit || product.unit || 'Unit',
      baseUnit: product.inventorySettings?.baseUnit || product.baseUnit || product.sellUnit || product.unit || 'Unit',
      conversionToBaseUnit: product.inventorySettings?.conversionToBaseUnit || product.conversionToBaseUnit || 1,
      packageUnitPrice: product.inventorySettings?.packageUnitPrice ?? product.packageUnitPrice,
      wholePackagePrice: product.inventorySettings?.wholePackagePrice ?? product.wholePackagePrice,
      halfPackagePrice: product.inventorySettings?.halfPackagePrice ?? product.halfPackagePrice,
      packageBuyingCost: product.inventorySettings?.packageBuyingCost ?? product.packageBuyingCost,
      allowCustomQuantity: product.inventorySettings?.allowCustomQuantity ?? product.allowCustomQuantity ?? !!product.isBulkProduct,
      defaultPricePerBaseUnit: product.inventorySettings?.defaultPricePerBaseUnit ?? product.defaultPricePerBaseUnit ?? product.sellUnitPrice,
      fractionSaleOptions: product.inventorySettings?.fractionSaleOptions || product.fractionSaleOptions,
      pharmacyUnitBreakdown: product.inventorySettings?.pharmacyUnitBreakdown || product.pharmacyUnitBreakdown,
    },
  };
};

export const deductBatchesForSale = (
  product: Product,
  baseQuantityToDeduct: number,
  existingPendingBatches?: ProductBatch[],
): {
  updatedBatches: ProductBatch[];
  batchesUsed: SaleBatchInfo[];
  unitCost: number;
  remainingToDeduct: number;
} => {
  const sourceBatches = existingPendingBatches || product.batches || [];
  const updatedBatches = sourceBatches.map(batch => ({ ...batch }));
  const orderedBatches = updatedBatches
    .filter(batch => batch.status === 'active')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const batchesUsed: SaleBatchInfo[] = [];
  let remainingToDeduct = baseQuantityToDeduct;
  let totalCost = 0;
  let totalQty = 0;

  for (const batch of orderedBatches) {
    if (remainingToDeduct <= 0.0001) break;
    const take = Math.min(batch.quantityRemaining, remainingToDeduct);
    batch.quantityRemaining = Number((batch.quantityRemaining - take).toFixed(3));
    batch.quantityRemainingBase = batch.quantityRemaining;
    remainingToDeduct = Number((remainingToDeduct - take).toFixed(3));

    if (batch.quantityRemaining <= 0.001) {
      batch.quantityRemaining = 0;
      batch.quantityRemainingBase = 0;
      batch.status = 'finished';
    }

    batchesUsed.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      qty: Number(take.toFixed(3)),
      baseQty: Number(take.toFixed(3)),
      buyingPrice: batch.buyingPrice,
      sellingPrice: batch.finalSellingPrice,
    });
    totalCost += take * batch.buyingPrice;
    totalQty += take;
  }

  return {
    updatedBatches,
    batchesUsed,
    unitCost: totalQty > 0 ? totalCost / totalQty : product.costPrice,
    remainingToDeduct,
  };
};
