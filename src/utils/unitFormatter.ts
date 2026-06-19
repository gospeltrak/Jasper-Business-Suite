import { Product, SaleItem } from '../types';

const normalizeUnit = (unit?: string) => {
  const cleaned = (unit || '').trim();
  if (!cleaned) return 'pcs';
  return cleaned.replace(/^[\d\s./-]+/, '').trim() || cleaned;
};

export const getProductUnitName = (product?: Pick<Product, 'baseUnit' | 'unit' | 'sellUnit' | 'bulkUnit' | 'inventorySettings'>) => {
  if (!product) return 'pcs';
  return normalizeUnit(
    product.inventorySettings?.baseUnit ||
    product.baseUnit ||
    product.unit ||
    product.sellUnit ||
    product.bulkUnit ||
    'pcs',
  );
};

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
  formatQuantity(item.qty, product ? getProductUnitName(product) : item.sellUnit || 'pcs')
);
