import { Product, SaleItem } from '../types';

const normalizeUnit = (unit?: string) => {
  const cleaned = (unit || '').trim();
  if (!cleaned) return 'pcs';
  return cleaned.replace(/^[\d\s./-]+/, '').trim() || cleaned;
};

export const getProductUnitName = (product?: Pick<Product, 'baseUnit' | 'unit' | 'sellUnit' | 'bulkUnit' | 'inventorySettings' | 'isBulkProduct' | 'allowScaleSelling' | 'sellingMode'>) => {
  if (!product) return 'pcs';
  const isMeasuredProduct = !!product.isBulkProduct || !!product.allowScaleSelling ||
    !!product.inventorySettings?.allowScaleSelling || product.sellingMode === 'scale' || product.sellingMode === 'hybrid';
  return normalizeUnit(
    (isMeasuredProduct
      ? product.inventorySettings?.baseUnit || product.baseUnit || product.sellUnit || product.unit
      : product.unit || product.inventorySettings?.baseUnit || product.baseUnit || product.sellUnit) ||
    product.bulkUnit ||
    'pcs',
  );
};

export const getSaleItemUnitName = (item: Pick<SaleItem, 'unit' | 'baseUnit' | 'sellUnit'>, product?: Product) => (
  normalizeUnit(item.unit || item.baseUnit || item.sellUnit || (product ? getProductUnitName(product) : 'pcs'))
);

export const formatQuantity = (quantity: number, unit?: string) => {
  const value = Number.isInteger(quantity)
    ? quantity.toLocaleString()
    : Number(quantity.toFixed(3)).toLocaleString();
  return `${value} ${normalizeUnit(unit)}`;
};

export const formatProductQuantity = (quantity: number, product?: Product) => (
  formatQuantity(quantity, getProductUnitName(product))
);

export const formatSaleItemQuantity = (item: SaleItem, product?: Product) => (
  formatQuantity(item.qty, getSaleItemUnitName(item, product))
);
