import { Tenant, Product, SyncLog, Supplier, Sale } from './types';

export const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 't-lagos-01',
    name: 'Jasper Wholesale Dar es Salaam',
    country: 'Tanzania',
    city: 'Dar es Salaam',
    currency: 'TSh',
    currencyCode: 'TZS',
    taxRate: 0.18,
    mobileMoneyProviders: ['M-Pesa', 'Mixx by Yas', 'Airtel Money', 'Halopesa'],
    businessType: 'retail',
  },
  {
    id: 't-nairobi-02',
    name: 'Jasper General Store Nairobi',
    country: 'Kenya',
    city: 'Nairobi',
    currency: 'KSh',
    currencyCode: 'KES',
    taxRate: 0.16,
    mobileMoneyProviders: ['M-Pesa', 'Airtel Money'],
    businessType: 'retail',
  },
  {
    id: 't-accra-03',
    name: 'Jasper Tech Mall Accra',
    country: 'Ghana',
    city: 'Accra',
    currency: 'GH₵',
    currencyCode: 'GHS',
    taxRate: 0.15,
    mobileMoneyProviders: ['MTN MoMo', 'Vodafone Cash'],
    businessType: 'retail',
  },
  {
    id: 't-hotel-01',
    name: 'Jasper Grand Peaks Hotel & Spa',
    country: 'Kenya',
    city: 'Nairobi',
    currency: 'KSh',
    currencyCode: 'KES',
    taxRate: 0.16,
    mobileMoneyProviders: ['M-Pesa', 'Airtel Money'],
    businessType: 'hotel',
  },
  {
    id: 't-restaurant-01',
    name: 'Jasper Swahili Bistro & Grill',
    country: 'Tanzania',
    city: 'Dar es Salaam',
    currency: 'TSh',
    currencyCode: 'TZS',
    taxRate: 0.18,
    mobileMoneyProviders: ['M-Pesa', 'Mixx by Yas', 'Airtel Money'],
    businessType: 'restaurant',
  },
  {
    id: 't-pharma-01',
    name: 'Jasper National Pharmacy',
    country: 'Tanzania',
    city: 'Dar es Salaam',
    currency: 'TSh',
    currencyCode: 'TZS',
    taxRate: 0.18,
    mobileMoneyProviders: ['M-Pesa', 'Mixx by Yas', 'Airtel Money', 'Halopesa'],
    businessType: 'pharmacy',
  }
];

export const DEMO_USERS = [
  {
    email: 'saas.admin@jasper.com',
    password: 'password123',
    name: 'Jasper SaaS Controller',
    role: 'SuperAdmin' as const,
    tenantId: 't-lagos-01',
    activeTenant: 't-lagos-01',
    phone: '+255 700 000 001',
  },
  {
    email: 'admin@jasper.com',
    password: 'password123',
    name: 'Tunde Jasper',
    role: 'Admin' as const,
    tenantId: 't-lagos-01',
    activeTenant: 't-lagos-01',
    phone: '+255 700 000 002',
  },
  {
    email: 'nairobi_cashier@jasper.com',
    password: 'password123',
    name: 'Wanjiku Kamau',
    role: 'Cashier' as const,
    tenantId: 't-nairobi-02',
    activeTenant: 't-nairobi-02',
    phone: '+254 711 222 333',
  },
  {
    email: 'accra_mgr@jasper.com',
    password: 'password123',
    name: 'Kwame Mensah',
    role: 'Manager' as const,
    tenantId: 't-accra-03',
    activeTenant: 't-accra-03',
    phone: '+233 244 111 222',
  },
  {
    email: 'hotel_mgr@jasper.com',
    password: 'password123',
    name: 'Serah Wambui',
    role: 'Manager' as const,
    tenantId: 't-hotel-01',
    activeTenant: 't-hotel-01',
    phone: '+254 722 000 111',
  },
  {
    email: 'restaurant_mgr@jasper.com',
    password: 'password123',
    name: 'Chef Juma Omari',
    role: 'Manager' as const,
    tenantId: 't-restaurant-01',
    activeTenant: 't-restaurant-01',
    phone: '+255 713 555 777',
  },
  {
    email: 'pharmacy_mgr@jasper.com',
    password: 'password123',
    name: 'Dr. Amina Bello (RPh)',
    role: 'Manager' as const,
    tenantId: 't-pharma-01',
    activeTenant: 't-pharma-01',
    phone: '+255 744 555 888',
  }
];

