// Isolated QA harness. Renders the REAL Sales/POS component; no credentials,
// live tenant IDs, production database, or write endpoints are involved.
// Only used by the headless-browser benchmark workflow.
import '../src/shared/utils/onlineStorage';
import React from 'react';
import { createRoot } from 'react-dom/client';
import DashboardPOS from '../src/modules/pos/DashboardPOS';
import { LanguageProvider } from '../src/shared/contexts/LanguageContext';
import type { Product, Tenant, SystemSettings } from '../src/types';
import '../src/index.css';

declare global {
  interface Window { __ORVIX_BENCHMARK_READY__?: boolean; __ORVIX_BENCHMARK_ERRORS__?: string[]; }
}
window.__ORVIX_BENCHMARK_ERRORS__ = [];
window.addEventListener('error', event => {
  window.__ORVIX_BENCHMARK_ERRORS__?.push(String(event.message));
});

const args = new URLSearchParams(location.search);
const count = Math.max(5, Math.min(600, Number(args.get('count') || '250')));
const images = args.get('images') !== 'off';
const products: Product[] = Array.from({ length: count }, (_, index) => ({
  id: 'qa-perf-p-' + index,
  name: 'QA Performance Item ' + String(index + 1).padStart(3, '0'),
  sku: 'PERF-' + index,
  barcode: 'PERF-' + index,
  category: 'General',
  costPrice: 3000,
  sellingPrice: (index + 1) * 1000,
  stockQty: 9999,
  shopStockQty: 9999,
  storeStockQty: 0,
  alertQty: 5,
  sellInRetail: true,
  isBulkProduct: false,
})) as Product[];

const tenant = {
  id: 'qa-isolated-no-real-tenant',
  name: 'QA Isolated Test',
  businessType: 'retail',
  currency: 'TSh ',
  taxRate: 0,
} as Tenant;
const settings = {
  posSettings: { showProductImages: images },
  company: { currency: 'TSh ' },
  business: { paymentModes: ['Cash'], deliveryPaymentModes: ['Cash'] },
} as SystemSettings;

function ReadyMarker() {
  React.useEffect(() => { window.__ORVIX_BENCHMARK_READY__ = true; }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <DashboardPOS
      activeTenant={tenant}
      products={products}
      onUpdateStocks={() => {}}
      onAddSale={() => true}
      userName="Performance Tester"
      isOfflineMode={false}
      systemSettings={settings}
    />
    <ReadyMarker/>
  </LanguageProvider>
);
