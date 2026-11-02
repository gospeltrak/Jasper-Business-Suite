import { Capacitor, registerPlugin } from '@capacitor/core';

interface OrvixPdfAttachmentPlugin {
  sharePdf(args: { fileName: string; base64Data: string; message: string }): Promise<{ opened: boolean }>;
}
const PdfAttachment = registerPlugin<OrvixPdfAttachmentPlugin>('OrvixPdfAttachment');

declare global {
  interface Window {
    __orvixSharePdfAttachment?: (pdf: File, message: string) => Promise<void>;
  }
}

async function asPdfBase64(file: File): Promise<string> {
  const result = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('PDF could not be read'));
    reader.onerror = () => reject(new Error('PDF could not be read'));
    reader.readAsDataURL(file);
  });
  if (!result.startsWith('data:application/pdf;base64,')) {
    throw new Error('Cannot share a non-PDF file.');
  }
  return result.slice('data:application/pdf;base64,'.length);
}

export function installOrvixNativePdfAttachmentShare(): void {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  window.__orvixSharePdfAttachment = async (file, message) => {
    if (file.type !== 'application/pdf' || file.size === 0 || file.size > 10 * 1024 * 1024) {
      throw new Error('Invalid PDF file size');
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^[^a-zA-Z0-9]+/, '').slice(0, 120);
    if (!safeName.endsWith('.pdf')) throw new Error('Invalid PDF filename');
    const base64Data = await asPdfBase64(file);
    const result = await PdfAttachment.sharePdf({ fileName: safeName, base64Data, message });
    if (!result.opened) throw new Error('Android share chooser did not open');
  };
}
