import { MsUnit, MsPaymentMethod, MsItem, MsConversion, MsBatch, MsSale, MsExpense, MsDelivery, MsExpenseCategory, MsBusinessSettings, MsBrandingSettings } from './MicroSokoTypes';

export const demoBusinessSettings: MsBusinessSettings = {
  name: 'MicroSoko Demo Shop',
  ownerName: 'Demo Owner',
  phone: '+255 700 000 000',
  currency: 'TZS',
  location: 'Dar es Salaam',
  address: 'Demo Street, Dar es Salaam',
  region: 'Dar es Salaam',
  defaultSellingMethod: 'fifo',
  isDemo: true
};

export const demoBrandingSettings: MsBrandingSettings = {
  themeColor: '#10b981',
  secondaryColor: '#64748b',
  receiptHeader: 'MicroSoko Demo Shop',
  receiptFooter: 'Asante kwa kununua kwetu. Karibu tena.',
  address: 'Demo Street, Dar es Salaam',
  phone: '+255 700 000 000',
  isDemo: true
};

const getIsoDateMinusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

export const demoUnits: MsUnit[] = [
  { id: 'demo_u1', name: 'Kg', isActive: true, isDemo: true },
  { id: 'demo_u2', name: 'Litre', isActive: true, isDemo: true },
  { id: 'demo_u3', name: 'Piece', isActive: true, isDemo: true },
  { id: 'demo_u4', name: 'Gunia', isActive: true, isDemo: true },
  { id: 'demo_u5', name: 'Ndoo', isActive: true, isDemo: true },
  { id: 'demo_u6', name: 'Packet', isActive: true, isDemo: true },
  { id: 'demo_u7', name: 'Bottle', isActive: true, isDemo: true },
  { id: 'demo_u8', name: 'Plate', isActive: true, isDemo: true },
  { id: 'demo_u9', name: 'Box', isActive: true, isDemo: true },
  { id: 'demo_u10', name: 'Sack', isActive: true, isDemo: true }
];

export const demoPaymentMethods: MsPaymentMethod[] = [
  { id: 'demo_pm1', name: 'Cash', isActive: true, isDefault: true, isDemo: true },
  { id: 'demo_pm2', name: 'M-Pesa', isActive: true, isDefault: false, isDemo: true },
  { id: 'demo_pm3', name: 'Tigo Pesa', isActive: true, isDefault: false, isDemo: true },
  { id: 'demo_pm4', name: 'Airtel Money', isActive: true, isDefault: false, isDemo: true },
  { id: 'demo_pm5', name: 'Mix', isActive: true, isDefault: false, isDemo: true }
];

export const demoExpenseCategories: MsExpenseCategory[] = [
  { id: 'demo_ec1', name: 'Rent', isActive: true, isDemo: true },
  { id: 'demo_ec2', name: 'Salary', isActive: true, isDemo: true },
  { id: 'demo_ec3', name: 'Electricity', isActive: true, isDemo: true },
  { id: 'demo_ec4', name: 'Water', isActive: true, isDemo: true },
  { id: 'demo_ec5', name: 'Cleaning', isActive: true, isDemo: true },
  { id: 'demo_ec6', name: 'Internet', isActive: true, isDemo: true },
  { id: 'demo_ec7', name: 'Maintenance', isActive: true, isDemo: true }
];

