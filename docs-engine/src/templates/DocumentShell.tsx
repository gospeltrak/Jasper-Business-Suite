import React from 'react';
import type { DocsBranding } from '../types';

// A4 794×1123px white card — the exact page geometry
// src/components/DashboardSalesList.tsx already uses for its own
// `sales-document-a4-pdf-template` (794px = 210mm, 1123px = 297mm at 96dpi).
// Matching it means this component and the ERP's own document preview look
// like the same product, and both feed the same screenshot-based
// src/utils/pdfShare.ts pipeline (see docs-engine/src/render.md), so the
// downloaded PDF is guaranteed to match whatever is on screen here too.
const DEFAULT_BRAND_COLOR = '#4f46e5';

interface DocumentShellProps {
  elementId: string;
  branding: DocsBranding;
  showWatermark: boolean;
  children: React.ReactNode;
}

export function DocumentShell({ elementId, branding, showWatermark, children }: DocumentShellProps) {
  const brandColor = branding.brandColor || DEFAULT_BRAND_COLOR;

  return (
    <div
      id={elementId}
      style={{ width: '794px', minHeight: '1123px' }}
      className="bg-white shadow-2xl font-sans relative print:shadow-none print:min-h-0 shrink-0"
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #${elementId}, #${elementId} * { visibility: visible !important; }
          #${elementId} { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; transform: none !important; margin: 0 !important; }
        }
      `}</style>

      <div className="p-8 space-y-5 flex flex-col" style={{ minHeight: '1123px' }}>
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                referrerPolicy="no-referrer"
                className="max-h-16 max-w-[200px] object-contain rounded-xl select-none mb-3"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl mb-3"
                style={{ backgroundColor: brandColor }}
              >
                {branding.businessName.charAt(0)}
              </div>
            )}
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{branding.businessName}</h2>
            {branding.city && <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide font-semibold">{branding.city}</p>}
            {branding.address && <p className="text-[11px] text-slate-500 mt-0.5">{branding.address}</p>}
            {branding.phone && <p className="text-[11px] text-slate-500">Tel: {branding.phone}</p>}
            {branding.email && <p className="text-[11px] text-slate-500">Email: {branding.email}</p>}
            {branding.tinNumber && <p className="text-[11px] text-slate-500 font-mono">TIN: {branding.tinNumber}</p>}
            {branding.vatNumber && <p className="text-[11px] text-slate-500 font-mono">VAT: {branding.vatNumber}</p>}
          </div>
        </div>

        <div className="flex-1">{children}</div>

        {/* The ONE place free-tier watermarking lives — mirrors
            docs/orvix-docs-architecture.md section 4/9: tier is resolved
            before this component ever renders, never trusted from a prop
            the caller could fake past this point. */}
        {showWatermark && (
          <div className="pt-4 mt-auto border-t border-dashed border-slate-200 text-center">
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide">
              Made with Orvix Docs — orvix.africa/docs
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