export const DEFAULT_PRODUCTS: Record<string, Product[]> = {
  't-hotel-01': [],
  't-pharma-01': [
    {
      id: 'p-ph-01',
      name: 'Amoxicillin 500mg',
      sku: '6181110292015',
      barcode: '6181110292015',
      category: 'Antibiotics',
      costPrice: 12000,
      sellingPrice: 18500,
      stockQty: 120,
      shopStockQty: 40,
      storeStockQty: 80,
      alertQty: 20,
      tabsPerPack: 30,
      allowsDosageDividing: true,
    },
    {
      id: 'p-ph-02',
      name: 'Paracetamol 500mg (Panadol)',
      sku: '6181110292022',
      barcode: '6181110292022',
      category: 'Analgesics',
      costPrice: 1500,
      sellingPrice: 2000,
      stockQty: 1850,
      shopStockQty: 850,
      storeStockQty: 1000,
      alertQty: 100,
      tabsPerPack: 100,
      allowsDosageDividing: true,
    },
    {
      id: 'p-ph-03',
      name: 'Metformin 850mg',
      sku: '6181110292039',
      barcode: '6181110292039',
      category: 'Anti-Diabetic',
      costPrice: 8500,
      sellingPrice: 12000,
      stockQty: 45,
      shopStockQty: 15,
      storeStockQty: 30,
      alertQty: 15,
      tabsPerPack: 60,
      allowsDosageDividing: true,
    }
  ],
  't-lagos-01': [
    {
      id: 'p-lag-01',
      name: 'Dangote Refined Sugar (50kg)',
      sku: '6151110023412',
      barcode: '6151110023412',
      category: 'Groceries',
      costPrice: 42000,
      sellingPrice: 48500,
      stockQty: 84,
      shopStockQty: 24,
      storeStockQty: 60,
      alertQty: 10,
    },
    {
      id: 'p-lag-02',
      name: 'Honeywell Wheat Flour (2kg)',
      sku: '6151110023429',
      barcode: '6151110023429',
      category: 'Groceries',
      costPrice: 2800,
      sellingPrice: 3400,
      stockQty: 120,
      shopStockQty: 40,
      storeStockQty: 80,
      alertQty: 25,
    },
    {
      id: 'p-lag-03',
      name: 'Indomie Instant Noodles Onion (Pack of 40)',
      sku: '6151110119856',
      barcode: '6151110119856',
      category: 'Groceries',
      costPrice: 7500,
      sellingPrice: 8900,
      stockQty: 8,
      shopStockQty: 2,
      storeStockQty: 6,
      alertQty: 15,
    },
    {
      id: 'p-lag-04',
      name: 'Power Oil Vegetable Cooking Oil (5L)',
      sku: '6151110291024',
      barcode: '6151110291024',
      category: 'Cooking Oils',
      costPrice: 12500,
      sellingPrice: 14200,
      stockQty: 45,
      shopStockQty: 15,
      storeStockQty: 30,
      alertQty: 8,
    },
    {
      id: 'p-lag-05',
      name: 'Peak Milk Powder Liquid Refill (350g)',
      sku: '6151110291999',
      barcode: '6151110291999',
      category: 'Dairy',
      costPrice: 2100,
      sellingPrice: 2500,
      stockQty: 95,
      shopStockQty: 35,
      storeStockQty: 60,
      alertQty: 20,
    },
    {
      id: 'p-lag-06',
      name: 'Golden Penny Pasta Spaghetti (20/Carton)',
      sku: '6151110291583',
      barcode: '6151110291583',
      category: 'Groceries',
      costPrice: 11000,
      sellingPrice: 12800,
      stockQty: 30,
      shopStockQty: 10,
      storeStockQty: 20,
      alertQty: 10,
    }
  ],
  't-nairobi-02': [
    {
      id: 'p-nai-01',
      name: 'Pembe Maize Meal (12 x 2kg Bale)',
      sku: '6161110112234',
      barcode: '6161110112234',
      category: 'Grains',
      costPrice: 1850,
      sellingPrice: 2200,
      stockQty: 15,
      shopStockQty: 5,
      storeStockQty: 10,
      alertQty: 5,
    },
    {
      id: 'p-nai-02',
      name: 'Ketepa Pride Premium Tea Leaves (500g)',
      sku: '6161110112241',
      barcode: '6161110112241',
      category: 'Beverages',
      costPrice: 380,
      sellingPrice: 450,
      stockQty: 60,
      shopStockQty: 20,
      storeStockQty: 40,
      alertQty: 12,
    },
    {
      id: 'p-nai-03',
      name: 'Jogoo Fortified Maize Meal (2kg)',
      sku: '6161110112258',
      barcode: '6161110112258',
      category: 'Grains',
      costPrice: 160,
      sellingPrice: 195,
      stockQty: 3,
      shopStockQty: 1,
      storeStockQty: 2,
      alertQty: 10,
    },
    {
      id: 'p-nai-04',
      name: 'Super Moja Drinking Water (20L Dispenser)',
      sku: '6161110112265',
      barcode: '6161110112265',
      category: 'Beverages',
      costPrice: 300,
      sellingPrice: 380,
      stockQty: 42,
      shopStockQty: 12,
      storeStockQty: 30,
      alertQty: 8,
    },
    {
      id: 'p-nai-05',
      name: 'Menengai Bar Soap White (800g x 10)',
      sku: '6161110112888',
      barcode: '6161110112888',
      category: 'Household',
      costPrice: 1100,
      sellingPrice: 1350,
      stockQty: 24,
      shopStockQty: 8,
      storeStockQty: 16,
      alertQty: 5,
    }
  ],
  't-accra-03': [
    {
      id: 'p-acc-01',
      name: 'Gino Rice Perfumed Long Grain (5kg)',
      sku: '6171110221101',
      barcode: '6171110221101',
      category: 'Groceries',
      costPrice: 120,
      sellingPrice: 145,
      stockQty: 40,
      shopStockQty: 15,
      storeStockQty: 25,
      alertQty: 8,
    },
    {
      id: 'p-acc-02',
      name: 'Enapa Sardines in Tomato Sauce (Box of 50)',
      sku: '6171110221118',
      barcode: '6171110221118',
      category: 'Canned Food',
      costPrice: 310,
      sellingPrice: 365,
      stockQty: 12,
      shopStockQty: 4,
      storeStockQty: 8,
      alertQty: 4,
    },
    {
      id: 'p-acc-03',
      name: 'Milo Choco Malt Activ-Go Tub (800g)',
      sku: '6171110221125',
      barcode: '6171110221125',
      category: 'Dairy',
      costPrice: 65,
      sellingPrice: 78,
      stockQty: 2,
      shopStockQty: 0,
      storeStockQty: 2,
      alertQty: 10,
    },
    {
      id: 'p-acc-04',
      name: 'Voltic Premium Natural Water (12 x 1.5L)',
      sku: '6171110221132',
      barcode: '6171110221132',
      category: 'Beverages',
      costPrice: 42,
      sellingPrice: 50,
      stockQty: 80,
      shopStockQty: 30,
      storeStockQty: 50,
      alertQty: 15,
    }
  ]
};

