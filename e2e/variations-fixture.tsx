/**
 * Isolated browser fixture for *real Orvix React components*, not a demo route
 * in the shipped application. E2E browser tests run this through Vite in CI.
 * Never import this fixture from src/main.tsx or deploy it to production.
 * Its "backend" is same-origin sessionStorage; no Supabase keys/tenant IDs.
 */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DashboardProducts from '../src/modules/products/DashboardProducts';
import DashboardPOS from '../src/modules/pos/DashboardPOS';
import { reverseSaleInventory } from '../src/modules/sales/utils/saleSync';
import type { Product, Sale, SystemSettings, Tenant } from '../src/types';
import '../src/index.css';

const KEY = 'orvix-isolated-product-variations-e2e';
const tenant: Tenant = {
  id: 'e2e-local-only-do-not-use-in-cloud',
  name: 'E2E Test Store',
  country: 'Tanzania',
  city: 'Dar es Salaam',
  currency: 'TSh',
  currencyCode: 'TZS',
  taxRate: 0,
  mobileMoneyProviders: [],
  businessType: 'retail'
};

const template: Product = {
  id: 'e2e-parent',
  name: 'QA Juice',
  sku: '6151111111101',
  barcode: '6151111111101',
  category: 'Beverages',
  unit: 'pcs',
  costPrice: 450,
  sellingPrice: 1000,
  stockQty: 0,
  shopStockQty: 0,
  storeStockQty: 0,
  alertQty: 2,
  sellInRetail: true,
  sellInWholesale: false,
  isVariationParent: true
};
const makeChild = (id: string, label: string, barcode: string, cost: number, price: number, shop: number): Product => ({
  ...template, id, name: 'QA Juice — ' + label, sku: barcode, barcode, isVariationParent: false,
  variationParentId: template.id, variationLabel: label, costPrice: cost, sellingPrice: price,
  stockQty: shop, shopStockQty: shop, storeStockQty: 0
});
const seededProducts: Product[] = [
  template,
  makeChild('e2e-child-350', '350ml', '6151111111102', 450, 1000, 15),
  makeChild('e2e-child-500', '500ml', '6151111111103', 650, 1500, 8),
  { ...template, id:'e2e-normal-1', name:'QA Water', sku:'6151111111104', barcode:'6151111111104',
    isVariationParent: false, sellingPrice: 800, shopStockQty: 10, stockQty: 10 },
  { ...template, id:'e2e-normal-2', name:'QA Cookies', sku:'6151111111105', barcode:'6151111111105',
    isVariationParent: false, sellingPrice: 1200, shopStockQty: 10, stockQty: 10 }
];
type Store = { products: Product[]; sales: Sale[] };
const initial = (): Store => {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || '');
    if (Array.isArray(value.products) && Array.isArray(value.sales)) return value;
  } catch {}
  return { products: seededProducts, sales: [] };
};
const settings = {
  business: { paymentModes: ['Cash','Mobile Money','Bank'] },
  company: { currency:'TSh' },
  productStore: { categories:['Beverages'], brands: [] },
  posSettings: { showProductImages: true }
} as unknown as SystemSettings;

function TestWorkbench() {
  const [state, setState] = useState<Store>(initial);
  const [tab, setTab] = useState<'products' | 'pos'>('pos');
  const [saveCalls, setSaveCalls] = useState(0);
  useEffect(() => { sessionStorage.setItem(KEY, JSON.stringify(state)); }, [state]);
  const onAddProducts = async (incoming: Product[]) => {
    // Intentional delay probes the in-flight duplicate-submit guard.
    await new Promise<void>(resolve => setTimeout(resolve, 180));
    setState(current => ({...current, products:[...incoming,...current.products]}));
    setSaveCalls(value => value + 1);
    return true;
  };
  const updateProducts = async (updated: Product[], changedIds?: string[]) => {
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    const ids = new Set(changedIds || updated.map(product => product.id));
    const incomingById = new Map(updated.filter(product => ids.has(product.id)).map(p=>[p.id,p]));
    setState(current => ({
      ...current,
      products:[
        ...current.products.map(p => incomingById.get(p.id) || p),
        ...[...incomingById.values()].filter(p => !current.products.some(currentProduct => currentProduct.id === p.id))
      ]
    }));
    return true;
  };
  const addSale = async (sale: Sale) => {
    setState(current => ({ ...current, sales: [...current.sales, sale] }));
    return true;
  };
  const updateStocks = (products: Product[]) => {
    setState(current => ({
      ...current,
      products: current.products.map(p => products.find(other => other.id === p.id) || p)
    }));
  };
  const reverseLatest = () => {
    const latest = state.sales.at(-1);
    if (!latest) return;
    setState(current => ({
      products: reverseSaleInventory(latest, current.products, new Date().toISOString()),
      sales: current.sales
    }));
  };
  const ledger = {
    products: state.products.map(p=>({
      id:p.id,name:p.name,parent:p.variationParentId || null,
      isParent:!!p.isVariationParent,shop:p.shopStockQty,store:p.storeStockQty,
      price:p.sellingPrice,barcode:p.barcode
    })),
    sales: state.sales.map(s=>({
      id:s.id,total:s.total,items:s.items.map(i=>({
        productId:i.productId,variationParentId:i.variationParentId,
        variationLabel:i.variationLabel,price:i.price,qty:i.qty
      }))
    })),
    saveCalls
  };
  return (
    <div id="dashboard-scaffold" style={{position:'relative',minHeight:'100vh',height:'auto',overflow:'visible',background:'#f8fafc'}}>
      <nav style={{display:'flex',gap:12,padding:12,position:'relative',zIndex:2}}>
        <button data-testid="open-products" onClick={()=>setTab('products')}>Products</button>
        <button data-testid="open-pos" onClick={()=>setTab('pos')}>POS</button>
        <button data-testid="refund-last-sale" onClick={reverseLatest}>Return latest sale</button>
      </nav>
      <div style={{padding:8}}>
        {tab==='products'
          ? <DashboardProducts
              activeTenant={tenant} products={state.products}
              systemSettings={settings} onUpdateSettings={()=>{}}
              onAddProduct={p=>onAddProducts([p])}
              onAddProducts={onAddProducts}
              onDeleteProduct={()=>{}}
              onUpdateProducts={updateProducts}
            />
          : <DashboardPOS
              activeTenant={tenant} products={state.products}
              onUpdateStocks={updateStocks} onAddSale={addSale}
              userName="QA Tester" isOfflineMode={false}
              systemSettings={settings}
            />}
      </div>
      <pre data-testid="ledger" style={{position:'absolute',left:-10000,top:0}}>{JSON.stringify(ledger)}</pre>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<TestWorkbench />);
