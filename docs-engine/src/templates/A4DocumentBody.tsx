import React from 'react';
import type { DocsDocumentData, DocsDocumentType } from '../types';

// Shared by Quotation, Proforma Invoice, Sales Invoice, and Delivery Note —
// the "single core template" the module's brief asked for. POS Receipt is
// the one type that doesn't belong here: it's a narrow 57–58mm thermal
// strip, not an A4 page, and gets its own body component + the
// createVisualReceiptPdf capture path instead of createVisualA4Pdf.
const TYPE_LABELS: Record<Exclude<DocsDocumentType, 'POS_RECEIPT'>, string> = {
  QUOTATION: 'Quotation',
  PROFORMA_INVOICE: 'Proforma Invoice',
  SALES_INVOICE: 'Sales Invoice',
  DELIVERY_NOTE: 'Delivery Note',
};

const money = (value: number, currencyCode: string) =>
  `${currencyCode} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

interface A4DocumentBodyProps {
  data: DocsDocumentData;
  brandColor: string;
}

export function A4DocumentBody({ data, brandColor }: A4DocumentBodyProps) {
  const label = TYPE_LABELS[data.type as Exclude<DocsDocumentType, 'POS_RECEIPT'>] || 'Document';
  const { subtotal, discount = 0, tax = 0, total } = data.totals;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-5">
        <div />
        <div className="text-right space-y-1 font-mono text-xs shrink-0">
          <div
            className="inline-block text-white text-sm font-black uppercase px-6 py-2.5 rounded-full mb-1 tracking-wider"
            style={{ backgroundColor: brandColor }}
          >
            {label}
          </div>
          <p className="text-slate-400">No: <strong className="text-slate-800">{data.documentNo}</strong></p>
          <p className="text-slate-400">Date: <span className="text-slate-700">{new Date(data.issuedAt).toLocaleDateString([], { dateStyle: 'long' })}</span></p>
          {data.validUntil && <p className="text-slate-400">Valid Until: <span className="text-slate-700">{new Date(data.validUntil).toLocaleDateString()}</span></p>}
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl px-4 py-3.5 border border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-mono">Customer</p>
        <p className="font-black text-slate-900 text-base">{data.customer.name || 'Customer'}</p>
        {data.customer.phone && <p className="text-xs text-slate-500 mt-1">{data.customer.phone}</p>}
        {data.customer.address && <p className="text-xs text-slate-500 mt-0.5">{data.customer.address}</p>}
      </div>

      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="text-white" style={{ backgroundColor: brandColor }}>
            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] rounded-l-xl w-8">#</th>
            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px]">Description</th>
            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] text-center">Qty</th>
            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] text-right">Unit Price</th>
            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] text-right rounded-r-xl">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
              <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
              <td className="py-3 px-4">
                <span className="font-semibold text-slate-800">{item.name}</span>
                {item.description && <span className="block text-[10px] text-slate-400 mt-0.5">{item.description}</span>}
              </td>
              <td className="py-3 px-4 text-center font-mono text-slate-700">{item.qty} {item.unit || ''}</td>
              <td className="py-3 px-4 text-right font-mono text-slate-700">{money(item.unitPrice, data.currencyCode)}</td>
              <td className="py-3 px-4 text-right font-black font-mono text-slate-900">{money(item.qty * item.unitPrice, data.currencyCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-start justify-between gap-6">
        {data.payment?.mode ? (
          <div className="bg-slate-50 rounded-xl px-4 py-3.5 border border-slate-100 min-w-[200px] text-xs">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Payment Details</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="text-slate-400">Mode</span><strong className="text-right text-slate-700">{data.payment.mode}</strong>
              {data.payment.accountNumber && <><span className="text-slate-400">Account No.</span><strong className="text-right text-slate-700 font-mono">{data.payment.accountNumber}</strong></>}
              {data.payment.accountName && <><span className="text-slate-400">Account Name</span><strong className="text-right text-slate-700">{data.payment.accountName}</strong></>}
            </div>
          </div>
        ) : <div />}

        <div className="min-w-[220px] text-xs space-y-1.5 font-mono">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(subtotal, data.currencyCode)}</span></div>
          {discount > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{money(discount, data.currencyCode)}</span></div>}
          {tax > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{money(tax, data.currencyCode)}</span></div>}
          <div className="flex justify-between text-slate-900 font-black text-sm pt-1.5 border-t border-slate-200">
            <span>Total</span><span>{money(total, data.currencyCode)}</span>
          </div>
        </div>
      </div>

      {data.notes && <p className="text-[11px] text-slate-500 whitespace-pre-line">{data.notes}</p>}
    </div>
  );
}