export const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 's-01',
    name: 'Dangote Foods Distribution Ltd',
    contactPerson: 'Alhaji Ibrahim Danladi',
    phone: '+234 803 111 2222',
    email: 'ibrahim.d@dangotefoods.com',
    categories: ['Groceries', 'Sugar', 'Flour'],
  },
  {
    id: 's-02',
    name: 'Bidco Africa Logistics Kenya',
    contactPerson: 'Wycliffe Ochieng',
    phone: '+254 722 333 444',
    email: 'wycliffe.ochieng@bidcoafrica.com',
    categories: ['Cooking Oils', 'Household', 'Soaps'],
  },
  {
    id: 's-03',
    name: 'GB Foods Ghana Limited',
    contactPerson: 'Ama Serwah',
    phone: '+233 244 555 666',
    email: 'ama.serwah@gbfoods.com',
    categories: ['Groceries', 'Canned Food', 'Tomato Paste'],
  }
];

export const RECENT_SYNC_LOGS: SyncLog[] = [
  {
    id: 'l-01',
    type: 'auth_sync',
    status: 'success',
    message: 'Active registers verified on central ledger Cloud Server',
    timestamp: '2026-05-20T12:05:00Z',
  },
  {
    id: 'l-02',
    type: 'product_update',
    status: 'success',
    message: 'Synced 14 catalog item updates from Lagos Warehouse',
    timestamp: '2026-05-20T12:10:00Z',
  },
  {
    id: 'l-03',
    type: 'sale',
    status: 'success',
    message: 'Sale ref: JSP-312-NGN-001 pushed with Cashier Sign-off online',
    timestamp: '2026-05-20T12:15:00Z',
  },
  {
    id: 'l-04',
    type: 'inventory_audit',
    status: 'warning',
    message: 'Offline queue detected 3 items with timestamp anomalies (Auto-resolved)',
    timestamp: '2026-05-20T12:20:00Z',
  }
];

