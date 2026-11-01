import * as XLSX from 'xlsx';

export interface ExcelSheet {
  name: string;
  rows: Record<string, unknown>[];
}

/**
 * Builds and downloads a real .xlsx workbook in the browser (no backend
 * involved) so every exported "template"/report in the app can hand
 * tenants an actual Excel file instead of a CSV -- not everyone's phone or
 * browser has something that opens CSV cleanly, but Excel/Sheets readers
 * are near-universal.
 */
export function downloadExcelFile(filename: string, sheets: ExcelSheet[]): void {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    // Sheet names are capped at 31 characters by the xlsx format itself.
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31) || 'Sheet1');
  });
  const finalName = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, finalName, { bookType: 'xlsx', compression: true });
}

export interface ExcelAoaSheet {
  name: string;
  /** Array-of-arrays: each inner array is one row, first row usually headers. */
  aoa: unknown[][];
}

/** Same as downloadExcelFile, but for plain row/column data instead of row objects. */
export function downloadExcelFileFromRows(filename: string, sheets: ExcelAoaSheet[]): void {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.aoa);
    // Keep exported catalogues/templates usable in Excel immediately:
    // visible headers, filter dropdowns and bounded column widths.
    const headerRow = sheet.aoa[0] || [];
    const maxWidth = 40;
    worksheet['!cols'] = headerRow.map((header, col) => ({
      wch: Math.min(maxWidth, Math.max(14,
        String(header || '').length + 2,
        ...sheet.aoa.slice(1, 40).map(row => String(row[col] ?? '').length + 2),
      )),
    }));
    if (headerRow.length > 0) {
      worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(0, sheet.aoa.length - 1), c: headerRow.length - 1 },
      }) };
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31) || 'Sheet1');
  });
  const finalName = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, finalName, { bookType: 'xlsx', compression: true });
}

/**
 * Reads an uploaded .xlsx/.xls File and converts its first sheet to CSV
 * text, so existing CSV-parsing import pipelines can accept Excel uploads
 * unchanged -- only the file-reading step needs to branch on file type.
 */
export async function readExcelFileAsCsvText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(worksheet);
}
