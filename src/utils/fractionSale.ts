import type { Product } from '../types';

export type FractionSaleLevel = 'piece' | 'packet';

export interface FractionSaleConfig {
  enabled: boolean;
  eligible: boolean;
  pieceUnit: string;
  packetUnit: string;
  unitsPerPacket: number;
  piecePrice: number;
  packetPrice: number;
  packetPriceOverridden: boolean;
}

const positive = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const isMedicineProduct = (product: Pick<Product, 'productType'>): boolean =>
  product.productType === 'medicine';

export const isFractionSaleEligible = (
  product: Pick<Product, 'productType' | 'isBulkProduct'>,
  businessType: string,
): boolean => {
  if (isMedicineProduct(product)) return false;
  return businessType === 'pharmacy' ? true : product.isBulkProduct === true;
};

export const isFractionSaleEnabled = (
  product: Pick<Product, 'productType' | 'isBulkProduct' | 'fractionSaleEnabled' | 'inventorySettings'>,
  businessType: string,
): boolean => {
  if (!isFractionSaleEligible(product, businessType)) return false;
  if (businessType !== 'pharmacy' && product.isBulkProduct) return true;
  return product.fractionSaleEnabled ?? product.inventorySettings?.fractionSaleEnabled ?? false;
};

export const resolveFractionSaleConfig = (product: Product, businessType: string): FractionSaleConfig => {
  const settings = product.inventorySettings;
  const unitsPerPacket = positive(
    product.conversionToBaseUnit ?? settings?.conversionToBaseUnit ?? product.bulkToUnitsRatio ?? product.bulkPurchaseQty,
    1,
  );
  const piecePrice = positive(
    product.defaultPricePerBaseUnit ?? settings?.defaultPricePerBaseUnit ?? product.sellUnitPrice ?? product.sellingPrice,
    0,
  );
  const packetPriceOverridden = product.packetPriceOverridden ?? settings?.packetPriceOverridden ?? false;
  const savedPacketPrice = product.wholePackagePrice ?? settings?.wholePackagePrice;
  const packetPrice = packetPriceOverridden
    ? positive(savedPacketPrice, piecePrice * unitsPerPacket)
    : piecePrice * unitsPerPacket;

  return {
    eligible: isFractionSaleEligible(product, businessType),
    enabled: isFractionSaleEnabled(product, businessType),
    pieceUnit: product.baseUnit ?? settings?.baseUnit ?? product.sellUnit ?? product.unit ?? 'Piece',
    packetUnit: product.purchaseUnit ?? settings?.purchaseUnit ?? product.bulkUnit ?? 'Packet',
    unitsPerPacket,
    piecePrice,
    packetPrice,
    packetPriceOverridden,
  };
};

export const calculateFractionSalePacketPrice = (
  piecePrice: number,
  unitsPerPacket: number,
  override?: number,
): { packetPrice: number; packetPriceOverridden: boolean } => {
  const calculated = Math.max(0, Number(piecePrice) || 0) * positive(unitsPerPacket, 1);
  const validOverride = Number.isFinite(Number(override)) && Number(override) > 0;
  return {
    packetPrice: validOverride ? Number(override) : calculated,
    packetPriceOverridden: validOverride,
  };
};

export const normalizeFractionSaleQuantity = (
  level: FractionSaleLevel,
  quantity: number,
  unitsPerPacket: number,
): number => Math.max(0, Number(quantity) || 0) * (level === 'packet' ? positive(unitsPerPacket, 1) : 1);

export const calculateFractionSaleLine = (
  level: FractionSaleLevel,
  quantity: number,
  config: Pick<FractionSaleConfig, 'piecePrice' | 'packetPrice' | 'unitsPerPacket'>,
) => {
  const selectedLevelQuantity = Math.max(0, Number(quantity) || 0);
  const selectedUnitPrice = level === 'packet' ? config.packetPrice : config.piecePrice;
  return {
    selectedLevel: level,
    selectedLevelQuantity,
    unitsPerSelectedLevel: level === 'packet' ? config.unitsPerPacket : 1,
    selectedUnitPrice,
    lineTotal: selectedLevelQuantity * selectedUnitPrice,
    baseQuantityDeducted: normalizeFractionSaleQuantity(level, selectedLevelQuantity, config.unitsPerPacket),
  };
};

export const calculateFractionPurchaseLine = (
  level: FractionSaleLevel,
  quantity: number,
  selectedUnitCost: number,
  config: Pick<FractionSaleConfig, 'unitsPerPacket'>,
) => {
  const selectedLevelQuantity = Math.max(0, Number(quantity) || 0);
  const safeUnitCost = Math.max(0, Number(selectedUnitCost) || 0);
  const unitsPerSelectedLevel = level === 'packet' ? config.unitsPerPacket : 1;
  const baseQty = normalizeFractionSaleQuantity(level, selectedLevelQuantity, config.unitsPerPacket);
  return {
    selectedLevel: level,
    selectedLevelQuantity,
    unitsPerSelectedLevel,
    selectedUnitCost: safeUnitCost,
    lineTotal: selectedLevelQuantity * safeUnitCost,
    baseQty,
    baseUnitCost: unitsPerSelectedLevel > 0 ? safeUnitCost / unitsPerSelectedLevel : safeUnitCost,
  };
};