export const demoItems: MsItem[] = [
  { id: 'demo_i1', name: 'Viazi', type: 'raw_material', unitId: 'demo_u4', stock: 1, averageCost: 65000, latestCost: 65000, sellingPrice: 0, showOnPos: false, sellingMethod: 'fifo', lowStockAlert: 1, batches: [
    { id: 'demo_b1', itemId: 'demo_i1', source: 'purchase', batchNumber: 'B-VIAZI', date: getIsoDateMinusDays(5), costPerUnit: 65000, quantityCreated: 2, quantityRemaining: 1, suggestedSellingPrice: 0, status: 'active', isDemo: true }
  ], isDemo: true },
  { id: 'demo_i2', name: 'Mafuta ya kupikia', type: 'raw_material', unitId: 'demo_u2', stock: 15, averageCost: 4750, latestCost: 4750, sellingPrice: 0, showOnPos: false, sellingMethod: 'fifo', lowStockAlert: 5, batches: [
    { id: 'demo_b2', itemId: 'demo_i2', source: 'purchase', batchNumber: 'B-MAFUTA', date: getIsoDateMinusDays(5), costPerUnit: 4750, quantityCreated: 20, quantityRemaining: 15, suggestedSellingPrice: 0, status: 'active', isDemo: true }
  ], isDemo: true },
  { id: 'demo_i3', name: 'Chumvi', type: 'raw_material', unitId: 'demo_u6', stock: 10, averageCost: 500, latestCost: 500, sellingPrice: 0, showOnPos: false, sellingMethod: 'fifo', lowStockAlert: 2, batches: [], isDemo: true },
  { id: 'demo_i4', name: 'Food Pack', type: 'packaging', unitId: 'demo_u3', stock: 200, averageCost: 200, latestCost: 200, sellingPrice: 0, showOnPos: false, sellingMethod: 'fifo', lowStockAlert: 50, batches: [], isDemo: true },
  { id: 'demo_ic1', name: 'Gas', type: 'operational_cost', unitId: 'demo_u1', stock: 1, averageCost: 25000, latestCost: 25000, sellingPrice: 0, showOnPos: false, sellingMethod: 'fifo', lowStockAlert: 0, batches: [], isDemo: true },
  { id: 'demo_ic2', name: 'Wages', type: 'operational_cost', unitId: 'demo_u3', stock: 1, averageCost: 10000, latestCost: 10000, sellingPrice: 0, showOnPos: false, sellingMethod: 'fifo', lowStockAlert: 0, batches: [], isDemo: true },
  
  { id: 'demo_i5', name: 'Chips Plate', type: 'finished_product', unitId: 'demo_u8', stock: 35, averageCost: 1200, latestCost: 1200, sellingPrice: 3000, showOnPos: true, posDisplayName: 'Chips', posColor: '#f59e0b', allowDiscount: false, sellingMethod: 'fifo', lowStockAlert: 10, batches: [
    { id: 'demo_b3', itemId: 'demo_i5', source: 'production', batchNumber: 'PR-CHIPS-1', date: getIsoDateMinusDays(2), costPerUnit: 1200, quantityCreated: 80, quantityRemaining: 35, suggestedSellingPrice: 3000, status: 'active', isDemo: true }
  ], isDemo: true },
  { id: 'demo_i6', name: 'Mahindi', type: 'raw_material', unitId: 'demo_u5', stock: 2, averageCost: 17600, latestCost: 17600, sellingPrice: 0, showOnPos: false, sellingMethod: 'fifo', lowStockAlert: 1, batches: [
    { id: 'demo_b4', itemId: 'demo_i6', source: 'purchase', batchNumber: 'B-MAHINDI', date: getIsoDateMinusDays(6), costPerUnit: 17600, quantityCreated: 5, quantityRemaining: 2, suggestedSellingPrice: 0, status: 'active', isDemo: true }
  ], isDemo: true },
  { id: 'demo_i7', name: 'Pumba', type: 'by_product', unitId: 'demo_u1', stock: 15, averageCost: 0, latestCost: 0, sellingPrice: 300, showOnPos: true, posDisplayName: 'Pumba', posColor: '#8b5cf6', allowDiscount: true, sellingMethod: 'fifo', lowStockAlert: 5, batches: [], isDemo: true },
  { id: 'demo_i8', name: 'Unga wa Sembe', type: 'finished_product', unitId: 'demo_u6', stock: 20, averageCost: 1800, latestCost: 1800, sellingPrice: 2500, showOnPos: true, posDisplayName: 'Sembe', posColor: '#10b981', allowDiscount: false, sellingMethod: 'fifo', lowStockAlert: 5, batches: [
    { id: 'demo_b5', itemId: 'demo_i8', source: 'production', batchNumber: 'PR-SEMBE-1', date: getIsoDateMinusDays(4), costPerUnit: 1800, quantityCreated: 50, quantityRemaining: 20, suggestedSellingPrice: 2500, status: 'active', isDemo: true }
  ], isDemo: true },
  { id: 'demo_i9', name: 'Alizeti', type: 'raw_material', unitId: 'demo_u10', stock: 5, averageCost: 40000, latestCost: 40000, sellingPrice: 0, showOnPos: false, sellingMethod: 'fifo', lowStockAlert: 2, batches: [], isDemo: true },
  { id: 'demo_i10', name: 'Shudu', type: 'by_product', unitId: 'demo_u1', stock: 20, averageCost: 0, latestCost: 0, sellingPrice: 500, showOnPos: true, posDisplayName: 'Shudu', posColor: '#eab308', allowDiscount: true, sellingMethod: 'fifo', lowStockAlert: 5, batches: [], isDemo: true },
  { id: 'demo_i11', name: 'Mafuta ya Alizeti 1L', type: 'finished_product', unitId: 'demo_u7', stock: 12, averageCost: 5500, latestCost: 5500, sellingPrice: 8000, showOnPos: true, posDisplayName: 'Mafuta', posColor: '#f97316', allowDiscount: false, sellingMethod: 'fifo', lowStockAlert: 5, batches: [
    { id: 'demo_b6', itemId: 'demo_i11', source: 'production', batchNumber: 'PR-MAFUTA-1', date: getIsoDateMinusDays(3), costPerUnit: 5500, quantityCreated: 40, quantityRemaining: 12, suggestedSellingPrice: 8000, status: 'active', isDemo: true }
  ], isDemo: true },
  { id: 'demo_i12', name: 'Juice Bottle', type: 'finished_product', unitId: 'demo_u7', stock: 50, averageCost: 800, latestCost: 800, sellingPrice: 2000, showOnPos: true, posDisplayName: 'Juice', posColor: '#ec4899', allowDiscount: true, sellingMethod: 'fifo', lowStockAlert: 10, batches: [
    { id: 'demo_b7', itemId: 'demo_i12', source: 'purchase', batchNumber: 'B-JUICE', date: getIsoDateMinusDays(8), costPerUnit: 800, quantityCreated: 100, quantityRemaining: 50, suggestedSellingPrice: 2000, status: 'active', isDemo: true }
  ], isDemo: true },
  { id: 'demo_i13', name: 'Maandazi', type: 'finished_product', unitId: 'demo_u3', stock: 10, averageCost: 150, latestCost: 150, sellingPrice: 500, showOnPos: true, posDisplayName: 'Andazi', posColor: '#a8a29e', allowDiscount: false, sellingMethod: 'fifo', lowStockAlert: 10, batches: [
    { id: 'demo_b8', itemId: 'demo_i13', source: 'production', batchNumber: 'PR-ANDAZI-1', date: getIsoDateMinusDays(1), costPerUnit: 150, quantityCreated: 50, quantityRemaining: 10, suggestedSellingPrice: 500, status: 'active', isDemo: true }
  ], isDemo: true }
];

