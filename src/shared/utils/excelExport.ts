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
  XLSX.writeFile(workbook, finalName);
}
