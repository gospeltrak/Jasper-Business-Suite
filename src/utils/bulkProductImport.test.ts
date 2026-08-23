import { describe, expect, it } from 'vitest';
import {
  classifyUniversalImportRows,
  parseCsvText,
  parseUniversalImportRow,
  UNIVERSAL_IMPORT_HEADERS,
} from './bulkProductImport';

describe('parseCsvText', () => {
  it('parses a simple multi-row CSV', () => {
    const rows = parseCsvText('Name,Qty\r\nRice,10\r\nWheat,5\r\n');
    expect(rows).toEqual([['Name', 'Qty'], ['Rice', '10'], ['Wheat', '5']]);
  });

  it('handles a quoted field containing a comma', () => {
    const rows = parseCsvText('Name,Note\r\n"Rice, 5kg",ok\r\n');
    expect(rows[1]).toEqual(['Rice, 5kg', 'ok']);
  });

  it('handles a doubled quote inside a quoted field', () => {
    const rows = parseCsvText('Name\r\n"Tenant\'s ""Best"" Rice"\r\n');
    expect(rows[1]).toEqual(['Tenant\'s "Best" Rice']);
  });

  it('drops blank lines', () => {
    const rows = parseCsvText('Name,Qty\r\n\r\nRice,10\r\n');
    expect(rows).toEqual([['Name', 'Qty'], ['Rice', '10']]);
  });
});

const headerIndex = Object.fromEntries(UNIVERSAL_IMPORT_HEADERS.map((label, index) => [label, index]));

const amoxicillinColumns = [
  'Amoxicillin 500mg', '', 'Medicine', 'Antibiotics', 'Jasper Pharma',
  'Amoxicillin', 'capsule', '500', 'mg',
  'Capsule', 'Box',
  'Blister', '10', '3500',
  'Box', '100', '30000',
  '400', '20000',
  '50', '100', '10',
  'Yes', 'Yes',
];

describe('parseUniversalImportRow', () => {
  it('builds a fully valid Medicine product with independent package prices preserved', () => {
    const result = parseUniversalImportRow(headerIndex, amoxicillinColumns, 2);
    expect(result.status).toBe('ready');
    expect(result.product?.productType).toBe('medicine');
    expect(result.product?.genericName).toBe('Amoxicillin');
    expect(result.product?.trackExpiry).toBe(true);
    expect(result.product?.packageLevels).toEqual([
      { id: 'package1', label: 'Blister', quantityInBaseUnit: 10 },
      { id: 'package2', label: 'Box', quantityInBaseUnit: 100 },
    ]);
    const su = result.product?.sellingUnits || [];
    expect(su.find(u => u.id === 'su-package1')?.price).toBe(3500);
    expect(su.find(u => u.id === 'su-package2')?.price).toBe(30000);
    // 10 * 400 = 4000, but the sheet's independent Blister price (3500) must win
    expect(su.find(u => u.id === 'su-package1')?.price).not.toBe(4000);
  });

  it('rejects a row with no Product Name', () => {
    const columns = [...amoxicillinColumns];
    columns[headerIndex['Product Name']] = '';
    const result = parseUniversalImportRow(headerIndex, columns, 3);
    expect(result.status).toBe('error');
    expect(result.messages[0]).toContain('Product Name is required');
  });

  it('rejects a package unit with no valid base-unit conversion, matching the spec example', () => {
    const columns = [...amoxicillinColumns];
    columns[headerIndex['Package 1 Qty in Base']] = '0';
    const result = parseUniversalImportRow(headerIndex, columns, 4);
    expect(result.status).toBe('error');
    expect(result.messages.some(m => m.includes('Blister') && m.includes('no valid Base Unit conversion'))).toBe(true);
  });

  it('builds a non-medicine product without any clinical fields', () => {
    const columns = [
      'Nivea Body Lotion', '', 'Personal Care', 'Body Care', 'Nivea',
      '', '', '', '',
      'Bottle', '',
      '', '', '',
      '', '', '',
      '8500', '6000',
      '15', '30', '5',
      'No', 'No',
    ];
    const result = parseUniversalImportRow(headerIndex, columns, 5);
    expect(result.status).toBe('ready');
    expect(result.product?.productType).toBe('personal_care');
    expect(result.product?.genericName).toBeUndefined();
    expect(result.product?.dosageForm).toBeUndefined();
    expect(result.product?.trackExpiry).toBeUndefined();
  });
});

describe('classifyUniversalImportRows', () => {
  it('classifies a mixed sheet: one ready, one error, and does not let the bad row block the good one', () => {
    const header = UNIVERSAL_IMPORT_HEADERS.join(',');
    const goodRow = amoxicillinColumns.join(',');
    const badColumns = [...amoxicillinColumns];
    badColumns[headerIndex['Product Name']] = '';
    const badRow = badColumns.join(',');

    const summary = classifyUniversalImportRows(`${header}\r\n${goodRow}\r\n${badRow}\r\n`);
    expect(summary.ready).toBe(1);
    expect(summary.error).toBe(1);
    expect(summary.readyProducts).toHaveLength(1);
    expect(summary.readyProducts[0].name).toBe('Amoxicillin 500mg');
  });

  it('returns an empty summary for an empty sheet', () => {
    const summary = classifyUniversalImportRows('');
    expect(summary).toEqual({ results: [], readyProducts: [], ready: 0, warning: 0, error: 0 });
  });
});