export const demoConversions: MsConversion[] = [
  { id: 'demo_c1', itemId: 'demo_i1', fromUnit: 'demo_u4', fromQty: 1, toUnit: 'demo_u5', toQty: 4, notes: '1 Gunia la Viazi = 4 Ndoo', isDemo: true },
  { id: 'demo_c2', itemId: 'demo_i6', fromUnit: 'demo_u5', fromQty: 1, toUnit: 'demo_u1', toQty: 18, notes: '1 Ndoo ya Mahindi = 18 Kg', isDemo: true },
  { id: 'demo_c3', itemId: 'demo_i9', fromUnit: 'demo_u10', fromQty: 1, toUnit: 'demo_u1', toQty: 60, notes: '1 Sack ya Alizeti = 60 Kg', isDemo: true },
  { id: 'demo_c4', itemId: 'demo_i2', fromUnit: 'demo_u2', fromQty: 1, toUnit: 'demo_u7', toQty: 1, notes: '1 Litre ya Mafuta = 1 Bottle', isDemo: true }
];

export const demoSales: MsSale[] = [];

// Seed sales dynamically over the last 10 days
for (let i = 1; i <= 10; i++) {
  const date = getIsoDateMinusDays(i);
  demoSales.push({
    id: `demo_s1_day${i}`,
    date,
    paymentMethodId: 'demo_pm1', // Cash
    total: 3000 * 5,
    items: [{ itemId: 'demo_i5', name: 'Chips Plate', price: 3000, qty: 5, _batchesUsed: [{ batchId: 'demo_b3', costPerUnit: 1200, qty: 5 }] }],
    isDemo: true
  });
  demoSales.push({
    id: `demo_s2_day${i}`,
    date,
    paymentMethodId: 'demo_pm2', // M-pesa
    total: 2500 * 2 + 8000 * 1,
    items: [
      { itemId: 'demo_i8', name: 'Unga wa Sembe', price: 2500, qty: 2, _batchesUsed: [{ batchId: 'demo_b5', costPerUnit: 1800, qty: 2 }] },
      { itemId: 'demo_i11', name: 'Mafuta ya Alizeti 1L', price: 8000, qty: 1, _batchesUsed: [{ batchId: 'demo_b6', costPerUnit: 5500, qty: 1 }] }
    ],
    isDemo: true
  });
  if (i % 2 === 0) {
    demoSales.push({
      id: `demo_s3_day${i}`,
      date,
      paymentMethodId: 'demo_pm1',
      total: 2000 * 4 + 500 * 10,
      items: [
        { itemId: 'demo_i12', name: 'Juice Bottle', price: 2000, qty: 4, _batchesUsed: [{ batchId: 'demo_b7', costPerUnit: 800, qty: 4 }] },
        { itemId: 'demo_i13', name: 'Maandazi', price: 500, qty: 10, _batchesUsed: [{ batchId: 'demo_b8', costPerUnit: 150, qty: 10 }] }
      ],
      isDemo: true
    });
  }
}

