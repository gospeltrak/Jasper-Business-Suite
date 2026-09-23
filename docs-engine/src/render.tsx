import React from 'react';
import { downloadPdfFromElement, printPdfFromElement, shareElementPdfToWhatsApp } from '../../src/shared/utils/pdfShare';
import { DocumentShell } from './templates/DocumentShell';
import { A4DocumentBody } from './templates/A4DocumentBody';
import type { DocsBranding, DocsDocumentData } from './types';

// Correction from the first draft of docs/orvix-docs-architecture.md section 4:
// src/utils/pdfShare.ts's screenshot capture (createVisualA4Pdf /
// createVisualReceiptPdf, via html-to-image) runs in the BROWSER against a
// real mounted DOM element — it needs `document`, `Image.decode()`, Canvas,
// fonts.ready, none of which exist in a Node serverless function without a
// full headless-Chromium stack the rest of this app doesn't use anywhere.
// So generation is client-side, exactly like the ERP's own receipts/
// invoices/quotations already are: this component mounts the document,
// pdfShare.ts's existing functions capture whatever is on screen. There is
// no server-side "renderToStaticPdf" — that was wrong in the first draft.
//
// Persistence (Premium only) is a separate step layered on top after the
// browser has the finished PDF File in hand — see downloadOrPersist below.

export const DOCS_DOCUMENT_ELEMENT_ID = 'docs-document-pdf-template';

interface DocsDocumentProps {
  data: DocsDocumentData;
  branding: DocsBranding;
  showWatermark: boolean;
}

// The one shared template mount. POS_RECEIPT is intentionally out of scope
// for this first template (see A4DocumentBody's note) — every other type
// renders through this same shell + body pair, which is the "single core
// template system" the module's brief asked for.
export function DocsDocument({ data, branding, showWatermark }: DocsDocumentProps) {
  return (
    <DocumentShell elementId={DOCS_DOCUMENT_ELEMENT_ID} branding={branding} showWatermark={showWatermark}>
      <A4DocumentBody data={data} brandColor={branding.brandColor || '#4f46e5'} />
    </DocumentShell>
  );
}

const fileNameFor = (data: DocsDocumentData) =>
  `${data.type.toLowerCase().replace(/_/g, '-')}-${data.documentNo}`;

// FREE tier: render → download. Nothing else happens — no network call
// carries the document content anywhere (see section 10, "why FREE writes
// nothing to the database").
export async function downloadDocsDocument(data: DocsDocumentData) {
  return downloadPdfFromElement({ elementId: DOCS_DOCUMENT_ELEMENT_ID, fileName: fileNameFor(data), format: 'a4' });
}

export async function printDocsDocument(data: DocsDocumentData) {
  return printPdfFromElement({ elementId: DOCS_DOCUMENT_ELEMENT_ID, fileName: fileNameFor(data), format: 'a4' });
}

export async function shareDocsDocumentToWhatsApp(data: DocsDocumentData, phone: string) {
  return shareElementPdfToWhatsApp({
    elementId: DOCS_DOCUMENT_ELEMENT_ID,
    fileName: fileNameFor(data),
    format: 'a4',
    phone,
    message: `Please find your ${data.type.replace(/_/g, ' ').toLowerCase()} attached.`,
  });
}

// PREMIUM tier only: same download the FREE path does, PLUS upload the
// resulting File to POST /api/docs/documents so it lands in the Invoice
// Tracking dashboard. Kept as a separate function rather than a branch
// inside downloadDocsDocument so the FREE path can never accidentally grow
// a persistence side effect later.
export async function downloadAndPersistDocsDocument(data: DocsDocumentData) {
  const pdfFile = await downloadDocsDocument(data);
  const body = new FormData();
  body.append('pdf', pdfFile);
  body.append('document', JSON.stringify(data));
  const response = await fetch('/api/docs/documents', { method: 'POST', body });
  if (!response.ok) throw new Error('Could not save this document to your Invoice Tracking dashboard.');
  return response.json();
}
