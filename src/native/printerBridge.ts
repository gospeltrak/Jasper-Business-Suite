import { Capacitor, registerPlugin } from '@capacitor/core';
import type { OrvixNativePrinterBridge, PrinterDevice } from '../shared/utils/posDevices';

interface NativePrinterPlugin {
  listPrinters(): Promise<{ devices: PrinterDevice[] }>;
  connectPrinter(args: { id: string }): Promise<{ connected: boolean }>;
  disconnectPrinter(): Promise<void>;
  getStatus(): Promise<{ connected: boolean; printerId?: string }>;
  printText(args: Parameters<OrvixNativePrinterBridge['printText']>[0]): Promise<{ accepted: boolean }>;
  openBluetoothSettings(): Promise<void>;
}

// Registered only in the native Android QA APK. The website/PWA never calls it.
// Native installation source lives in scripts/native-android-printer.
const PrinterPlugin = registerPlugin<NativePrinterPlugin>('OrvixPrinter');

const bridge: OrvixNativePrinterBridge = {
  listPrinters: async () => (await PrinterPlugin.listPrinters()).devices,
  connectPrinter: id => PrinterPlugin.connectPrinter({ id }),
  disconnectPrinter: () => PrinterPlugin.disconnectPrinter(),
  getStatus: () => PrinterPlugin.getStatus(),
  printText: args => PrinterPlugin.printText(args),
  openBluetoothSettings: () => PrinterPlugin.openBluetoothSettings(),
};

export function getCapacitorPrinterBridge(): OrvixNativePrinterBridge | null {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' ? bridge : null;
}