export const demoExpenses: MsExpense[] = [
  { id: 'demo_e1', name: 'Rent for Month', category: 'Rent', amount: 50000, paymentMethodId: 'demo_pm1', date: getIsoDateMinusDays(10), notes: '', isDemo: true },
  { id: 'demo_e2', name: 'Weekly Salary', category: 'Salary', amount: 30000, paymentMethodId: 'demo_pm2', date: getIsoDateMinusDays(3), notes: '', isDemo: true },
  { id: 'demo_e3', name: 'LUKU', category: 'Electricity', amount: 15000, paymentMethodId: 'demo_pm2', date: getIsoDateMinusDays(5), notes: '', isDemo: true },
  { id: 'demo_e4', name: 'Cleaning Supplies', category: 'Cleaning', amount: 5000, paymentMethodId: 'demo_pm1', date: getIsoDateMinusDays(2), notes: '', isDemo: true },
  { id: 'demo_e5', name: 'Data Bundle', category: 'Internet', amount: 10000, paymentMethodId: 'demo_pm1', date: getIsoDateMinusDays(1), notes: '', isDemo: true }
];

export const demoDeliveries: MsDelivery[] = [
  { id: 'demo_d1', type: 'Boda-boda delivery to market', cost: 5000, paidBy: 'business', riderName: 'Juma', destination: 'Soko la Kariakoo', date: getIsoDateMinusDays(6), notes: '', isDemo: true },
  { id: 'demo_d2', type: 'Customer delivery', cost: 3000, paidBy: 'customer', riderName: 'Ali', destination: 'Kinondoni', date: getIsoDateMinusDays(2), notes: '', isDemo: true },
  { id: 'demo_d3', type: 'Product transfer to selling point', cost: 10000, paidBy: 'business', riderName: 'Musa', destination: 'Magomeni Branch', date: getIsoDateMinusDays(1), notes: '', isDemo: true }
];

export const loadDemoData = (ctx: any) => {
  ctx.setBusinessSettings(demoBusinessSettings);
  ctx.setBrandingSettings(demoBrandingSettings);
  ctx.setUnits([...ctx.units.filter((u: any) => !u.isDemo), ...demoUnits]);
  ctx.setPaymentMethods([...ctx.paymentMethods.filter((pm: any) => !pm.isDemo), ...demoPaymentMethods]);
  ctx.setExpenseCategories([...ctx.expenseCategories.filter((ec: any) => !ec.isDemo), ...demoExpenseCategories]);
  ctx.setItems([...ctx.items.filter((i: any) => !i.isDemo), ...demoItems]);
  ctx.setConversions([...ctx.conversions.filter((c: any) => !c.isDemo), ...demoConversions]);
  ctx.setSales([...ctx.sales.filter((s: any) => !s.isDemo), ...demoSales]);
  ctx.setExpenses([...ctx.expenses.filter((e: any) => !e.isDemo), ...demoExpenses]);
  ctx.setDeliveries([...ctx.deliveries.filter((d: any) => !d.isDemo), ...demoDeliveries]);
};

export const clearDemoData = (ctx: any) => {
  ctx.setUnits(ctx.units.filter((u: any) => !u.isDemo));
  ctx.setPaymentMethods(ctx.paymentMethods.filter((pm: any) => !pm.isDemo));
  ctx.setExpenseCategories(ctx.expenseCategories.filter((ec: any) => !ec.isDemo));
  ctx.setItems(ctx.items.filter((i: any) => !i.isDemo));
  ctx.setConversions(ctx.conversions.filter((c: any) => !c.isDemo));
  ctx.setSales(ctx.sales.filter((s: any) => !s.isDemo));
  ctx.setExpenses(ctx.expenses.filter((e: any) => !e.isDemo));
  ctx.setDeliveries(ctx.deliveries.filter((d: any) => !d.isDemo));
};

export const hasDemoData = (ctx: any) => {
  return ctx.items.some((i: any) => i.isDemo) || ctx.sales.some((s: any) => s.isDemo);
};
