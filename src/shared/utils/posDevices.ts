import type { Sale } from '../../types';
import { getCapacitorPrinterBridge } from '../../native/printerBridge';

// Device preferences are local to this tablet/phone/browser and tenant. They are
// intentionally NOT written to the tenant workspace JSON or the database.
export type PaperWidthMm = 58 | 80;
export type ScannerMode = 'auto' | 'camera' | 'hardware';

export interface PosDevicePreferences {
  paperWidthMm: PaperWidthMm;
  automaticPrinting: boolean;
  receiptCopies: 1 | 2 | 3;
  autoReconnect: boolean;
  printLogo: boolean;
  scannerMode: ScannerMode;
  scannerFeedback: boolean;
  printer: { id: string; name: string } | null;
}

export const DEFAULT_POS_DEVICE_PREFERENCES: PosDevicePreferences = {
  paperWidthMm: 58,
  automaticPrinting: false,
  receiptCopies: 1,
  autoReconnect: true,
  printLogo: true,
  scannerMode: 'auto',
  scannerFeedback: true,
  printer: null,
};

const PREFERENCES_EVENT = 'orvix:pos-device-preferences';
const keyFor = (tenantId: string) => 'orvix:pos-devices:v1:' + encodeURIComponent(tenantId);

export function normalizePosDevicePreferences(value: unknown): PosDevicePreferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const selected = input.printer && typeof input.printer === 'object'
    ? input.printer as Record<string, unknown> : null;
  const id = typeof selected?.id === 'string' ? selected.id.trim() : '';
  const name = typeof selected?.name === 'string' ? selected.name.trim() : '';
  return {
    paperWidthMm: input.paperWidthMm === 80 ? 80 : 58,
    automaticPrinting: input.automaticPrinting === true,
    receiptCopies: input.receiptCopies === 2 || input.receiptCopies === 3 ? input.receiptCopies : 1,
    autoReconnect: input.autoReconnect !== false,
    printLogo: input.printLogo !== false,
    scannerMode: input.scannerMode === 'camera' || input.scannerMode === 'hardware'
      ? input.scannerMode : 'auto',
    scannerFeedback: input.scannerFeedback !== false,
    printer: id && name ? { id, name } : null,
  };
}

export function readPosDevicePreferences(tenantId: string): PosDevicePreferences {
  if (!tenantId || typeof window === 'undefined') return { ...DEFAULT_POS_DEVICE_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(keyFor(tenantId));
    return normalizePosDevicePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_POS_DEVICE_PREFERENCES };
  }
}

export function savePosDevicePreferences(tenantId: string, value: PosDevicePreferences): boolean {
  if (!tenantId || typeof window === 'undefined') return false;
  try {
    const normalized = normalizePosDevicePreferences(value);
    window.localStorage.setItem(keyFor(tenantId), JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(PREFERENCES_EVENT, { detail: { tenantId } }));
    return true;
  } catch {
    return false;
  }
}

export function subscribePosDevicePreferences(tenantId: string, onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const changed = (event: Event) => {
    if ((event as CustomEvent<{ tenantId: string }>).detail?.tenantId === tenantId) onChange();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === keyFor(tenantId)) onChange();
  };
  window.addEventListener(PREFERENCES_EVENT, changed);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(PREFERENCES_EVENT, changed);
    window.removeEventListener('storage', storage);
  };
}

export interface PrinterDevice {
  id: string;
  name: string;
}

// Android/iOS native wrappers may provide this explicit Promise-based bridge.
// A browser alone does not have direct access to generic Bluetooth ESC/POS printers.
// Never pretend that a paired phone printer is connected without native confirmation.
export interface OrvixNativePrinterBridge {
  listPrinters(): Promise<PrinterDevice[]>;
  connectPrinter(id: string): Promise<{ connected: boolean }>;
  disconnectPrinter(): Promise<void>;
  openBluetoothSettings?(): Promise<void>;
  getStatus(): Promise<{ connected: boolean; printerId?: string }>;
  printText(args: {
    printerId: string;
    jobId: string;
    text: string;
    paperWidthMm: PaperWidthMm;
    copies: 1 | 2 | 3;
    autoReconnect: boolean;
  }): Promise<{ accepted: boolean }>;
}

export function getOrvixNativePrinterBridge(): OrvixNativePrinterBridge | null {
  if (typeof window === 'undefined') return null;
  const capacitorBridge = getCapacitorPrinterBridge();
  if (capacitorBridge) return capacitorBridge;
  const bridge = (window as Window & { OrvixPrinter?: OrvixNativePrinterBridge }).OrvixPrinter;
  return bridge && typeof bridge.listPrinters === 'function'
    && typeof bridge.connectPrinter === 'function'
    && typeof bridge.getStatus === 'function'
    && typeof bridge.printText === 'function'
    && typeof bridge.disconnectPrinter === 'function'
      ? bridge : null;
}