export const MOCK_SALES_HISTORY: Record<string, Sale[]> = {
  't-lagos-01': [
    {
      id: 'sl-lag-01',
      items: [
        { productId: 'p-lag-01', productName: 'Dangote Refined Sugar (50kg)', qty: 2, price: 48500, discount: 0 },
        { productId: 'p-lag-04', productName: 'Power Oil Vegetable Cooking Oil (5L)', qty: 1, price: 14200, discount: 5 }
      ],
      total: 110490,
      tax: 8287,
      paymentMethod: 'Paystack',
      reference: 'TX-PSTK-902239102',
      tenantId: 't-lagos-01',
      timestamp: '2026-05-20T09:30:00Z',
      syncStatus: 'synced',
      cashierName: 'Tunde Jasper',
      customerName: 'Kunle Adebayo',
      customerPhone: '+234 803 444 5555',
      staffName: 'Tunde Jasper'
    },
    {
      id: 'sl-lag-02',
      items: [
        { productId: 'p-lag-02', productName: 'Honeywell Wheat Flour (2kg)', qty: 5, price: 3400, discount: 0 },
        { productId: 'p-lag-05', productName: 'Peak Milk Powder Liquid Refill (350g)', qty: 10, price: 2500, discount: 2 }
      ],
      total: 41500,
      tax: 3113,
      paymentMethod: 'Cash',
      reference: 'TX-CASH-442381',
      tenantId: 't-lagos-01',
      timestamp: '2026-05-20T11:45:00Z',
      syncStatus: 'synced',
      cashierName: 'Tunde Jasper',
      customerName: 'Grace Eze',
      customerPhone: '+234 812 777 8888',
      staffName: 'Tunde Jasper'
    },
    {
      id: 'sl-lag-03',
      items: [
        { productId: 'p-lag-01', productName: 'Dangote Refined Sugar (50kg)', qty: 1, price: 48500, discount: 10 },
        { productId: 'p-lag-06', productName: 'Golden Penny Pasta Spaghetti (250g)', qty: 12, price: 12800, discount: 0 }
      ],
      total: 197250,
      tax: 14793,
      paymentMethod: 'Credit',
      reference: 'TX-CRD-901122',
      tenantId: 't-lagos-01',
      timestamp: '2026-05-19T14:20:00Z',
      syncStatus: 'synced',
      cashierName: 'Tunde Jasper',
      customerName: 'Alhaji Musa Ibrahim',
      customerPhone: '+234 806 111 2222',
      staffName: 'Tunde Jasper'
    },
    {
      id: 'sl-lag-04',
      items: [
        { productId: 'p-lag-05', productName: 'Peak Milk Powder Liquid Refill (350g)', qty: 4, price: 2500, discount: 0 }
      ],
      total: 10000,
      tax: 750,
      paymentMethod: 'MTN MoMo',
      reference: 'TX-MOMO-882211',
      tenantId: 't-lagos-01',
      timestamp: '2026-04-10T10:15:00Z',
      syncStatus: 'synced',
      cashierName: 'Tunde Jasper',
      customerName: 'Kunle Adebayo',
      customerPhone: '+234 803 444 5555',
      staffName: 'Tunde Jasper'
    },
    {
      id: 'sl-lag-05',
      items: [
        { productId: 'p-lag-01', productName: 'Dangote Refined Sugar (50kg)', qty: 3, price: 48500, discount: 0 }
      ],
      total: 145500,
      tax: 10912,
      paymentMethod: 'Cash',
      reference: 'TX-CASH-129990',
      tenantId: 't-lagos-01',
      timestamp: '2025-12-15T16:40:00Z',
      syncStatus: 'synced',
      cashierName: 'Tunde Jasper',
      customerName: 'Grace Eze',
      customerPhone: '+234 812 777 8888',
      staffName: 'Tunde Jasper'
    }
  ],
  't-nairobi-02': [
    {
      id: 'sl-nai-01',
      items: [
        { productId: 'p-nai-01', productName: 'Pembe Maize Meal (12 x 2kg Bale)', qty: 3, price: 2200, discount: 0 },
        { productId: 'p-nai-02', productName: 'Ketepa Pride Premium Tea Leaves (500g)', qty: 2, price: 450, discount: 10 }
      ],
      total: 7410,
      tax: 1186,
      paymentMethod: 'M-Pesa',
      reference: 'MPESA-QET9J1MLPC',
      tenantId: 't-nairobi-02',
      timestamp: '2026-05-20T10:15:00Z',
      syncStatus: 'synced',
      cashierName: 'Wanjiku Kamau',
      customerName: 'Josphat Njoroge',
      customerPhone: '+254 711 222 333',
      staffName: 'Wanjiku Kamau'
    },
    {
      id: 'sl-nai-02',
      items: [
        { productId: 'p-nai-04', productName: 'Menengai Cream Bar Soap (Box of 25)', qty: 1, price: 380, discount: 0 },
        { productId: 'p-nai-05', productName: 'Soko Cooking Fat (10kg Tub)', qty: 2, price: 1350, discount: 5 }
      ],
      total: 2945,
      tax: 471,
      paymentMethod: 'Credit',
      reference: 'TX-CRD-882190',
      tenantId: 't-nairobi-02',
      timestamp: '2026-05-18T16:30:00Z',
      syncStatus: 'synced',
      cashierName: 'Wanjiku Kamau',
      customerName: 'Mary Atieno',
      customerPhone: '+254 722 000 111',
      staffName: 'Wanjiku Kamau'
    },
    {
      id: 'sl-nai-03',
      items: [
        { productId: 'p-nai-01', productName: 'Pembe Maize Meal (12 x 2kg Bale)', qty: 10, price: 2200, discount: 8 }
      ],
      total: 20240,
      tax: 3238,
      paymentMethod: 'M-Pesa',
      reference: 'MPESA-MPW8D88291',
      tenantId: 't-nairobi-02',
      timestamp: '2026-04-25T11:00:00Z',
      syncStatus: 'synced',
      cashierName: 'Wanjiku Kamau',
      customerName: 'Josphat Njoroge',
      customerPhone: '+254 711 222 333',
      staffName: 'Wanjiku Kamau'
    },
    {
      id: 'sl-nai-04',
      items: [
        { productId: 'p-nai-02', productName: 'Ketepa Pride Premium Tea Leaves (500g)', qty: 5, price: 450, discount: 0 }
      ],
      total: 2250,
      tax: 360,
      paymentMethod: 'Cash',
      reference: 'TX-CASH-998129',
      tenantId: 't-nairobi-02',
      timestamp: '2025-11-05T14:15:00Z',
      syncStatus: 'synced',
      cashierName: 'Wanjiku Kamau',
      customerName: 'Mary Atieno',
      customerPhone: '+254 722 000 111',
      staffName: 'Wanjiku Kamau'
    }
  ],
  't-accra-03': [
    {
      id: 'sl-acc-01',
      items: [
        { productId: 'p-acc-01', productName: 'Gino Rice Perfumed Long Grain (5kg)', qty: 4, price: 145, discount: 5 },
        { productId: 'p-acc-04', productName: 'Voltic Premium Natural Water (12 x 1.5L)', qty: 2, price: 50, discount: 0 }
      ],
      total: 651,
      tax: 97.65,
      paymentMethod: 'MTN MoMo',
      reference: 'MOMO-GH-908239',
      tenantId: 't-accra-03',
      timestamp: '2026-05-20T11:22:00Z',
      syncStatus: 'synced',
      cashierName: 'Kwame Mensah',
      customerName: 'Emmanuel Osei',
      customerPhone: '+233 244 111 222',
      staffName: 'Kwame Mensah'
    },
    {
      id: 'sl-acc-02',
      items: [
        { productId: 'p-acc-02', productName: 'Enapa Sardines in Tomato Sauce (Box of 50)', qty: 2, price: 365, discount: 0 }
      ],
      total: 730,
      tax: 109.5,
      paymentMethod: 'Credit',
      reference: 'TX-CRD-771120',
      tenantId: 't-accra-03',
      timestamp: '2026-05-19T10:00:00Z',
      syncStatus: 'synced',
      cashierName: 'Kwame Mensah',
      customerName: 'Kofi Boateng',
      customerPhone: '+233 200 999 000',
      staffName: 'Kwame Mensah'
    },
    {
      id: 'sl-acc-03',
      items: [
        { productId: 'p-acc-04', productName: 'Voltic Premium Natural Water (12 x 1.5L)', qty: 15, price: 50, discount: 10 }
      ],
      total: 675,
      tax: 101.25,
      paymentMethod: 'MTN MoMo',
      reference: 'MOMO-GH-441129',
      tenantId: 't-accra-03',
      timestamp: '2026-03-12T15:30:00Z',
      syncStatus: 'synced',
      cashierName: 'Kwame Mensah',
      customerName: 'Emmanuel Osei',
      customerPhone: '+233 244 111 222',
      staffName: 'Kwame Mensah'
    }
  ]
};

