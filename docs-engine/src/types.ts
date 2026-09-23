// Shared shape every Orvix Docs template renders from. Deliberately plain
// data, not a Prisma model — a FREE-tier generation never touches Prisma at
// all (see docs/orvix-docs-architecture.md section 10), so the render layer
// can't depend on anything database-shaped.

export type DocsDocumentType =
  | 'QUOTATION'
  | 'PROFORMA_INVOICE'
  | 'SALES_INVOICE'
  | 'POS_RECEIPT'
  | 'DELIVERY_NOTE';

export interface DocsLineItem {
  name: string;
  description?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
}

export interface DocsCustomer {
  name: string;
  phone?: string;
  address?: string;
}

export interface DocsTotals {
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
}

export interface DocsPaymentDetails {
  mode?: string;
  accountNumber?: string;
  accountName?: string;
  amount?: number;
}

// Everything a template needs to render one document. Filled in by hand on
// the form for a walk-in FREE user; optionally prefilled from
// api/docs-bridge/* for an account that linked an existing ERP tenant — the
// template itself never knows or cares which.
export interface DocsDocumentData {
  type: DocsDocumentType;
  documentNo: string;
  issuedAt: string; // ISO date
  validUntil?: string; // quotations only
  currencyCode: string; // e.g. 'TZS'
  customer: DocsCustomer;
  items: DocsLineItem[];
  totals: DocsTotals;
  payment?: DocsPaymentDetails;
  notes?: string;
}

export interface DocsBranding {
  businessName: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  tinNumber?: string;
  vatNumber?: string;
  logoUrl?: string | null;
  brandColor?: string; // defaults to the standard Orvix emerald if unset
}
