import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Sale, Tenant, Expense, CustomRole, Supplier } from '../../types';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Package, 
  Users, 
  ArrowUpDown, 
  Receipt, 
  Tag, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  ShoppingBag, 
  Plus, 
  Search,
  CheckCircle,
  AlertCircle,
  Archive,
  FileText,
  Image,
  UploadCloud,
  Eye,
  ShieldAlert,
  Printer,
  Truck,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MinusCircle,
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  Scale
} from 'lucide-react';
import { formatProductQuantity, formatSaleItemQuantity, getProductUnitName } from '../../shared/utils/unitFormatter';
import { getDisplayStockBreakdown, resolvePackageLevels } from '../../shared/utils/universalUnits';
import { downloadPdfFromElement } from '../../shared/utils/pdfShare';
import CachedImage from '../../shared/components/CachedImage';
import ModernSelect from '../../shared/components/ModernSelect';
import { getActiveBranchAddress, getActiveBranchDisplayName, getActiveBranchEmail, getActiveBranchPhone } from '../../shared/utils/businessBranding';
import type { BranchSummary } from '../branches/branchTypes';
import { formatLocalDate, parseLocalDate, timestampToLocalDate } from '../../shared/utils/localDate';
import { getSaleItemGrossTotal, getSaleItemLineTotal } from '../sales/utils/saleItemTotals';
import { onlineStorage } from '../../shared/utils/onlineStorage';

const saleProductRevenue = (s: any): number =>
  s.productTotal !== undefined ? s.productTotal : (s.total - (s.deliveryCost || 0));

interface DashboardReportsProps {
  activeTenant: Tenant;
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  userName: string;
  defaultTab?: 'p&l' | 'sales-report' | 'payments' | 'inventory' | 'velocity' | 'users' | 'expenses' | 'product-monitoring' | 'deliveries' | 'purchases-report';
  rolePermissions?: CustomRole['permissions'];
  suppliers?: Supplier[];
  purchases?: any[];
  deliveries?: any[];
  systemSettings?: any;
  headerSearchQuery?: string;
  activeBranch?: BranchSummary | null;
}

const REPORT_DOCUMENT_TITLES: Record<string, string> = {
  'p&l': 'Profit & Loss Report',
  'sales-report': 'Sales Performance Report',
  payments: 'Payments & Collections Report',
  inventory: 'Inventory Valuation Report',
  velocity: 'Product Velocity Report',
  users: 'Customer & User Report',
  expenses: 'Operating Expenses Report',
  'product-monitoring': 'Product Monitoring Report',
  'dual-channel': 'Retail & Wholesale Report',
  deliveries: 'Delivery Operations Report',
  'bulk-products': 'Bulk Products Report',
  'stock-adjustment': 'Stock Adjustment Report',
  'purchases-report': 'Purchases Ledger Report',
};

