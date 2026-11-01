// Isolated QA performance fixture for the REAL DashboardPOS component.
// No production backend, tenant writes, or actual customer data are used.
import React from 'react';
import { createRoot } from 'react-dom/client';
import DashboardPOS from '../../src/modules/pos/DashboardPOS';
import { LanguageProvider } from '../../src/shared/contexts/LanguageContext';
import type { Product, Tenant } from '../../src/types';
import '../../src/index.css';

const activeTenant: Tenant = {
  id: 'qa-pos-benchmark', name: 'QA Test Shop', country: 'Tanzania', city: 'Dar es Salaam',
  currency: 'TSh', currencyCode: 'TZS', taxRate: 0,
  mobileMoneyProviders: [], businessType: 'retail', subscriptionStatus: 'active',
};

const products: Product[] = Array.from({ length: 180 }, (_, i) => ({
  id: `bench-${i+1}`,
  name: `Bench product ${i+1}`,
  sku: `TEST-${i+1}`,
  barcode: `QA-${i+1}`,
  category: 'General',
  costPrice: 800,
  sellingPrice: 15000 + 1000 * i,
  stockQty: 1000,
  shopStockQty: 1000,
  storeStockQty: 0,
  alertQty: 5,
  sellInRetail: true,
  sellInWholesale: false,
}));

const root = document.getElementById('root');
if (!root) throw new Error('POS benchmark root missing');
createRoot(root).render(
  <LanguageProvider>
    <DashboardPOS
      activeTenant={activeTenant}
      products={products}
      onUpdateStocks={() => {}}
      onAddSale={() => false}
      userName="QA Cashier"
      isOfflineMode={false}
      systemSettings={undefined}
    />
  </LanguageProvider>,
);