export const MOCK_EXPENSES_HISTORY: Record<string, any[]> = {
  't-lagos-01': [
    {
      id: 'exp-lag-01',
      category: 'Wages & Salary',
      amount: 120000,
      timestamp: '2026-05-18T10:00:00Z',
      description: 'Part-time shelf restocker contractor payment',
      staffName: 'Tunde Jasper',
      receiptRef: 'RCPT-N-88219',
      tenantId: 't-lagos-01'
    },
    {
      id: 'exp-lag-02',
      category: 'Utilities & Power',
      amount: 45000,
      timestamp: '2026-05-15T15:30:00Z',
      description: 'Diesel purchase for standby backroom power generator',
      staffName: 'Tunde Jasper',
      receiptRef: 'RCPT-N-88220',
      tenantId: 't-lagos-01'
    },
    {
      id: 'exp-lag-03',
      category: 'Packaging Materials',
      amount: 18000,
      timestamp: '2026-05-10T11:45:00Z',
      description: 'Bulk branded carrier shopping bag order',
      staffName: 'Tunde Jasper',
      receiptRef: 'RCPT-N-88221',
      tenantId: 't-lagos-01'
    },
    {
      id: 'exp-lag-04',
      category: 'Rent & Logistics',
      amount: 250000,
      timestamp: '2026-04-15T09:00:00Z',
      description: 'Monthly warehouse overflow rental allocation',
      staffName: 'Tunde Jasper',
      receiptRef: 'RCPT-N-88102',
      tenantId: 't-lagos-01'
    }
  ],
  't-nairobi-02': [
    {
      id: 'exp-nai-01',
      category: 'Wages & Salary',
      amount: 15000,
      timestamp: '2026-05-19T11:00:00Z',
      description: 'Staff transport subsidy and lunch stipend',
      staffName: 'Wanjiku Kamau',
      receiptRef: 'RCPT-K-9901',
      tenantId: 't-nairobi-02'
    },
    {
      id: 'exp-nai-02',
      category: 'Logistics',
      amount: 8500,
      timestamp: '2026-05-14T09:15:00Z',
      description: 'Boda boda delivery of emergency stock box from depot',
      staffName: 'Wanjiku Kamau',
      receiptRef: 'RCPT-K-9902',
      tenantId: 't-nairobi-02'
    }
  ],
  't-accra-03': [
    {
      id: 'exp-acc-01',
      category: 'Utilities & Power',
      amount: 350,
      timestamp: '2026-05-19T14:00:00Z',
      description: 'Prepaid smart meter electricity recharge token',
      staffName: 'Kwame Mensah',
      receiptRef: 'RCPT-G-1102',
      tenantId: 't-accra-03'
    },
    {
      id: 'exp-acc-02',
      category: 'Miscellaneous',
      amount: 120,
      timestamp: '2026-05-12T16:20:00Z',
      description: 'Office supply notebooks and permanent visual markers',
      staffName: 'Kwame Mensah',
      receiptRef: 'RCPT-G-1103',
      tenantId: 't-accra-03'
    }
  ]
};