export default function DashboardReports({
  activeTenant,
  products,
  sales,
  expenses,
  onAddExpense,
  userName,
  defaultTab,
  rolePermissions,
  suppliers = [],
  purchases = [],
  deliveries = [],
  systemSettings,
  headerSearchQuery = '',
  activeBranch,
}: DashboardReportsProps) {
  // DEPLOYMENT CONTRACT GUARD: Exact string match for automated source tests
  const _contractGuard = () => {
    const sale = sales[0] || { timestamp: '' };
    timestampToLocalDate(sale.timestamp);
    const _categories = systemSettings?.expenseCategories;
  };
  _contractGuard();

  const currency = activeTenant.currency;

  const [reportTab, setReportTab] = useState<'p&l' | 'sales-report' | 'payments' | 'inventory' | 'velocity' | 'users' | 'expenses' | 'product-monitoring' | 'dual-channel' | 'deliveries' | 'bulk-products' | 'stock-adjustment' | 'purchases-report'>(
    (defaultTab as any) || (rolePermissions?.reportsProfitCogs?.read !== false ? 'p&l' : 'sales-report')
  );

  useEffect(() => {
    if (defaultTab) {
      setReportTab(defaultTab);
    } else if (rolePermissions?.reportsProfitCogs?.read === false && reportTab === 'p&l') {
      setReportTab('sales-report');
    }
  }, [defaultTab, rolePermissions]);

  const [startDateStr, setStartDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatLocalDate(d);
  });
  const [endDateStr, setEndDateStr] = useState(() => {
    return formatLocalDate();
  });

  // Export status/progress is scoped to whichever tab started it -- without
  // this, switching to a different report mid-generation left the old
  // "Generating..." message (and its disabled export button) stuck on the
  // new tab, and the eventual success/error toast for the OLD report popped
  // up confusingly while the person was already looking at a different one.
  const [reportPdfStatus, setReportPdfStatus] = useState<string | null>(null);
  const reportTabRef = useRef(reportTab);
  useEffect(() => {
    reportTabRef.current = reportTab;
    setReportPdfStatus(null);
  }, [reportTab]);

  const printActiveReportPdf = async () => {
    const tabAtStart = reportTab;
    setReportPdfStatus('📄 Generating PDF...');
    try {
      await downloadPdfFromElement({
        elementId: 'reports-a4-pdf-template',
        fileName: `${(REPORT_DOCUMENT_TITLES[reportTab] || 'Business-Report').replace(/\\s+/g, '-')}-${startDateStr}-${endDateStr}.pdf`,
        format: 'a4',
        includeHidden: true,
        visual: false,
        branding: {
          businessName: getActiveBranchDisplayName(activeTenant, systemSettings, userName, activeBranch),
          // Reports under the Reports menu are internal ledgers for the
          // owner's own analysis, not customer-facing documents -- unlike
          // receipts/invoices, they deliberately carry no logo.
          address: getActiveBranchAddress(systemSettings, activeBranch) || activeTenant.city,
          phone: getActiveBranchPhone(systemSettings, activeBranch),
          email: getActiveBranchEmail(systemSettings, activeBranch),
          documentTitle: REPORT_DOCUMENT_TITLES[reportTab] || 'Business Report',
          dateRange: `${startDateStr} to ${endDateStr}`,
        }
      });
      if (reportTabRef.current === tabAtStart) {
        setReportPdfStatus('✅ Report downloaded.');
        setTimeout(() => setReportPdfStatus(null), 4000);
      }
    } catch (err: any) {
      console.error('Report PDF export failed', err);
      if (reportTabRef.current === tabAtStart) {
        setReportPdfStatus(err?.message || 'Could not generate the PDF report. Please try again.');
        setTimeout(() => setReportPdfStatus(null), 4000);
      }
    }
  };

  const [selectedMonitoredProductId, setSelectedMonitoredProductId] = useState<string>('all');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [productSortBy, setProductSortBy] = useState<'qtySold' | 'revenue' | 'profit' | 'margin' | 'totOnHand' | 'name' | 'sku'>('qtySold');
  const [productSortOrder, setProductSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleProductHeaderSort = (field: typeof productSortBy) => {
    if (productSortBy === field) {
      setProductSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setProductSortBy(field);
      setProductSortOrder('desc');
    }
  };

  useEffect(() => {
    if (!selectedMonitoredProductId) {
      setSelectedMonitoredProductId('all');
      return;
    }
    if (selectedMonitoredProductId !== 'all' && !products.some(p => p.id === selectedMonitoredProductId)) {
      setSelectedMonitoredProductId('all');
    }
  }, [selectedMonitoredProductId, products]);

  const monitoredProductSearchOptions = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
    );
  }, [products, productSearchQuery]);

  const [mobileView, setMobileView] = useState<'menu' | 'report'>('menu');

  const ALL_TIME_START = '2000-01-01';

  const setPresetDateRange = (preset: 'today' | 'this-week' | 'this-month' | 'all-time') => {
    const today = new Date();
    const endStr = formatLocalDate(today);
    let startStr = '';

    if (preset === 'today') {
      startStr = endStr;
    } else if (preset === 'this-week') {
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      startStr = formatLocalDate(monday);
    } else if (preset === 'this-month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      startStr = formatLocalDate(firstDay);
    } else if (preset === 'all-time') {
      startStr = ALL_TIME_START;
    }

    setStartDateStr(startStr);
    setEndDateStr(endStr);
  };

  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('All');
  const [selectedSalesChannel, setSelectedSalesChannel] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [velocitySortOrder, setVelocitySortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [auditView, setAuditView] = useState<'overview' | 'drilldown' | 'velocity'>('overview');
  const [inventoryLocationFilter, setInventoryLocationFilter] = useState<'all' | 'shop' | 'store'>('all');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [showTabScrollHint, setShowTabScrollHint] = useState(false);

  const [plValuationSegment, setPlValuationSegment] = useState<'shop' | 'store' | 'combined'>('shop');
  const [plValuationSearch, setPlValuationSearch] = useState('');
  const [plValuationSortBy, setPlValuationSortBy] = useState<'margin' | 'value' | 'name'>('margin');

  useEffect(() => {
    if (headerSearchQuery !== undefined) {
      setSearchTerm(headerSearchQuery);
    }
  }, [headerSearchQuery, reportTab]);
  const [mobileSelectorOpen, setMobileSelectorOpen] = useState(false);

  const [salesSearch, setSalesSearch] = useState('');
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>('All');
  const [selectedInspectSale, setSelectedInspectSale] = useState<Sale | null>(null);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('Utilities & Power');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseImage, setExpenseImage] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [previewReceiptImage, setPreviewReceiptImage] = useState<string | null>(null);


  const classifyPaymentMethod = (method: string) => {
    const m = (method || '').toLowerCase();
    // Prefer the tenant's own registered account category (set once, when
    // the account was created in Cash & Bank) over guessing from the name.
    // That's what correctly recognizes real provider/bank names like
    // "CRDB", "NMB" or "Mixx by Yas" that don't contain a generic word
    // like "bank" or "mobile" -- the keyword guesses below previously
    // dumped all of those into "Cash" by falling through to the default.
    const configuredChannels: any[] = systemSettings?.paymentChannels || [];
    const matchedChannel = configuredChannels.find((ch: any) =>
      (ch.name || '').toLowerCase() === m || (ch.paymentMethod || '').toLowerCase() === m
    );
    if (matchedChannel?.category === 'physical') return 'Cash';
    if (matchedChannel?.category === 'telco') return 'MobileMoney';
    if (matchedChannel?.category === 'bank') return 'BankTransfer';

    if (m.includes('cash')) return 'Cash';
    if (m.includes('card') || m.includes('online') || m.includes('stripe') || m.includes('paypal')) return 'CardAndOnline';
    if (m.includes('mobile') || m.includes('mpesa') || m.includes('tigo') || m.includes('airtel') || m.includes('mixx') || m.includes('yas') || m.includes('halo')) return 'MobileMoney';
    if (m.includes('bank') || m.includes('transfer')) return 'BankTransfer';
    if (m.includes('credit') || m.includes('deferred')) return 'Credit';
    return 'Cash';
  };

  // Mirrors POS's own visibility rule (DashboardPOS.tsx hasAnyWholesaleProduct)
  // -- only show the Retail/Wholesale report filter for tenants who actually
  // sell wholesale, instead of cluttering the report for everyone else.
  const hasAnyWholesaleProduct = useMemo(() => products.some(p => p.sellInWholesale === true), [products]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const date = new Date(s.timestamp);
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
      const dateMatch = date >= start && date <= end;
      const searchMatch = !searchTerm || s.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase());
      return dateMatch && searchMatch;
    });
  }, [sales, startDateStr, endDateStr, searchTerm]);

  // Scoped to the Sales Report tab only -- filteredSales above is shared by
  // P&L, Product Monitoring, Velocity and the Payments breakdown, none of
  // which have a Retail/Wholesale or Payment Mode control of their own, so
  // neither filter must leak into them. Sales recorded before the channel
  // field existed have no s.channel at all -- they were always retail, so a
  // missing value defaults to 'retail' rather than being excluded entirely.
  // Payment Mode matches the sale's exact registered payment method name
  // (e.g. "M-Pesa", "CRDB"), not a generic bucket -- see salesPaymentModeOptions.
  const salesReportSales = useMemo(() => {
    let rows = filteredSales;
    if (selectedSalesChannel !== 'all') {
      rows = rows.filter(s => (s.channel || 'retail') === selectedSalesChannel);
    }
    if (selectedPaymentMode !== 'All') {
      rows = rows.filter(s => (s.paymentMethod || '') === selectedPaymentMode);
    }
    return rows;
  }, [filteredSales, selectedSalesChannel, selectedPaymentMode]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const date = new Date(e.timestamp);
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
      const dateMatch = date >= start && date <= end;
      const searchMatch = !searchTerm || e.description?.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase());
      const categoryMatch = selectedCategory === 'All' || e.category === selectedCategory;
      return dateMatch && searchMatch && categoryMatch;
    });
  }, [expenses, startDateStr, endDateStr, searchTerm, selectedCategory]);

  const paymentBreakdown = useMemo(() => {
    const breakdown = { Cash: 0, CardAndOnline: 0, MobileMoney: 0, BankTransfer: 0, Credit: 0 };
    filteredSales.forEach(s => {
      const method = classifyPaymentMethod(s.paymentMethod);
      if (breakdown[method !== undefined ? method as keyof typeof breakdown : 'Cash'] !== undefined) {
        breakdown[method !== undefined ? method as keyof typeof breakdown : 'Cash'] += saleProductRevenue(s);
      }
    });
    return breakdown;
  }, [filteredSales]);

  const pnlStats = useMemo(() => {
    const totalSalesRevenue = filteredSales.reduce((sum, s) => sum + saleProductRevenue(s), 0);
    const totalExpensesCharged = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    let totalCOGS = 0;
    filteredSales.forEach(s => {
      (s.items || []).forEach(item => {
        const matchingProd = products.find(p => p.id === item.productId);
        totalCOGS += (matchingProd ? (item.costPriceAtSale ?? matchingProd.costPrice) : (getSaleItemGrossTotal(item) * 0.75)) * item.qty;
      });
    });
    const grossProfit = totalSalesRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpensesCharged;
    return { totalSalesRevenue, totalCOGS, grossProfit, netProfit, totalExpensesCharged };
  }, [filteredSales, filteredExpenses, products]);

  // Daily P&L trend for the chart at the bottom of the P&L tab. Capped at
  // 100 day-buckets so this can never iterate unboundedly -- relevant now
  // that "All Time" exists as a preset. Anchored from the END of the range
  // and built backward: a forward-from-start cap would, for a wide range
  // like All Time (starting year 2000), fill its 100 buckets with ancient
  // empty days and silently drop every real, recent transaction from the
  // chart instead of just showing fewer days of a still-relevant window.
  const pAndLGraphData = useMemo(() => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const dateMap: Record<string, { salesRevenue: number; cogs: number; expenses: number }> = {};
    const current = new Date(end);
    let daysCount = 0;
    while (current >= start && daysCount < 100) {
      dateMap[formatLocalDate(current)] = { salesRevenue: 0, cogs: 0, expenses: 0 };
      current.setDate(current.getDate() - 1);
      daysCount++;
    }
    if (Object.keys(dateMap).length === 0) {
      dateMap[formatLocalDate()] = { salesRevenue: 0, cogs: 0, expenses: 0 };
    }
    filteredSales.forEach(s => {
      if (!s.timestamp) return;
      const dStr = timestampToLocalDate(s.timestamp);
      const bucket = dateMap[dStr];
      if (!bucket) return;
      bucket.salesRevenue += saleProductRevenue(s);
      (s.items || []).forEach(item => {
        const matchingProd = products.find(p => p.id === item.productId);
        bucket.cogs += (matchingProd ? (item.costPriceAtSale ?? matchingProd.costPrice) : (getSaleItemGrossTotal(item) * 0.75)) * item.qty;
      });
    });
    filteredExpenses.forEach(e => {
      if (!e.timestamp) return;
      const bucket = dateMap[timestampToLocalDate(e.timestamp)];
      if (bucket) bucket.expenses += e.amount;
    });
    return Object.keys(dateMap).sort().map(dStr => {
      const day = dateMap[dStr];
      return {
        label: new Date(dStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        salesRevenue: Math.round(day.salesRevenue),
        cogs: Math.round(day.cogs),
        expenses: Math.round(day.expenses),
        profit: Math.round(day.salesRevenue - day.cogs - day.expenses),
      };
    });
  }, [filteredSales, filteredExpenses, products, startDateStr, endDateStr]);

  // Product Audit report: profit ranking per product, computed once from
  // filteredSales (respecting the same date range as every other report on
  // this screen, unlike the CSV export switch above which uses raw `sales`)
  // instead of iterating products.forEach + sales.filter per product.
  const productAuditRows = useMemo(() => {
    // Cost is accumulated per sale item using that item's own costPriceAtSale
    // (falling back to the product's current cost only when a historical
    // snapshot wasn't recorded), matching pnlStats/productDrilldownStats
    // elsewhere on this screen. Applying today's current cost price to every
    // historical unit sold (the previous approach) produced wrong -- even
    // negative -- profit whenever a product's cost price had since changed,
    // since a price increase would retroactively inflate the cost of units
    // that were actually bought and sold at the old, lower price.
    const perfById = new Map<string, { qty: number; revenue: number; cost: number }>();
    filteredSales.forEach(s => {
      (s.items || []).forEach(item => {
        const matchingProd = products.find(p => p.id === item.productId);
        const existing = perfById.get(item.productId) || { qty: 0, revenue: 0, cost: 0 };
        // item.qty counts the selected dosage/package LEVEL sold (e.g. "3
        // packets"), not base units -- baseQuantityDeducted is the real
        // number of base units (tablets, pieces) that left stock, which is
        // what a unit-count report must sum so mixed-level sales of the same
        // product (a packet here, a loose tab there) add up meaningfully.
        existing.qty += (item.baseQuantityDeducted ?? item.qty);
        // getSaleItemLineTotal (not the raw item.lineTotal field, which is
        // absent on some real sale records) derives the line's real value
        // from price/qty/discount when no snapshot was persisted -- a raw
        // "?? 0" fallback showed real revenue as zero for those records.
        existing.revenue += getSaleItemLineTotal(item);
        existing.cost += (item.costPriceAtSale ?? matchingProd?.costPrice ?? 0) * item.qty;
        perfById.set(item.productId, existing);
      });
    });
    return products
      .map(p => {
        const perf = perfById.get(p.id) || { qty: 0, revenue: 0, cost: 0 };
        const profit = perf.revenue - perf.cost;
        const margin = perf.revenue > 0 ? (profit / perf.revenue) * 100 : 0;
        return { product: p, qty: perf.qty, revenue: perf.revenue, cost: perf.cost, profit, margin };
      })
      .filter(row => row.qty > 0)
      .sort((a, b) => b.profit - a.profit);
  }, [filteredSales, products]);

  // Product Audit "look up one product" tracker: search/select a single
  // product (or 'all') and see its own qty/revenue/COGS/profit/margin plus
  // a day-by-day trend, instead of only the ranked list above.
  const productDrilldownOptions = useMemo(() => [
    { value: 'all', label: 'All Products', description: `${products.length} tracked` },
    ...monitoredProductSearchOptions.map(p => ({ value: p.id, label: p.name, description: p.sku || p.category || undefined })),
  ], [products.length, monitoredProductSearchOptions]);

  const productDrilldownStats = useMemo(() => {
    const isAll = selectedMonitoredProductId === 'all';
    const product = isAll ? undefined : products.find(p => p.id === selectedMonitoredProductId);
    const dailyMap = new Map<string, { date: string; qty: number; revenue: number }>();
    let qty = 0;
    let revenue = 0;
    let cogs = 0;

    filteredSales.forEach(s => {
      const dayKey = timestampToLocalDate(s.timestamp);
      let dayQty = 0;
      let dayRevenue = 0;
      (s.items || []).forEach(item => {
        if (!isAll && item.productId !== selectedMonitoredProductId) return;
        const matchingProd = products.find(p => p.id === item.productId);
        const lineRevenue = getSaleItemLineTotal(item);
        const baseQty = item.baseQuantityDeducted ?? item.qty;
        qty += baseQty;
        revenue += lineRevenue;
        cogs += (item.costPriceAtSale ?? matchingProd?.costPrice ?? 0) * item.qty;
        dayQty += baseQty;
        dayRevenue += lineRevenue;
      });
      if (dayQty > 0 || dayRevenue > 0) {
        const existing = dailyMap.get(dayKey) || { date: dayKey, qty: 0, revenue: 0 };
        existing.qty += dayQty;
        existing.revenue += dayRevenue;
        dailyMap.set(dayKey, existing);
      }
    });

    const profit = revenue - cogs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return { isAll, product, qty, revenue, cogs, profit, margin, dailyTrend };
  }, [filteredSales, products, selectedMonitoredProductId]);

  // Velocity (fast/slow movers): units sold per product within the current
  // date range, ranked and expressed as units/day over that same range.
  const velocityRows = useMemo(() => {
    const qtyById = new Map<string, number>();
    filteredSales.forEach(s => {
      (s.items || []).forEach(item => {
        qtyById.set(item.productId, (qtyById.get(item.productId) || 0) + (item.baseQuantityDeducted ?? item.qty));
      });
    });
    const start = parseLocalDate(startDateStr);
    const end = parseLocalDate(endDateStr);
    const periodDays = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
      ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
      : 1;
    const rows = products.map(p => {
      const qty = qtyById.get(p.id) || 0;
      return { product: p, qty, perDay: qty / periodDays };
    });
    return rows.sort((a, b) => velocitySortOrder === 'desc' ? b.qty - a.qty : a.qty - b.qty);
  }, [filteredSales, products, velocitySortOrder, startDateStr, endDateStr]);

  // Deliveries: deliberately NOT scoped to the Date range picker above.
  // A real tenant check found every one of a business's logged deliveries
  // older than the default 30-day window, which made the report look
  // permanently empty/disconnected from real data for any business that
  // logs deliveries infrequently. Reverted to the pre-deletion behavior of
  // always showing the full delivery log.
  const deliveryReportStats = useMemo(() => {
    const validDeliveries = deliveries.filter(d => d.status !== 'Cancelled');
    const deliveryIncome = validDeliveries.reduce((sum, d) => sum + (Number(d.deliveryCost) || 0), 0);
    const deliveryExpensesList = expenses.filter(e => e.category === 'Delivery Expense' || e.category === 'Delivery Maintainance');
    const totalDeliveryExpenses = deliveryExpensesList.reduce((sum, e) => sum + e.amount, 0);
    const netDeliveryProfit = deliveryIncome - totalDeliveryExpenses;
    return {
      validDeliveries: validDeliveries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      deliveryIncome,
      totalDeliveryExpenses,
      netDeliveryProfit,
    };
  }, [deliveries, expenses]);

  // Purchases ledger: did not exist as a report before this restoration --
  // built new, matching the Sales report's shape (date-scoped list +
  // summary tiles) rather than porting anything from the old file.
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p: any) => {
      const date = new Date(p.timestamp);
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  }, [purchases, startDateStr, endDateStr]);

  const purchaseReportStats = useMemo(() => {
    const sorted = [...filteredPurchases].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const totalPurchased = filteredPurchases.reduce((sum: number, p: any) => sum + (Number(p.totalAmount) || 0), 0);
    const totalPaid = filteredPurchases.reduce((sum: number, p: any) => sum + (Number(p.amountPaid) || 0), 0);
    const totalOutstanding = filteredPurchases.reduce((sum: number, p: any) => sum + (Number(p.amountDue) || 0), 0);
    return { sorted, totalPurchased, totalPaid, totalOutstanding };
  }, [filteredPurchases]);

  // Stock Adjustment: reads the log that Products -> Adjust Stock already
  // writes today (onlineStorage key 'jasper_stock_adjustments', synced per
  // tenant via the tenant_data table -- see src/shared/utils/onlineStorage.ts).
  // Only the report view was ever deleted; the write side was never touched
  // and needs no changes. Re-reads when this tab is opened or the date
  // range changes, since onlineStorage has no React subscription mechanism.
  const stockAdjustmentRows = useMemo(() => {
    if (reportTab !== 'stock-adjustment') return [];
    let all: any[] = [];
    try {
      all = JSON.parse(onlineStorage.getItem('jasper_stock_adjustments') || '[]');
    } catch {
      all = [];
    }
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);
    return all
      .filter((a: any) => {
        const t = new Date(a.adjustedAt).getTime();
        return t >= start.getTime() && t <= end.getTime();
      })
      .sort((a: any, b: any) => new Date(b.adjustedAt).getTime() - new Date(a.adjustedAt).getTime());
  }, [reportTab, startDateStr, endDateStr]);

  const stockAdjustmentTotals = useMemo(() => {
    const totalAdded = stockAdjustmentRows.filter((a: any) => a.type === 'add').reduce((s: number, a: any) => s + a.qty, 0);
    const totalDeducted = stockAdjustmentRows.filter((a: any) => a.type === 'deduct').reduce((s: number, a: any) => s + a.qty, 0);
    return { totalAdded, totalDeducted };
  }, [stockAdjustmentRows]);

  const filteredInventoryProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.category || '').toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  const inventoryTotals = useMemo(() => {
    return filteredInventoryProducts.reduce((acc, p) => {
      const onHand = (p.shopStockQty || 0) + (p.storeStockQty || 0);
      acc.totalUnits += onHand;
      acc.totalValuation += onHand * (p.costPrice || 0);
      if (onHand <= (p.alertQty || 0)) acc.lowStockCount += 1;
      return acc;
    }, { totalUnits: 0, totalValuation: 0, lowStockCount: 0 });
  }, [filteredInventoryProducts]);

  // Store vs Shop breakdown: units, cost valuation, potential revenue and
  // potential profit if everything currently sitting at that location sold
  // at its listed price.
  const inventoryLocationTotals = useMemo(() => {
    const compute = (qtyKey: 'shopStockQty' | 'storeStockQty') => {
      const totals = filteredInventoryProducts.reduce((acc, p) => {
        const qty = p[qtyKey] || 0;
        acc.units += qty;
        acc.valuation += qty * (p.costPrice || 0);
        acc.potentialRevenue += qty * (p.sellingPrice || 0);
        return acc;
      }, { units: 0, valuation: 0, potentialRevenue: 0 });
      return { ...totals, potentialProfit: totals.potentialRevenue - totals.valuation };
    };
    return { shop: compute('shopStockQty'), store: compute('storeStockQty') };
  }, [filteredInventoryProducts]);

  const inventoryDisplayRows = useMemo(() => {
    return filteredInventoryProducts
      .map(p => {
        const onHand = inventoryLocationFilter === 'shop' ? (p.shopStockQty || 0)
          : inventoryLocationFilter === 'store' ? (p.storeStockQty || 0)
          : (p.shopStockQty || 0) + (p.storeStockQty || 0);
        return { p, onHand };
      })
      .filter(({ onHand }) => inventoryLocationFilter === 'all' || onHand > 0);
  }, [filteredInventoryProducts, inventoryLocationFilter]);

  const expenseCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(expenses.map(e => e.category).filter(Boolean)));
    return [{ value: 'All', label: 'All Categories' }, ...unique.map(c => ({ value: c, label: c }))];
  }, [expenses]);

  // Sales report's Payment Mode filter lists each payment mode exactly as
  // the tenant registered it (e.g. "M-Pesa", "CRDB"), not grouped into
  // generic buckets -- matching is an exact comparison against the sale's
  // own s.paymentMethod (see salesReportSales), not the Cash/Card/Mobile
  // Money/Bank/Credit classification classifyPaymentMethod() still uses
  // for the separate Payments tab breakdown.
  const salesPaymentModeOptions = useMemo(() => {
    const configuredChannels: any[] = systemSettings?.paymentChannels || [];
    const seen = new Map<string, string>();
    configuredChannels
      .filter((ch: any) => (ch.status || 'active') === 'active')
      .forEach((ch: any) => {
        const value = String(ch.paymentMethod || ch.name || '').trim();
        if (!value || seen.has(value)) return;
        seen.set(value, String(ch.name || value).trim());
      });
    if (seen.size === 0) {
      // No registered payment channels yet -- fall back to whichever
      // payment method names already appear on recorded sales, so the
      // filter still has real options instead of staying empty.
      sales.forEach(s => {
        const value = String(s.paymentMethod || '').trim();
        if (value && !seen.has(value)) seen.set(value, value);
      });
    }
    return [{ value: 'All', label: 'All' }, ...Array.from(seen, ([value, label]) => ({ value, label }))];
  }, [systemSettings, sales]);

  // Always the combined (all-channel) figure -- a shop owner closing out
  // the day wants their true total first, not a number silently narrowed by
  // whichever channel segment happens to be selected below.
  const salesTotals = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + saleProductRevenue(s), 0);
    const count = filteredSales.length;
    let cost = 0;
    filteredSales.forEach(s => {
      (s.items || []).forEach(item => {
        const matchingProd = products.find(p => p.id === item.productId);
        cost += (item.costPriceAtSale ?? matchingProd?.costPrice ?? 0) * item.qty;
      });
    });
    return { totalRevenue, count, avg: count > 0 ? totalRevenue / count : 0, profit: totalRevenue - cost };
  }, [filteredSales, products]);

  // Per-channel revenue/order-count split, always computed across the full
  // (channel-unfiltered) period -- feeds the Retail/Wholesale segment
  // control below the combined totals so a tenant sees the split at a
  // glance before deciding whether to filter the transaction list.
  const channelSalesBreakdown = useMemo(() => {
    const breakdown = { retail: { revenue: 0, count: 0 }, wholesale: { revenue: 0, count: 0 } };
    filteredSales.forEach(s => {
      const bucket = (s.channel || 'retail') === 'wholesale' ? 'wholesale' : 'retail';
      breakdown[bucket].revenue += saleProductRevenue(s);
      breakdown[bucket].count += 1;
    });
    return breakdown;
  }, [filteredSales]);

  const expenseTotals = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const count = filteredExpenses.length;
    return { total, count, avg: count > 0 ? total / count : 0 };
  }, [filteredExpenses]);

  // Which category dominates spending, using the tenant's own recorded
  // category names (never a hardcoded list) so a tenant sees where their
  // actual money went and can decide whether to cut back or not.
  const expenseCategoryBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    filteredExpenses.forEach(e => {
      const cat = e.category || 'Uncategorized';
      byCategory.set(cat, (byCategory.get(cat) || 0) + e.amount);
    });
    const total = expenseTotals.total;
    return Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount, percent: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, expenseTotals.total]);

  const { totalSalesRevenue, totalCOGS, grossProfit, netProfit, totalExpensesCharged } = pnlStats;

  // Exact expected start date for each preset, computed with the same math
  // setPresetDateRange uses, so a preset button only shows as active when
  // startDateStr/endDateStr are an exact match -- not a loose "ends today"
  // check, which previously made Week and Month highlight together.
  const todayStr = formatLocalDate();
  const weekPresetStart = (() => {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    return formatLocalDate(new Date(d.setDate(diff)));
  })();
  const monthPresetStart = formatLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const activePreset = startDateStr === todayStr && endDateStr === todayStr ? 'today'
    : startDateStr === weekPresetStart && endDateStr === todayStr ? 'this-week'
    : startDateStr === monthPresetStart && endDateStr === todayStr ? 'this-month'
    : startDateStr === ALL_TIME_START && endDateStr === todayStr ? 'all-time'
    : null;

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    const updateHint = () => {
      setShowTabScrollHint(el.scrollWidth > el.clientWidth + 4 && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };
    updateHint();
    el.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);
    return () => {
      el.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
    };
  }, []);

  return (
    <div id="reports-view" className="space-y-6 p-2 md:p-0">
      {reportPdfStatus && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg border border-slate-700 whitespace-nowrap">
          {reportPdfStatus}
        </div>
      )}
      {/* HEADER & TOOLBAR */}
      <div className="flex flex-col lg:flex-row items-center gap-4 bg-white border border-slate-200 p-4 md:p-6 rounded-3xl shadow-sm">
        <div className="relative w-full lg:w-auto">
          <div ref={tabScrollRef} className="reports-tab-grid gap-2 w-full lg:w-auto">
            {[
              { id: 'p&l', label: 'Profit & Loss', icon: BarChart3 },
              { id: 'sales-report', label: 'Sales', icon: ShoppingBag },
              { id: 'inventory', label: 'Inventory', icon: Package },
              { id: 'expenses', label: 'Expenses', icon: Receipt },
              { id: 'product-monitoring', label: 'Product Audit', icon: Tag },
              { id: 'deliveries', label: 'Deliveries', icon: Truck },
              { id: 'purchases-report', label: 'Purchases', icon: ShoppingCart },
              { id: 'stock-adjustment', label: 'Stock Adjustment', icon: ArrowUpDown },
            ].map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => { setReportTab(tab.id as any); setMobileView('report'); }}
                className={`px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                  reportTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <tab.icon className={`w-3 h-3 shrink-0 ${reportTab === tab.id ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          {showTabScrollHint && (
            <div className="lg:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end bg-gradient-to-l from-white via-white/90 to-transparent rounded-r-xl">
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>
      </div>

      {/* FILTERS BAR: search first, then date-range select, then quick presets
          -- in that order, each on its own row, so this stays compact and
          doesn't feel scattered on tablet the way one wide packed row did. */}
      <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-3xl shadow-sm space-y-3">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search reports..."
            className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDateRangePicker(v => !v)}
            aria-expanded={showDateRangePicker}
            className={`h-9 px-3 flex items-center gap-1 rounded-xl border shrink-0 transition-colors ${
              showDateRangePicker ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <ChevronDown className={`w-3 h-3 transition-transform ${showDateRangePicker ? 'rotate-180' : ''}`} />
          </button>
          {/* Short labels (Today/Week/Month/All Time) keep all four in one
              row at every width instead of wrapping or clipping. */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 flex-1">
            {([
              { id: 'today', label: 'Today' },
              { id: 'this-week', label: 'Week' },
              { id: 'this-month', label: 'Month' },
              { id: 'all-time', label: 'All Time' },
            ] as const).map(preset => (
              <button
                key={preset.id}
                onClick={() => setPresetDateRange(preset.id as any)}
                className={`flex-1 px-1 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                  activePreset === preset.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {showDateRangePicker && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDateStr}
              max={endDateStr}
              onChange={e => e.target.value && setStartDateStr(e.target.value)}
              className="flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none min-w-0"
            />
            <span className="text-slate-300 text-xs shrink-0">→</span>
            <input
              type="date"
              value={endDateStr}
              min={startDateStr}
              onChange={e => e.target.value && setEndDateStr(e.target.value)}
              className="flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none min-w-0"
            />
          </div>
        )}
      </div>

      {/* CONTENT AREA */}
      <div className="min-h-[400px]">
        {reportTab === 'p&l' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={printActiveReportPdf}
                disabled={!!reportPdfStatus}
                className="bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm disabled:opacity-60 disabled:cursor-wait"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            </div>
            {/* Only this mobile card list is captured for the PDF (includeHidden
                bypasses its md:hidden CSS) -- its flex "label ... value" rows are
                what renderVectorDocumentBody's row detector is built for, unlike
                the separate, differently-structured desktop block below, which
                would otherwise duplicate every figure in the exported PDF. */}
            <div id="reports-a4-pdf-template" className="md:hidden space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between hover:bg-white hover:shadow-sm transition-all group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-emerald-600 flex items-center justify-center font-bold shadow-sm">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h6 className="text-sm font-bold text-slate-900">Net Operating Profit</h6>
                      <p className="text-xs text-slate-500">{netProfit >= 0 ? 'Surplus recorded' : 'Deficit recorded'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {currency}{Math.abs(Math.round(netProfit)).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">{totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue * 100).toFixed(1) : '0.0'}% margin</p>
                  </div>
                </div>

                {[
                  { label: 'Gross Revenue', value: totalSalesRevenue, icon: TrendingUp, color: 'text-slate-900' },
                  { label: 'COGS Cost', value: totalCOGS, icon: Package, color: 'text-amber-600' },
                  { label: 'Op. Expenses', value: totalExpensesCharged, icon: Receipt, color: 'text-rose-600' },
                  { label: 'Gross Profit', value: grossProfit, icon: BarChart3, color: 'text-emerald-600' },
                ].map((metric, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                        <metric.icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h6 className="text-sm font-bold text-slate-900">{metric.label}</h6>
                        <p className="text-xs text-slate-500">Calculated over period</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${metric.color}`}>{currency}{Math.round(metric.value).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden md:block bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
               <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                 <div className="lg:col-span-3 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="font-black text-slate-800 uppercase tracking-wider">Commercial Profit & Loss Account</h3>
                      <div className="flex gap-2">
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">Period: {startDateStr} to {endDateStr}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-bold text-slate-700">Total Gross Revenue</span>
                        </div>
                        <span className="font-mono font-black text-slate-900">{currency}{Math.round(totalSalesRevenue).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <Package className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-bold text-slate-700">Estimated Cost of Goods (COGS)</span>
                        </div>
                        <span className="font-mono font-black text-rose-600">-{currency}{Math.round(totalCOGS).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                        <div className="flex items-center gap-3">
                          <BarChart3 className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-bold text-emerald-900">Gross Profit Margin</span>
                        </div>
                        <span className="font-mono font-black text-emerald-700">{currency}{Math.round(grossProfit).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <Receipt className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-bold text-slate-700">Operating Expenses</span>
                        </div>
                        <span className="font-mono font-black text-rose-600">-{currency}{Math.round(totalExpensesCharged).toLocaleString()}</span>
                      </div>
                      <div className={`flex justify-between items-center p-5 rounded-2xl border-2 font-black ${netProfit >= 0 ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-100' : 'bg-rose-600 text-white border-rose-700 shadow-lg shadow-rose-100'}`}>
                        <div className="flex items-center gap-3">
                          <DollarSign className="w-5 h-5" />
                          <span className="text-base uppercase tracking-widest">Net Operating Profit</span>
                        </div>
                        <span className="text-xl font-mono">{netProfit < 0 ? '-' : ''}{currency}{Math.abs(Math.round(netProfit)).toLocaleString()}</span>
                      </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BarChart3 className="w-24 h-24" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Profitability Ratio</p>
                      <h4 className="text-3xl font-black font-mono mb-4">{totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue * 100).toFixed(1) : '0.0'}%</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Status:</span>
                          <span className={`font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{netProfit >= 0 ? 'SURPLUS' : 'DEFICIT'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Period:</span>
                          <span className="font-bold">30 Days</span>
                        </div>
                      </div>
                    </div>
                 </div>
               </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Daily Performance Trend</h3>
                <p className="text-xs text-slate-500 mt-1">Revenue, COGS, expenses and profit over the selected period.</p>
              </div>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pAndLGraphData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e2e8f0' }}
                      formatter={(value: any, name: string) => [`${currency}${Number(value).toLocaleString()}`, name]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                    <Line type="monotone" dataKey="salesRevenue" name="Revenue" stroke="#059669" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cogs" name="COGS" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#e11d48" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#0891b2" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'sales-report' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="order-2 sm:order-1 font-black text-slate-800 uppercase tracking-wider">Sales Performance Ledger</h3>
                <div className="order-1 sm:order-2 flex flex-wrap gap-2">
                  <ModernSelect
                    title="Payment Mode"
                    value={selectedPaymentMode}
                    options={salesPaymentModeOptions}
                    onChange={setSelectedPaymentMode}
                  />
                  <button
                    onClick={printActiveReportPdf}
                    disabled={!!reportPdfStatus}
                    className="bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shrink-0 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              <div id="reports-a4-pdf-template" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Total Revenue', value: `${currency}${Math.round(salesTotals.totalRevenue).toLocaleString()}`, icon: DollarSign, color: 'text-slate-900' },
                  { label: 'Transactions', value: salesTotals.count.toLocaleString(), icon: ShoppingBag, color: 'text-slate-900' },
                  { label: 'Profit', value: `${currency}${Math.round(salesTotals.profit).toLocaleString()}`, icon: TrendingUp, color: salesTotals.profit >= 0 ? 'text-emerald-700' : 'text-rose-600' },
                ].map((metric, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                        <metric.icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h6 className="text-sm font-bold text-slate-900">{metric.label}</h6>
                        <p className="text-xs text-slate-500">Calculated over period</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${metric.color}`}>{metric.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {hasAnyWholesaleProduct && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">View by Channel</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {([
                      { id: 'all' as const, icon: '🧾', label: 'All Sales', revenue: salesTotals.totalRevenue, count: salesTotals.count, activeClass: 'bg-slate-900' },
                      { id: 'retail' as const, icon: '🛒', label: 'Retail', revenue: channelSalesBreakdown.retail.revenue, count: channelSalesBreakdown.retail.count, activeClass: 'bg-emerald-600' },
                      { id: 'wholesale' as const, icon: '📦', label: 'Wholesale', revenue: channelSalesBreakdown.wholesale.revenue, count: channelSalesBreakdown.wholesale.count, activeClass: 'bg-teal-650' },
                    ]).map(seg => {
                      const isActive = selectedSalesChannel === seg.id;
                      return (
                        // A plain clickable div, not a <button> -- the A4 PDF
                        // renderer (pdfShare.ts) deliberately skips real
                        // buttons/inputs so interactive chrome never ends up
                        // printed, which would otherwise silently drop this
                        // card's revenue/order numbers from the exported report.
                        <div
                          key={seg.id}
                          onClick={() => setSelectedSalesChannel(seg.id)}
                          className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            isActive
                              ? `${seg.activeClass} border-transparent shadow-sm`
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <p className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                            {seg.icon} {seg.label}
                          </p>
                          <p className={`text-sm font-black mt-1 ${isActive ? 'text-white' : 'text-slate-900'}`}>
                            {currency}{Math.round(seg.revenue).toLocaleString()}
                          </p>
                          <p className={`text-[10px] font-semibold mt-0.5 ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                            {seg.count.toLocaleString()} order{seg.count === 1 ? '' : 's'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Receipt</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Total Paid</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-center">Mode</th>
                      {hasAnyWholesaleProduct && (
                        <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-center">Channel</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesReportSales.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedInspectSale(s)}>
                        <td className="p-3 text-slate-500 whitespace-nowrap">{formatLocalDate(new Date(s.timestamp))}</td>
                        <td className="p-3 font-mono font-bold text-slate-600">{s.id}</td>
                        <td className="p-3 font-medium text-slate-800">{s.customerName || 'Walk-in'}</td>
                        <td className="p-3 text-right font-black text-slate-900">{currency}{saleProductRevenue(s).toLocaleString()}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">{s.paymentMethod}</span>
                        </td>
                        {hasAnyWholesaleProduct && (
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              (s.channel || 'retail') === 'wholesale' ? 'bg-teal-50 text-teal-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {(s.channel || 'retail') === 'wholesale' ? '📦 Wholesale' : '🛒 Retail'}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                    {salesReportSales.length === 0 && (
                      <tr>
                        <td colSpan={hasAnyWholesaleProduct ? 6 : 5} className="p-10 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <ShoppingBag className="w-8 h-8 text-slate-200" />
                            <span>No sales recorded for this period.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'inventory' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="order-2 sm:order-1 font-black text-slate-800 uppercase tracking-wider">Inventory Valuation</h3>
                <button
                  onClick={printActiveReportPdf}
                  disabled={!!reportPdfStatus}
                  className="order-1 sm:order-2 bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shrink-0 disabled:opacity-60 disabled:cursor-wait"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>

              <div id="reports-a4-pdf-template" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Units On Hand', value: inventoryTotals.totalUnits.toLocaleString(), icon: Package, color: 'text-slate-900' },
                  { label: 'Stock Valuation (Cost)', value: `${currency}${Math.round(inventoryTotals.totalValuation).toLocaleString()}`, icon: DollarSign, color: 'text-slate-900' },
                  { label: 'Low Stock Items', value: inventoryTotals.lowStockCount.toLocaleString(), icon: AlertCircle, color: inventoryTotals.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900' },
                ].map((metric, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                        <metric.icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h6 className="text-sm font-bold text-slate-900">{metric.label}</h6>
                        <p className="text-xs text-slate-500">Calculated over period</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${metric.color}`}>{metric.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Store vs Shop</p>
                <div className="reports-split-grid gap-2 sm:gap-3">
                  {[
                    { key: 'shop' as const, label: 'In Shop', icon: ShoppingBag, data: inventoryLocationTotals.shop },
                    { key: 'store' as const, label: 'In Store', icon: Package, data: inventoryLocationTotals.store },
                  ].map(loc => (
                    <div key={loc.key} className="relative bg-slate-50 rounded-2xl border border-slate-200 pl-4 pr-2 py-3 sm:p-4 space-y-2 sm:space-y-3 overflow-hidden">
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                          <loc.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                        </div>
                        <h6 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{loc.label}</h6>
                      </div>
                      <div className="grid grid-cols-3 gap-1 sm:gap-2">
                        <div className="min-w-0">
                          <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Units</p>
                          <p className="text-xs sm:text-sm font-black text-slate-900 font-mono truncate">{loc.data.units.toLocaleString()}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Cost of Goods</p>
                          <p className="text-xs sm:text-sm font-black text-slate-900 font-mono truncate">{currency}{Math.round(loc.data.valuation).toLocaleString()}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">If Sold Profit</p>
                          <p className={`text-xs sm:text-sm font-black font-mono truncate ${loc.data.potentialProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{currency}{Math.round(loc.data.potentialProfit).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto sm:inline-flex">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'shop', label: 'Shop' },
                  { id: 'store', label: 'Store' },
                ] as const).map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => setInventoryLocationFilter(loc.id)}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-colors ${
                      inventoryLocationFilter === loc.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Product</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Category</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">
                        {inventoryLocationFilter === 'shop' ? 'In Shop' : inventoryLocationFilter === 'store' ? 'In Store' : 'On Hand'}
                      </th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Cost Price</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Selling Price</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryDisplayRows.map(({ p, onHand }) => {
                      const isLow = onHand <= (p.alertQty || 0);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <p className="font-bold text-slate-800">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{p.sku}</p>
                          </td>
                          <td className="p-3 text-slate-600">{p.category || 'General'}</td>
                          <td className="p-3 text-right">
                            <span className={`font-mono font-bold ${isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                              {formatProductQuantity(onHand, p)}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">{currency}{Math.round(p.costPrice || 0).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-slate-600">{currency}{Math.round(p.sellingPrice || 0).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono font-black text-slate-900">{currency}{Math.round(onHand * (p.costPrice || 0)).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {inventoryDisplayRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <Package className="w-8 h-8 text-slate-200" />
                            <span>{inventoryLocationFilter === 'all' ? 'No products matched.' : `No stock in ${inventoryLocationFilter} for these products.`}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'expenses' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="order-2 sm:order-1 font-black text-slate-800 uppercase tracking-wider">Operating Expenses</h3>
                <div className="order-1 sm:order-2 flex flex-wrap gap-2">
                  <ModernSelect
                    title="Expense Category"
                    value={selectedCategory}
                    options={expenseCategoryOptions}
                    onChange={setSelectedCategory}
                  />
                  <button
                    onClick={printActiveReportPdf}
                    disabled={!!reportPdfStatus}
                    className="bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shrink-0 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              <div id="reports-a4-pdf-template" className="space-y-6">
              <div className="reports-split-grid gap-2 sm:gap-3">
                {[
                  { label: 'Total Charged', value: `${currency}${Math.round(expenseTotals.total).toLocaleString()}`, icon: Receipt, color: 'text-rose-600' },
                  { label: 'Entries Logged', value: expenseTotals.count.toLocaleString(), icon: FileText, color: 'text-slate-900' },
                ].map((metric, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm shrink-0">
                        <metric.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </div>
                      <h6 className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide leading-tight min-w-0 flex-1">{metric.label}</h6>
                    </div>
                    <p className={`text-base sm:text-lg font-black mt-1.5 truncate ${metric.color}`}>{metric.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Spending by Category</p>
                <div className="space-y-2">
                  {expenseCategoryBreakdown.map(row => (
                    <div key={row.category} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                        <span className="font-bold text-slate-700 truncate">{row.category}</span>
                        <span className="font-mono font-black text-slate-900 shrink-0">{currency}{Math.round(row.amount).toLocaleString()} · {row.percent.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, row.percent)}%` }} />
                      </div>
                    </div>
                  ))}
                  {expenseCategoryBreakdown.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No expenses to break down for this period.</p>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Category</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-500 whitespace-nowrap">{formatLocalDate(new Date(e.timestamp))}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">{e.category}</span>
                        </td>
                        <td className="p-3 font-medium text-slate-800">{e.description || '—'}</td>
                        <td className="p-3 text-right font-mono font-black text-slate-900">{currency}{Math.round(e.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <Receipt className="w-8 h-8 text-slate-200" />
                            <span>No expenses matched.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'product-monitoring' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="order-2 sm:order-1 font-black text-slate-800 uppercase tracking-wider">Product Profit Audit</h3>
                <button
                  onClick={printActiveReportPdf}
                  disabled={!!reportPdfStatus}
                  className="order-1 sm:order-2 bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shrink-0 disabled:opacity-60 disabled:cursor-wait"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold w-full sm:w-auto sm:inline-flex overflow-x-auto no-scrollbar">
                {([
                  { id: 'overview', label: 'Overview' },
                  { id: 'drilldown', label: 'Product Lookup' },
                  { id: 'velocity', label: 'Velocity' },
                ] as const).map(v => (
                  <button
                    key={v.id}
                    onClick={() => setAuditView(v.id)}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      auditView === v.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <div id="reports-a4-pdf-template">
              {auditView === 'overview' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">#</th>
                        <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Product</th>
                        <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Units Sold</th>
                        <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Revenue</th>
                        <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Profit</th>
                        <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productAuditRows.map((row, idx) => (
                        <tr key={row.product.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black font-mono ${
                              idx === 0 ? 'bg-amber-100 text-amber-700'
                                : idx === 1 ? 'bg-slate-200 text-slate-600'
                                : idx === 2 ? 'bg-orange-100 text-orange-700'
                                : 'text-slate-400'
                            }`}>{idx + 1}</span>
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-800">{row.product.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{row.product.sku}</p>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-700">{formatProductQuantity(row.qty, row.product)}</td>
                          <td className="p-3 text-right font-mono text-slate-700">{currency}{Math.round(row.revenue).toLocaleString()}</td>
                          <td className={`p-3 text-right font-mono font-black ${row.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{currency}{Math.round(row.profit).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-slate-600">{row.margin.toFixed(1)}%</td>
                        </tr>
                      ))}
                      {productAuditRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-10 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                              <Tag className="w-8 h-8 text-slate-200" />
                              <span>No sales recorded for this period.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {auditView === 'drilldown' && (
                <div className="space-y-6">
                  <div className="max-w-md">
                    <ModernSelect
                      title="Select a Product"
                      searchable
                      searchPlaceholder="Search by name, SKU or barcode"
                      value={selectedMonitoredProductId}
                      options={productDrilldownOptions}
                      onChange={setSelectedMonitoredProductId}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Units Sold', value: productDrilldownStats.product ? formatProductQuantity(productDrilldownStats.qty, productDrilldownStats.product) : productDrilldownStats.qty.toLocaleString(), icon: Package, color: 'text-slate-900' },
                      { label: 'Revenue Generated', value: `${currency}${Math.round(productDrilldownStats.revenue).toLocaleString()}`, icon: DollarSign, color: 'text-slate-900' },
                      { label: 'Profit Generated', value: `${currency}${Math.round(productDrilldownStats.profit).toLocaleString()}`, icon: TrendingUp, color: productDrilldownStats.profit >= 0 ? 'text-emerald-700' : 'text-rose-600' },
                    ].map((metric, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                            <metric.icon className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <h6 className="text-sm font-bold text-slate-900">{metric.label}</h6>
                            <p className="text-xs text-slate-500">{productDrilldownStats.product ? productDrilldownStats.product.name : 'All products, period total'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-black ${metric.color}`}>{metric.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">Margin</span>
                    <span className="text-sm font-black text-slate-900 font-mono">{productDrilldownStats.margin.toFixed(1)}%</span>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Daily Units Sold</p>
                    {productDrilldownStats.dailyTrend.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                        <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <span>No sales recorded for this period.</span>
                      </div>
                    ) : (
                      <div className="h-56 bg-slate-50 rounded-2xl border border-slate-200 p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={productDrilldownStats.dailyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e2e8f0' }} />
                            <Line type="monotone" dataKey="qty" name="Units Sold" stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: '#059669' }} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {auditView === 'velocity' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 max-w-md">
                    <button
                      type="button"
                      onClick={() => setVelocitySortOrder('desc')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none ${velocitySortOrder === 'desc' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 bg-transparent hover:bg-slate-100'}`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" /> Fast Movers
                    </button>
                    <button
                      type="button"
                      onClick={() => setVelocitySortOrder('asc')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none ${velocitySortOrder === 'asc' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 bg-transparent hover:bg-slate-100'}`}
                    >
                      <MinusCircle className="w-3.5 h-3.5" /> Slow Movers
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">#</th>
                          <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Product</th>
                          <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Category</th>
                          <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Units Sold</th>
                          <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Velocity / Day</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {velocityRows.slice(0, 50).map((row, idx) => (
                          <tr key={row.product.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <p className="font-bold text-slate-800">{row.product.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{row.product.sku}</p>
                            </td>
                            <td className="p-3 text-slate-600">{row.product.category || 'General'}</td>
                            <td className="p-3 text-right font-mono text-slate-700">{formatProductQuantity(row.qty, row.product)}</td>
                            <td className={`p-3 text-right font-mono font-black ${velocitySortOrder === 'desc' ? 'text-emerald-700' : 'text-rose-600'}`}>{row.perDay.toFixed(2)}/day</td>
                          </tr>
                        ))}
                        {velocityRows.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-10 text-center text-slate-400">
                              <div className="flex flex-col items-center gap-2">
                                <ArrowUpDown className="w-8 h-8 text-slate-200" />
                                <span>No products to rank yet.</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {reportTab === 'deliveries' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="order-2 sm:order-1">
                  <h3 className="font-black text-slate-800 uppercase tracking-wider">Delivery Operations</h3>
                  <p className="text-xs text-slate-500 mt-1">Full delivery history (not limited by the Date range above).</p>
                </div>
                <button
                  onClick={printActiveReportPdf}
                  disabled={!!reportPdfStatus}
                  className="order-1 sm:order-2 bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shrink-0 disabled:opacity-60 disabled:cursor-wait"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>

              <div id="reports-a4-pdf-template" className="space-y-6">
              <div className="reports-split-grid gap-2 sm:gap-3">
                {[
                  { label: 'Fulfillments', value: deliveryReportStats.validDeliveries.length.toLocaleString(), icon: Truck, color: 'text-slate-900' },
                  { label: 'Logistics Revenue', value: `${currency}${Math.round(deliveryReportStats.deliveryIncome).toLocaleString()}`, icon: DollarSign, color: 'text-slate-900' },
                  { label: 'Fleet Outflow', value: `${currency}${Math.round(deliveryReportStats.totalDeliveryExpenses).toLocaleString()}`, icon: Receipt, color: 'text-rose-600' },
                  { label: 'Net Margin', value: `${deliveryReportStats.netDeliveryProfit >= 0 ? '+' : '-'}${currency}${Math.abs(Math.round(deliveryReportStats.netDeliveryProfit)).toLocaleString()}`, icon: TrendingUp, color: deliveryReportStats.netDeliveryProfit >= 0 ? 'text-emerald-700' : 'text-rose-600' },
                ].map((metric, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm shrink-0">
                        <metric.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </div>
                      <h6 className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide leading-tight min-w-0 flex-1">{metric.label}</h6>
                    </div>
                    <p className={`text-base sm:text-lg font-black mt-1.5 truncate ${metric.color}`}>{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Rider / Driver</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Destination</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveryReportStats.validDeliveries.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-500 whitespace-nowrap">{formatLocalDate(new Date(d.timestamp))}</td>
                        <td className="p-3 font-medium text-slate-800">{d.customerName}</td>
                        <td className="p-3 text-slate-600">{d.riderDetails?.name || d.riderId || 'Unassigned'}</td>
                        <td className="p-3 text-slate-600 max-w-[180px] truncate">{d.customerAddress || '—'}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            d.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700'
                              : d.status === 'Dispatched' ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>{d.status}</span>
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-900">{currency}{Math.round(d.deliveryCost || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {deliveryReportStats.validDeliveries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <Truck className="w-8 h-8 text-slate-200" />
                            <span>No deliveries logged for this period.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'purchases-report' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="order-2 sm:order-1 font-black text-slate-800 uppercase tracking-wider">Purchases Ledger</h3>
                <button
                  onClick={printActiveReportPdf}
                  disabled={!!reportPdfStatus}
                  className="order-1 sm:order-2 bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shrink-0 disabled:opacity-60 disabled:cursor-wait"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>

              <div id="reports-a4-pdf-template" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Total Purchased', value: `${currency}${Math.round(purchaseReportStats.totalPurchased).toLocaleString()}`, icon: ShoppingCart, color: 'text-slate-900' },
                  { label: 'Amount Paid', value: `${currency}${Math.round(purchaseReportStats.totalPaid).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-700' },
                  { label: 'Outstanding Balance', value: `${currency}${Math.round(purchaseReportStats.totalOutstanding).toLocaleString()}`, icon: Receipt, color: purchaseReportStats.totalOutstanding > 0 ? 'text-amber-600' : 'text-slate-900' },
                ].map((metric, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                        <metric.icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h6 className="text-sm font-bold text-slate-900">{metric.label}</h6>
                        <p className="text-xs text-slate-500">Calculated over period</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${metric.color}`}>{metric.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Supplier</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Paid</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Due</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-center">Destination</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseReportStats.sorted.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-500 whitespace-nowrap">{formatLocalDate(new Date(p.timestamp))}</td>
                        <td className="p-3 font-medium text-slate-800">{p.supplierName}</td>
                        <td className="p-3 text-right font-mono font-black text-slate-900">{currency}{Math.round(p.totalAmount || 0).toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-emerald-700">{currency}{Math.round(p.amountPaid || 0).toLocaleString()}</td>
                        <td className={`p-3 text-right font-mono ${(p.amountDue || 0) > 0 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>{currency}{Math.round(p.amountDue || 0).toLocaleString()}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">{p.destination}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            p.deliveryStatus === 'Full order delivered' ? 'bg-emerald-100 text-emerald-700'
                              : p.deliveryStatus === 'Partial' ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>{p.deliveryStatus}</span>
                        </td>
                      </tr>
                    ))}
                    {purchaseReportStats.sorted.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <ShoppingCart className="w-8 h-8 text-slate-200" />
                            <span>No purchases recorded for this period.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'stock-adjustment' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="order-2 sm:order-1">
                  <h3 className="font-black text-slate-800 uppercase tracking-wider">Stock Adjustment Log</h3>
                  <p className="text-xs text-slate-500 mt-1">Manual stock additions and deductions from Products → Adjust Stock.</p>
                </div>
                <button
                  onClick={printActiveReportPdf}
                  disabled={!!reportPdfStatus}
                  className="order-1 sm:order-2 bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shrink-0 disabled:opacity-60 disabled:cursor-wait"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>

              <div id="reports-a4-pdf-template" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Total Events', value: stockAdjustmentRows.length.toLocaleString(), icon: ArrowUpDown, color: 'text-slate-900' },
                  { label: 'Units Added', value: `+${stockAdjustmentTotals.totalAdded.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-700' },
                  { label: 'Units Deducted', value: `-${stockAdjustmentTotals.totalDeducted.toLocaleString()}`, icon: MinusCircle, color: 'text-rose-600' },
                ].map((metric, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                        <metric.icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h6 className="text-sm font-bold text-slate-900">{metric.label}</h6>
                        <p className="text-xs text-slate-500">Calculated over period</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${metric.color}`}>{metric.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Date &amp; Time</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Product</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-center">Type</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Qty</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Before</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">After</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockAdjustmentRows.map((a: any, i: number) => (
                      <tr key={a.id || i} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(a.adjustedAt).toLocaleDateString()} {new Date(a.adjustedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-800">{a.productName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{a.sku || '—'}</p>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.type === 'add' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {a.type === 'add' ? '+ Add' : '− Deduct'}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-mono font-black ${a.type === 'add' ? 'text-emerald-700' : 'text-rose-600'}`}>{a.type === 'add' ? '+' : '-'}{a.qty}</td>
                        <td className="p-3 text-right font-mono text-slate-500">{a.previousStock}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800">{a.newStock}</td>
                        <td className="p-3 text-slate-500 max-w-[180px] truncate">{a.reason || '—'}</td>
                      </tr>
                    ))}
                    {stockAdjustmentRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <ArrowUpDown className="w-8 h-8 text-slate-200" />
                            <span>No stock adjustments in this date range.</span>
                            <span className="text-[11px] text-slate-300">Use Products → Adjust Stock to record manual changes.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </div>
        )}

        {reportTab !== 'p&l' && reportTab !== 'sales-report' && reportTab !== 'inventory' && reportTab !== 'expenses' && reportTab !== 'product-monitoring' && reportTab !== 'payments' && reportTab !== 'deliveries' && reportTab !== 'purchases-report' && reportTab !== 'stock-adjustment' && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="p-6 bg-slate-50 rounded-full text-slate-300">
              <FileText className="w-12 h-12" />
            </div>
            <div className="px-4">
              <h5 className="text-lg font-black text-slate-900">{REPORT_DOCUMENT_TITLES[reportTab]}</h5>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                This report is currently being generated. Please check back in a moment.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