const money = (value: number) => Math.round(Number(value) || 0).toLocaleString('en-TZ');

function wrapWords(value: string, width: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    // Long product names may include an unbroken SKU.
    for (let offset = 0; offset < word.length; offset += width) {
      const part = word.slice(offset, offset + width);
      if (line && line.length + part.length + 1 > width) {
        lines.push(line);
        line = '';
      }
      if (part.length === width) {
        if (line) lines.push(line);
        lines.push(part);
      } else {
        line = line ? line + ' ' + part : part;
      }
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

const twoColumns = (left: string, right: string, width: number): string => {
  const clippedRight = right.slice(0, width);
  const available = Math.max(0, width - clippedRight.length - 1);
  return left.slice(0, available).padEnd(width - clippedRight.length, ' ') + clippedRight;
};

export function formatPosReceiptForPrinter(
  sale: Sale,
  businessName: string,
  paperWidthMm: PaperWidthMm,
  language: 'sw' | 'en',
): string {
  const width = paperWidthMm === 58 ? 32 : 48;
  const sw = language === 'sw';
  const rows: string[] = [];
  rows.push(...wrapWords(businessName || 'Orvix', width).map(row => row.padStart(Math.floor((width + row.length) / 2))));
  rows.push('-'.repeat(width));
  rows.push(sw ? 'RISITI YA MAUZO' : 'SALES RECEIPT');
  rows.push(twoColumns(sw ? 'Namba' : 'Ref', sale.reference || sale.id, width));
  rows.push(twoColumns(sw ? 'Tarehe' : 'Date', new Date(sale.timestamp).toLocaleString('en-GB'), width));
  rows.push('-'.repeat(width));
  for (const item of sale.items) {
    rows.push(...wrapWords(item.productName || 'Product', width));
    const qty = Number(item.qty) || 0;
    const net = Number(item.lineTotal ?? item.subtotal ?? (qty * (Number(item.price) || 0)));
    rows.push(twoColumns(String(qty) + ' x ' + money(Number(item.price) || 0), money(net), width));
  }
  rows.push('-'.repeat(width));
  if (sale.deliveryCost) rows.push(twoColumns(sw ? 'Usafiri' : 'Delivery', money(sale.deliveryCost), width));
  rows.push(twoColumns(sw ? 'JUMLA' : 'TOTAL', money(sale.total), width));
  rows.push(twoColumns(sw ? 'Malipo' : 'Payment', sale.paymentMethod, width));
  rows.push('-'.repeat(width));
  rows.push(sw ? 'Asante kwa kununua!' : 'Thank you for shopping!');
  rows.push('Powered by Orvix');
  return rows.join('\n') + '\n\n\n';
}

const attempted = new Set<string>();
const inFlight = new Set<string>();

export type PrinterResult =
  | { status: 'sent' }
  | { status: 'already-sent' | 'busy' | 'not-connected' | 'not-supported' | 'failed'; reason?: string };

// Printing never writes sales or stock. Auto-print is best-effort and only after
// a confirmed sale save; it never silently calls the browser print dialog.
export async function sendNativeReceipt(
  tenantId: string,
  sale: Sale,
  businessName: string,
  language: 'sw' | 'en',
  kind: 'automatic' | 'manual',
): Promise<PrinterResult> {
  const prefs = readPosDevicePreferences(tenantId);
  const bridge = getOrvixNativePrinterBridge();
  if (!bridge) return { status: 'not-supported' };
  if (!prefs.printer) return { status: 'not-connected' };
  const id = tenantId + ':' + sale.id;
  if (kind === 'automatic' && attempted.has(id)) return { status: 'already-sent' };
  if (inFlight.has(id)) return { status: 'busy' };
  inFlight.add(id);
  try {
    const status = await bridge.getStatus();
    if ((!status.connected || status.printerId !== prefs.printer.id) && prefs.autoReconnect) {
      const connected = await bridge.connectPrinter(prefs.printer.id);
      if (!connected.connected) return { status: 'not-connected' };
    } else if (!status.connected || status.printerId !== prefs.printer.id) {
      return { status: 'not-connected' };
    }
    const jobId = id + ':' + (kind === 'automatic' ? 'auto' : 'manual-' + Date.now());
    const result = await bridge.printText({
      printerId: prefs.printer.id,
      jobId,
      text: formatPosReceiptForPrinter(sale, businessName, prefs.paperWidthMm, language),
      paperWidthMm: prefs.paperWidthMm,
      copies: prefs.receiptCopies,
      autoReconnect: prefs.autoReconnect,
    });
    if (!result.accepted) return { status: 'failed', reason: 'Printer did not accept the job.' };
    if (kind === 'automatic') attempted.add(id);
    return { status: 'sent' };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : 'Printer connection failed.' };
  } finally {
    inFlight.delete(id);
  }
}
