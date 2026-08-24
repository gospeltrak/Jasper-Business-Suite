import { DosageForm, Product, ProductType, UniversalPackageLevel, UniversalSellingUnit } from '../types';
import { validateSellingUnits, validateUnitHierarchy } from './universalUnits';

// ─── Universal Bulk Import (Stage 8) ────────────────────────────────────────
// A second, header-based import path that sits ALONGSIDE the original
// positional 13-column Retail template (untouched, still works exactly as
// before). This one understands Product Type, Medicine fields, and
// product-specific packaging -- while a bad row is rejected individually,
// never silently corrupting the rest of the batch.

/** Minimal RFC4180-style CSV parser: handles quoted fields, embedded commas/quotes/newlines. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += char; i += 1; continue;
    }
    if (char === '"') { inQuotes = true; i += 1; continue; }
    if (char === ',') { row.push(field); field = ''; i += 1; continue; }
    if (char === '\r') { i += 1; continue; }
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += char; i += 1;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  return rows
    .map(r => r.map(cell => cell.trim()))
    .filter(r => r.some(cell => cell !== ''));
}

export const UNIVERSAL_IMPORT_HEADERS = [
  'Product Name', 'Barcode', 'Product Type', 'Category', 'Brand',
  'Generic Name', 'Manufacturer', 'Dosage Form', 'Strength Value', 'Strength Unit',
  'Base Unit',
  'Package 1 Unit', 'Package 1 Qty in Base', 'Package 1 Selling Price',
  'Package 2 Unit', 'Package 2 Qty in Base', 'Package 2 Selling Price',
  'Base Unit Selling Price', 'Cost Price',
  'Shop Stock', 'Store Stock', 'Alert Level',
  'Prescription Required', 'Track Batch', 'Track Expiry',
] as const;

const PRODUCT_TYPE_LABEL_TO_VALUE: Record<string, ProductType> = {
  'general retail': 'general_retail',
  'medicine': 'medicine',
  'medical supply': 'medical_supply',
  'personal care': 'personal_care',
  'cosmetics & beauty': 'cosmetics_beauty',
  'cosmetics and beauty': 'cosmetics_beauty',
  'baby care': 'baby_care',
  'hygiene': 'hygiene',
  'supplements': 'supplements',
  'food & drinks': 'food_drinks',
  'food and drinks': 'food_drinks',
};

const VALID_DOSAGE_FORMS: DosageForm[] = [
  'tablet', 'capsule', 'syrup', 'suspension', 'oral_solution', 'drops',
  'cream', 'ointment', 'gel', 'injection', 'inhaler', 'sachet', 'powder',
  'suppository', 'other',
];

const parseBool = (value: string) => ['yes', 'true', '1', 'y'].includes(value.trim().toLowerCase());
const parseNum = (value: string): number | undefined => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : undefined;
};

export function downloadableUniversalTemplate(): string {
  const header = UNIVERSAL_IMPORT_HEADERS.join(',');
  const sampleAmoxicillin = [
    'Amoxicillin 500mg', '', 'Medicine', 'Antibiotics', 'Jasper Pharma',
    'Amoxicillin', 'GlobalPharma Ltd', 'capsule', '500', 'mg',
    'Capsule',
    'Blister', '10', '3500',
    'Box', '100', '30000',
    '400', '20000',
    '50', '100', '10',
    'Yes', 'Yes', 'Yes',
  ].join(',');
  const sampleNivea = [
    'Nivea Body Lotion', '', 'Personal Care', 'Body Care', 'Nivea',
    '', '', '', '', '',
    'Bottle',
    '', '', '',
    '', '', '',
    '8500', '6000',
    '15', '30', '5',
    'No', 'No', 'No',
  ].join(',');
  return `${header}\r\n${sampleAmoxicillin}\r\n${sampleNivea}\r\n`;
}

export interface ImportRowResult {
  rowNumber: number;
  status: 'ready' | 'warning' | 'error';
  product?: Product;
  messages: string[];
}

export function parseUniversalImportRow(
  headerIndex: Record<string, number>,
  columns: string[],
  rowNumber: number,
): ImportRowResult {
  const get = (label: string) => (
    headerIndex[label] !== undefined ? (columns[headerIndex[label]] || '').trim() : ''
  );
  const messages: string[] = [];

  const name = get('Product Name');
  if (!name) return { rowNumber, status: 'error', messages: ['Product Name is required.'] };

  const productType: ProductType = PRODUCT_TYPE_LABEL_TO_VALUE[get('Product Type').toLowerCase()] || 'general_retail';
  const isMedicine = productType === 'medicine';

  const baseUnit = get('Base Unit') || 'Unit';
  const costPrice = parseNum(get('Cost Price')) ?? 0;
  const baseSellingPrice = parseNum(get('Base Unit Selling Price')) ?? 0;
  const shopStock = parseNum(get('Shop Stock')) ?? 0;
  const storeStock = parseNum(get('Store Stock')) ?? 0;
  const alertQty = parseNum(get('Alert Level')) ?? 5;

  const packageLevels: UniversalPackageLevel[] = [];
  const sellingUnits: UniversalSellingUnit[] = [
    { id: 'base', packageLevelId: 'base', label: baseUnit, price: baseSellingPrice, isDefault: true },
  ];
  const structuralErrors: string[] = [];

  ([
    { unitLabel: 'Package 1 Unit', qtyLabel: 'Package 1 Qty in Base', priceLabel: 'Package 1 Selling Price', id: 'package1' },
    { unitLabel: 'Package 2 Unit', qtyLabel: 'Package 2 Qty in Base', priceLabel: 'Package 2 Selling Price', id: 'package2' },
  ] as const).forEach(({ unitLabel, qtyLabel, priceLabel, id }) => {
    const unitName = get(unitLabel);
    if (!unitName) return;
    const qty = parseNum(get(qtyLabel));
    const price = parseNum(get(priceLabel));
    if (!qty || qty <= 0) {
      structuralErrors.push(`"${unitName}" selling unit exists but no valid Base Unit conversion is defined.`);
      return;
    }
    packageLevels.push({ id, label: unitName, quantityInBaseUnit: qty });
    // Selling price stays independent -- never forced to qty * base price -- but
    // falls back to that only when the sheet genuinely left it blank.
    sellingUnits.push({ id: `su-${id}`, packageLevelId: id, label: unitName, price: price ?? (qty * baseSellingPrice) });
  });

  const hierarchyCheck = packageLevels.length > 0 ? validateUnitHierarchy(packageLevels) : { valid: true, errors: [] as string[] };
  const sellingUnitCheck = validateSellingUnits(sellingUnits, packageLevels);
  const errors = [...structuralErrors, ...hierarchyCheck.errors, ...sellingUnitCheck.errors];
  if (errors.length > 0) {
    return { rowNumber, status: 'error', messages: [...messages, ...errors] };
  }

  if (isMedicine) {
    const dosageFormRaw = get('Dosage Form').toLowerCase().replace(/\s+/g, '_') as DosageForm;
    if (get('Dosage Form') && !VALID_DOSAGE_FORMS.includes(dosageFormRaw)) {
      messages.push(`Unrecognized Dosage Form "${get('Dosage Form')}" -- left blank.`);
    }

    const legacyLevels = [...packageLevels]
      .sort((a, b) => b.quantityInBaseUnit - a.quantityInBaseUnit)
      .map(level => ({ id: level.id, label: level.label, unit: level.label, quantityToBaseUnit: level.quantityInBaseUnit }));

    const barcode = get('Barcode') || String(Math.floor(10000000 + Math.random() * 90000000));
    const product: Product = {
      id: 'p-' + Math.random().toString(36).slice(2, 11),
      name,
      sku: barcode,
      barcode,
      category: get('Category') || 'Medicine',
      brand: get('Brand') || undefined,
      unit: baseUnit,
      costPrice,
      sellingPrice: baseSellingPrice,
      stockQty: shopStock + storeStock,
      shopStockQty: shopStock,
      storeStockQty: storeStock,
      alertQty,
      sellInRetail: true,
      sellInWholesale: false,
      productType,
      genericName: get('Generic Name') || undefined,
      manufacturer: get('Manufacturer') || undefined,
      dosageForm: VALID_DOSAGE_FORMS.includes(dosageFormRaw) ? dosageFormRaw : undefined,
      strengthValue: parseNum(get('Strength Value')),
      strengthUnit: get('Strength Unit') || undefined,
      prescriptionRequired: get('Prescription Required') ? parseBool(get('Prescription Required')) : false,
      trackBatch: true,
      trackExpiry: get('Track Expiry') ? parseBool(get('Track Expiry')) : true,
      packageLevels: packageLevels.length > 0 ? packageLevels : undefined,
      sellingUnits: sellingUnits.length > 1 ? sellingUnits : undefined,
      // Legacy mirror so the existing POS dosage picker (Stage 7) already
      // works for this product today, ahead of POS reading sellingUnits
      // directly for independent per-level pricing.
      pharmacyBaseUnit: packageLevels.length > 0 ? baseUnit : undefined,
      pharmacyUnitLevels: packageLevels.length > 0 ? legacyLevels : undefined,
      tabPrice: packageLevels.length > 0 ? baseSellingPrice : undefined,
    };
    return { rowNumber, status: messages.length > 0 ? 'warning' : 'ready', product, messages };
  }

  const barcode = get('Barcode') || String(Math.floor(10000000 + Math.random() * 90000000));
  const product: Product = {
    id: 'p-' + Math.random().toString(36).slice(2, 11),
    name,
    sku: barcode,
    barcode,
    category: get('Category') || 'General',
    brand: get('Brand') || undefined,
    unit: baseUnit,
    costPrice,
    sellingPrice: baseSellingPrice,
    stockQty: shopStock + storeStock,
    shopStockQty: shopStock,
    storeStockQty: storeStock,
    alertQty,
    sellInRetail: true,
    sellInWholesale: false,
    productType,
    packageLevels: packageLevels.length > 0 ? packageLevels : undefined,
    sellingUnits: sellingUnits.length > 1 ? sellingUnits : undefined,
    isBulkProduct: packageLevels.length > 0 ? true : undefined,
    purchaseUnit: packageLevels.length > 0 ? packageLevels[packageLevels.length - 1].label : undefined,
    conversionToBaseUnit: packageLevels.length > 0 ? packageLevels[packageLevels.length - 1].quantityInBaseUnit : undefined,
    bulkUnit: packageLevels.length > 0 ? packageLevels[packageLevels.length - 1].label : undefined,
    bulkPurchaseQty: packageLevels.length > 0 ? packageLevels[packageLevels.length - 1].quantityInBaseUnit : undefined,
  };
  return { rowNumber, status: messages.length > 0 ? 'warning' : 'ready', product, messages };
}

export interface UniversalImportSummary {
  results: ImportRowResult[];
  readyProducts: Product[];
  ready: number;
  warning: number;
  error: number;
}

export function classifyUniversalImportRows(text: string): UniversalImportSummary {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return { results: [], readyProducts: [], ready: 0, warning: 0, error: 0 };
  }

  const headerIndex: Record<string, number> = {};
  rows[0].forEach((label, index) => { headerIndex[label.trim()] = index; });

  const results = rows.slice(1).map((columns, index) => parseUniversalImportRow(headerIndex, columns, index + 2));
  const readyProducts = results
    .filter(result => (result.status === 'ready' || result.status === 'warning') && result.product)
    .map(result => result.product!) as Product[];

  return {
    results,
    readyProducts,
    ready: results.filter(r => r.status === 'ready').length,
    warning: results.filter(r => r.status === 'warning').length,
    error: results.filter(r => r.status === 'error').length,
  };
}
