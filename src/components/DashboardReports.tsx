import React, { useState, useEffect, useMemo } from 'react';
import { Product, Sale, Tenant, Expense, CustomRole, Supplier } from '../types';
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
  Smartphone,
  AlertTriangle,
  Archive,
  FileText,
  Image,
  UploadCloud,
  Eye,
  ShieldAlert,
  Download,
  Printer,
  Truck,
  ChevronDown,
  ChevronUp,
  MinusCircle,
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  Scale
} from 'lucide-react';
import { formatProductQuantity, formatSaleItemQuantity, getProductUnitName } from '../utils/unitFormatter';
import { downloadPdfFromElement } from '../utils/pdfShare';
import CachedImage from './CachedImage';

// Revenue helper: exclude delivery fees from product revenue calculations
const saleProductRevenue = (s: any): number =>
  s.productTotal !== undefined ? s.productTotal : (s.total - (s.deliveryCost || 0));

interface DashboardReportsProps {
  activeTenant: Tenant;
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  userName: string;
  defaultTab?: 'p&l' | 'sales-report' | 'payments' | 'inventory' | 'velocity' | 'users' | 'expenses' | 'product-monitoring' | 'deliveries';
  rolePermissions?: CustomRole['permissions'];
  suppliers?: Supplier[];
  purchases?: any[];
  deliveries?: any[];
  systemSettings?: any;
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
}: DashboardReportsProps) {
  const currency = activeTenant.currency;
  const printActiveReportPdf = async () => {
    await downloadPdfFromElement({
      elementId: 'reports-a4-pdf-template',
      fileName: `${activeTenant.name.replace(/\s+/g, '-')}-${reportTab}-report-${startDateStr}-${endDateStr}.pdf`,
      format: 'a4',
      includeHidden: true,
      visual: false,
      branding: {
        businessName: systemSettings?.business?.businessName || activeTenant.name,
        logo: systemSettings?.business?.businessLogoLight
          || systemSettings?.business?.businessLogo
          || systemSettings?.business?.logo
          || systemSettings?.company?.logo
          || activeTenant.company_settings?.logo_url
          || '',
        address: systemSettings?.business?.address || systemSettings?.company?.address || activeTenant.city,
        phone: systemSettings?.business?.phone || systemSettings?.company?.phone || '',
        email: systemSettings?.business?.email || systemSettings?.company?.email || '',
        documentTitle: REPORT_DOCUMENT_TITLES[reportTab] || 'Business Report',
        dateRange: `${startDateStr} to ${endDateStr}`,
        generatedBy: userName,
      }
    });
  };
  
  // Tab within reports
  const [reportTab, setReportTab] = useState<'p&l' | 'sales-report' | 'payments' | 'inventory' | 'velocity' | 'users' | 'expenses' | 'product-monitoring' | 'dual-channel' | 'deliveries' | 'bulk-products' | 'stock-adjustment'>(
    (defaultTab as any) || (rolePermissions?.reportsProfitCogs?.read !== false ? 'p&l' : 'sales-report')
  );

  useEffect(() => {
    if (defaultTab) {
      setReportTab(defaultTab);
    } else if (rolePermissions?.reportsProfitCogs?.read === false && reportTab === 'p&l') {
      setReportTab('sales-report');
    }
  }, [defaultTab, rolePermissions]);

  // Filter conditions
  const [startDateStr, setStartDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default to last 30 days
    return d.toISOString().split('T')[0];
  });
  const [endDateStr, setEndDateStr] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Product Monitoring local states
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
    }
  }, [selectedMonitoredProductId]);

  const [mobileView, setMobileView] = useState<'menu' | 'report'>('menu');

  const setPresetDateRange = (preset: 'today' | 'this-week' | 'this-month' | 'last-30') => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    let startStr = '';

    if (preset === 'today') {
      startStr = endStr;
    } else if (preset === 'this-week') {
      const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      startStr = monday.toISOString().split('T')[0];
    } else if (preset === 'this-month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const tzOffset = firstDay.getTimezoneOffset() * 60000;
      const localFirstDay = new Date(firstDay.getTime() - tzOffset);
      startStr = localFirstDay.toISOString().split('T')[0];
    } else if (preset === 'last-30') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      startStr = past30.toISOString().split('T')[0];
    }

    setStartDateStr(startStr);
    setEndDateStr(endStr);
  };

  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [velocitySortOrder, setVelocitySortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileSelectorOpen, setMobileSelectorOpen] = useState(false);

  // Additional Sales Report local filters
  const [salesSearch, setSalesSearch] = useState('');
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>('All');
  const [selectedInspectSale, setSelectedInspectSale] = useState<Sale | null>(null);

  // Expense Logger Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('Utilities & Power');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseImage, setExpenseImage] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [previewReceiptImage, setPreviewReceiptImage] = useState<string | null>(null);

  // -------------------------------------------------------------
  // A4 SPREADSHEET EXPORTERS WITH DATE FILTER COMPATIBILITY
  // -------------------------------------------------------------
  const handleDownloadSalesSpreadsheet = () => {
    let csv = "A4 Sales Ledger Report\r\n";
    csv += `Scope Period,${startDateStr} to ${endDateStr}\r\n`;
    csv += `Generated On,${new Date().toLocaleString()}\r\n`;
    csv += `Branch,${activeTenant.name} (${activeTenant.city})\r\n\r\n`;
    csv += "Receipt ID,Customer,Items Count,Voucher Total,VAT/Sales Tax,Discount Amnt,Grand Amount Paid,Remaining Due,Mode,Logged Timestamp\r\n";
    
    filteredSales.forEach(s => {
      const itemsCount = s.items.length;
      const originalSub = s.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const discountVal = s.discountType === 'percent' ? (originalSub * (s.discount || 0)) / 100 : (s.discount || 0);
      const totalPaid = saleProductRevenue(s);
      const unpaidDue = s.amountDue || 0;
      csv += `"${s.id}","${s.customerName || 'Walk-in customer'}",${itemsCount},${originalSub.toFixed(2)},${s.tax.toFixed(2)},${discountVal.toFixed(2)},${totalPaid.toFixed(2)},${unpaidDue.toFixed(2)},"${s.paymentMethod}","${new Date(s.timestamp).toLocaleString()}"\r\n`;
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `A4_Sales_Ledger_${startDateStr}_to_${endDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadProductsSpreadsheet = () => {
    let csv = "A4 Product Catalog Inventory Report\r\n";
    csv += `Scope Period,${startDateStr} to ${endDateStr}\r\n`;
    csv += `Generated On,${new Date().toLocaleString()}\r\n`;
    csv += `Branch,${activeTenant.name} (${activeTenant.city})\r\n\r\n`;
    csv += "Product Name,Item Code,Barcode,Category,Cost Price,Retail Selling Price,Shop Floor Qty,Backroom Store Qty,Total Quantity On-Hand,Valuation at Cost,Potential Margin Value\r\n";
    
    products.forEach(p => {
      const totalOnHand = p.stockQty || 0;
      const totalCostVal = totalOnHand * (p.costPrice || 0);
      const totalRetailVal = totalOnHand * (p.sellingPrice || 0);
      const potentialMargin = totalRetailVal - totalCostVal;
      csv += `"${p.name}","${p.sku || ''}","${p.barcode || ''}","${p.category || 'General'}",${p.costPrice.toFixed(2)},${p.sellingPrice.toFixed(2)},${p.shopStockQty || 0},${p.storeStockQty || 0},${totalOnHand},${totalCostVal.toFixed(2)},${potentialMargin.toFixed(2)}\r\n`;
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `A4_Product_Catalog_${startDateStr}_to_${endDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExpensesSpreadsheet = () => {
    let csv = "A4 Operating Expenses Ledger\r\n";
    csv += `Scope Period,${startDateStr} to ${endDateStr}\r\n`;
    csv += `Generated On,${new Date().toLocaleString()}\r\n`;
    csv += `Branch,${activeTenant.name} (${activeTenant.city})\r\n\r\n`;
    csv += "Expense ID,Category,Description,Amount,Cashier logged,Timestamp\r\n";
    
    filteredExpenses.forEach(e => {
      csv += `"${e.id}","${e.category}","${(e.description || '').replace(/"/g, '""')}",${e.amount.toFixed(2)},"${e.staffName || 'Admin'}","${new Date(e.timestamp).toLocaleString()}"\r\n`;
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `A4_Operating_Expenses_${startDateStr}_to_${endDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPnLSpreadsheet = () => {
    const totalSalesRev = filteredSales.reduce((sum, s) => sum + saleProductRevenue(s), 0);
    const totalExp = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    let estimatedCOGS = 0;
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const matchingProd = products.find(p => p.id === item.productId);
        if (matchingProd) {
          estimatedCOGS += ((item.costPriceAtSale ?? matchingProd.costPrice) * item.qty);
        } else {
          estimatedCOGS += (item.price * item.qty * 0.75);
        }
      });
    });

    const grossProfit = totalSalesRev - estimatedCOGS;
    const netProfit = grossProfit - totalExp;

    let csv = "A4 Consolidated Balance Statement of Profit and Loss\r\n";
    csv += `Scope Period,${startDateStr} to ${endDateStr}\r\n`;
    csv += `Generated On,${new Date().toLocaleString()}\r\n`;
    csv += `Branch,${activeTenant.name} (${activeTenant.city})\r\n\r\n`;
    csv += "Financial Line Item,Statement Value,Proportion Ratio\r\n";
    csv += `1. Gross Revenue Receipts,${totalSalesRev.toFixed(2)},100%\r\n`;
    csv += `2. Cost of Goods Sold (COGS),${estimatedCOGS.toFixed(2)},${((estimatedCOGS / Math.max(1, totalSalesRev)) * 100).toFixed(1)}%\r\n`;
    csv += `3. Gross Profit Margin,${grossProfit.toFixed(2)},${((grossProfit / Math.max(1, totalSalesRev)) * 100).toFixed(1)}%\r\n`;
    csv += `4. Operating Expenses Charged,${totalExp.toFixed(2)},${((totalExp / Math.max(1, totalSalesRev)) * 100).toFixed(1)}%\r\n`;
    csv += `5. NET OPERATING PROFIT/LOSS,${netProfit.toFixed(2)},${((netProfit / Math.max(1, totalSalesRev)) * 100).toFixed(1)}%\r\n`;

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `A4_Consolidated_PL_${startDateStr}_to_${endDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Automated CSV compilation for any active report view
  const handleDownloadActiveTabCSV = () => {
    let csv = "";
    const headerPrefix = `A4 ${reportTab.toUpperCase()} LEDGER REPORT\r\n` +
                         `Scope Period,${startDateStr} to ${endDateStr}\r\n` +
                         `Generated On,${new Date().toLocaleString()}\r\n` +
                         `Branch,${activeTenant.name} (${activeTenant.city})\r\n\r\n`;

    switch (reportTab) {
      case 'p&l': {
        handleDownloadPnLSpreadsheet();
        return;
      }
      case 'sales-report': {
        handleDownloadSalesSpreadsheet();
        return;
      }
      case 'expenses': {
        handleDownloadExpensesSpreadsheet();
        return;
      }
      case 'inventory': {
        handleDownloadProductsSpreadsheet();
        return;
      }
      case 'payments': {
        csv = headerPrefix;
        csv += "Payment Channel,Invoiced Total ($),Approval Count,% Contribution\r\n";
        const sumTotal = Object.values(paymentBreakdown).reduce((a, b) => a + b, 0);
        csv += `Cash,${paymentBreakdown.Cash.toFixed(2)},${filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Cash').length},${sumTotal > 0 ? ((paymentBreakdown.Cash / sumTotal) * 100).toFixed(1) : 0}%\r\n`;
        csv += `Card/Online,${paymentBreakdown.CardAndOnline.toFixed(2)},${filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Card').length},${sumTotal > 0 ? ((paymentBreakdown.CardAndOnline / sumTotal) * 100).toFixed(1) : 0}%\r\n`;
        csv += `Mobile Money,${paymentBreakdown.MobileMoney.toFixed(2)},${filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Mobile Money').length},${sumTotal > 0 ? ((paymentBreakdown.MobileMoney / sumTotal) * 100).toFixed(1) : 0}%\r\n`;
        csv += `Bank Transfer,${paymentBreakdown.BankTransfer.toFixed(2)},${filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Bank').length},${sumTotal > 0 ? ((paymentBreakdown.BankTransfer / sumTotal) * 100).toFixed(1) : 0}%\r\n`;
        csv += `Deferred Credit,${paymentBreakdown.Credit.toFixed(2)},${filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Credit').length},${sumTotal > 0 ? ((paymentBreakdown.Credit / sumTotal) * 100).toFixed(1) : 0}%\r\n`;
        break;
      }
      case 'product-monitoring': {
        csv = headerPrefix;
        csv += "Rank,Product Name,Item Code,Cost Buy,Retail Pricing,Profit Margin,Units Sold,Gross Revenue,Margin Earned\r\n";
        const prodPerfMap: Record<string, { name: string; sku: string; cost: number; price: number; margin: number; sold: number; rev: number; profit: number }> = {};
        filteredSales.forEach(s => {
          s.items.forEach(it => {
            if (!prodPerfMap[it.productId]) {
              const match = products.find(p => p.id === it.productId);
              prodPerfMap[it.productId] = {
                name: it.productName,
                sku: match?.sku || '',
                cost: it.costPriceAtSale ?? match?.costPrice ?? 0,
                price: it.price,
                margin: it.price - (it.costPriceAtSale ?? match?.costPrice ?? 0),
                sold: 0,
                rev: 0,
                profit: 0
              };
            }
            prodPerfMap[it.productId].sold += it.qty;
            prodPerfMap[it.productId].rev += it.qty * it.price;
            prodPerfMap[it.productId].profit += it.qty * (it.price - prodPerfMap[it.productId].cost);
          });
        });
        const list = Object.values(prodPerfMap).sort((a,b) => b.sold - a.sold);
        list.forEach((item, index) => {
          csv += `${index + 1},"${item.name}","${item.sku}",${item.cost.toFixed(2)},${item.price.toFixed(2)},${item.margin.toFixed(2)},${item.sold},${item.rev.toFixed(2)},${item.profit.toFixed(2)}\r\n`;
        });
        break;
      }
      case 'velocity': {
        csv = headerPrefix;
        csv += "Rank,Product Name,Barcode,Category,Units Sold,Daily Velocity (Units/Day)\r\n";
        const prodSells: Record<string, { name: string; sku: string; barcode: string; cat: string; qty: number }> = {};
        products.forEach(p => {
          prodSells[p.id] = { name: p.name, sku: p.sku || '', barcode: p.barcode || '', cat: p.category || '', qty: 0 };
        });
        filteredSales.forEach(s => {
          s.items.forEach(it => {
            if (prodSells[it.productId]) {
              prodSells[it.productId].qty += it.qty;
            }
          });
        });
        const sorted = Object.values(prodSells).sort((a,b) => b.qty - a.qty);
        sorted.forEach((p, idx) => {
          csv += `${idx + 1},"${p.name}","${p.barcode}","${p.cat}",${p.qty},${(p.qty / 30).toFixed(2)}\r\n`;
        });
        break;
      }
      case 'users': {
        csv = headerPrefix;
        csv += "Category,Party Name,Primary Contact,Sales Tickets Volume,Accrued Worth Sum\r\n";
        const custMap: Record<string, { name: string; phone: string; count: number; spend: number }> = {};
        const staffMap: Record<string, { count: number; sales: number }> = {};
        filteredSales.forEach(s => {
          const cName = s.customerName || "Walk-In Customer";
          const cp = s.customerPhone || "";
          if (!custMap[cName]) {
            custMap[cName] = { name: cName, phone: cp, count: 0, spend: 0 };
          }
          custMap[cName].count++;
          custMap[cName].spend += saleProductRevenue(s);

          const stF = s.cashierName || "System Operator";
          if (!staffMap[stF]) {
            staffMap[stF] = { count: 0, sales: 0 };
          }
          staffMap[stF].count++;
          staffMap[stF].sales += saleProductRevenue(s);
        });

        csv += "--- PART ONE: CUSTOMER DIRECTORY AUDIT ---\r\n";
        Object.values(custMap).forEach(c => {
          csv += `Customer,"${c.name}","${c.phone}",${c.count},${c.spend.toFixed(2)}\r\n`;
        });
        csv += "--- PART TWO: STAFF OPERATOR AUDIT ---\r\n";
        Object.entries(staffMap).forEach(([name, st]) => {
          csv += `Staff Member,"${name}","",${st.count},${st.sales.toFixed(2)}\r\n`;
        });
        break;
      }
      case 'dual-channel': {
        csv = headerPrefix;
        csv += "Product Name,Item SKU,Cost Buy,Retail Price,Wholesale Price,Threshold Qty,Retail Eligible,Wholesale Eligible,Total On-Hand\r\n";
        products.forEach(p => {
          csv += `"${p.name}","${p.sku || ''}",${p.costPrice.toFixed(2)},${p.sellingPrice.toFixed(2)},${(p.wholesalePrice || p.sellingPrice * 0.9).toFixed(2)},${p.minWholesaleQty || 10},"${p.sellInRetail !== false ? 'YES' : 'NO'}","${p.sellInWholesale ? 'YES' : 'NO'}",${p.stockQty || 0}\r\n`;
        });
        break;
      }
      default: {
        alert("This tab does not support a dedicated spreadsheet.");
        return;
      }
    }

    if (csv) {
      const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `A4_${reportTab}_Audit_${startDateStr}_to_${endDateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // -------------------------------------------------------------
  // Helpers: Date Filter checking
  // -------------------------------------------------------------
  const isWithinDateRange = (timestampISO: string) => {
    const date = new Date(timestampISO);
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999); // Include full end date
    return date >= start && date <= end;
  };

  // Filtered master datasets
  const filteredSales = sales.filter(s => isWithinDateRange(s.timestamp));
  const filteredExpenses = expenses.filter(e => isWithinDateRange(e.timestamp));

  // Expense Categories Presets
  const EXPENSE_CATEGORIES = [
    'Utilities & Power',
    'Wages & Salary',
    'Logistics',
    'Packaging Materials',
    'Rent & Logistics',
    'Miscellaneous'
  ];

  const handleImageChange = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setExpenseImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageChange(e.dataTransfer.files[0]);
    }
  };

  // Submit expense handler
  const handleLogExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(expenseAmount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    const newExpense: Expense = {
      id: 'exp-' + Math.random().toString(36).substr(2, 9),
      category: expenseCategory,
      amount: amountVal,
      timestamp: new Date().toISOString(),
      description: expenseDesc || `${expenseCategory} branch charge`,
      staffName: userName,
      receiptRef: 'RCPT-SIM-' + Math.floor(10000 + Math.random() * 90000),
      tenantId: activeTenant.id,
      receiptImage: expenseImage || undefined
    };

    onAddExpense(newExpense);
    setIsExpenseModalOpen(false);
    setExpenseAmount('');
    setExpenseDesc('');
    setExpenseImage('');
    setDragActive(false);
  };

  // -------------------------------------------------------------
  // 1. Profit & Loss Computation
  // -------------------------------------------------------------
  // Gross sales receipts
  const totalSalesRevenue = filteredSales.reduce((acc, s) => acc + saleProductRevenue(s), 0);

  // Compute total gross sales before discounts or VAT
  const totalGrossSales = filteredSales.reduce((sum, s) => {
    return sum + s.items.reduce((iSum, item) => iSum + (item.price * item.qty), 0);
  }, 0);

  // Compute Cost of Goods Sold (COGS) for completed sales
  // Find COGS by fetching the target product's costPrice * quantity sold
  const totalCOGS = filteredSales.reduce((acc, sale) => {
    const saleCOGS = sale.items.reduce((sAcc, item) => {
      const matchProd = products.find(p => p.id === item.productId);
      const unitCost = item.costPriceAtSale ?? (matchProd ? matchProd.costPrice : (item.price * 0.6)); // Fallback: 60% of price
      return sAcc + (unitCost * item.qty);
    }, 0);
    return acc + saleCOGS;
  }, 0);

  const grossProfit = totalSalesRevenue - totalCOGS;
  const totalExpensesCharged = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = grossProfit - totalExpensesCharged;

  // Compute expenses breakdown by categories
  const expensesBreakdown = EXPENSE_CATEGORIES.map(cat => {
    const total = filteredExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
    return { name: cat, value: total };
  });

  // Chronological computation for financial chart comparison
  const pAndLGraphData = useMemo(() => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    // Safety check - build chronological date list
    const dateMap: Record<string, { salesCount: number; salesRevenue: number; cogs: number; expenses: number; profit: number }> = {};
    
    let current = new Date(start);
    let daysCount = 0;
    // Cap at 100 days to prevent browser hanging on extreme select range
    while (current <= end && daysCount < 100) {
      const dStr = current.toISOString().split('T')[0];
      dateMap[dStr] = {
        salesCount: 0,
        salesRevenue: 0,
        cogs: 0,
        expenses: 0,
        profit: 0
      };
      current.setDate(current.getDate() + 1);
      daysCount++;
    }

    if (Object.keys(dateMap).length === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      dateMap[todayStr] = { salesCount: 0, salesRevenue: 0, cogs: 0, expenses: 0, profit: 0 };
    }

    filteredSales.forEach(sale => {
      if (!sale.timestamp) return;
      const dStr = sale.timestamp.split('T')[0];
      if (dateMap[dStr]) {
        dateMap[dStr].salesCount += 1;
        dateMap[dStr].salesRevenue += saleProductRevenue(sale);
        
        const saleCogs = sale.items.reduce((sAcc, item) => {
          const matchProd = products.find(p => p.id === item.productId);
          const unitCost = item.costPriceAtSale ?? (matchProd ? matchProd.costPrice : (item.price * 0.6));
          return sAcc + (unitCost * item.qty);
        }, 0);
        
        dateMap[dStr].cogs += saleCogs;
      }
    });

    filteredExpenses.forEach(exp => {
      if (!exp.timestamp) return;
      const dStr = exp.timestamp.split('T')[0];
      if (dateMap[dStr]) {
        dateMap[dStr].expenses += exp.amount;
      }
    });

    Object.keys(dateMap).forEach(dStr => {
      const day = dateMap[dStr];
      day.profit = day.salesRevenue - day.cogs - day.expenses;
    });

    return Object.keys(dateMap).sort().map(dStr => {
      const dateObj = new Date(dStr);
      const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return {
        dateStr: dStr,
        label: formattedDate,
        salesCount: dateMap[dStr].salesCount,
        salesRevenue: Math.round(dateMap[dStr].salesRevenue),
        cogs: Math.round(dateMap[dStr].cogs),
        expenses: Math.round(dateMap[dStr].expenses),
        profit: Math.round(dateMap[dStr].profit)
      };
    });
  }, [startDateStr, endDateStr, filteredSales, filteredExpenses, products]);

  // Master Sales Report helper computations
  const recordsFilteredSales = useMemo(() => {
    return filteredSales.filter(sale => {
      const matchesPayment = salesPaymentFilter === 'All' || 
        (salesPaymentFilter === 'Mobile Money' && ['M-Pesa', 'MTN MoMo', 'Airtel Money', 'Mobile Money'].includes(sale.paymentMethod)) ||
        (salesPaymentFilter === 'Card' && ['Card', 'Paystack'].includes(sale.paymentMethod)) ||
        sale.paymentMethod === salesPaymentFilter;

      const query = salesSearch.toLowerCase().trim();
      const matchesSearch = !query || 
        sale.reference.toLowerCase().includes(query) ||
        (sale.customerName && sale.customerName.toLowerCase().includes(query)) ||
        (sale.customerPhone && sale.customerPhone.includes(query)) ||
        (sale.cashierName && sale.cashierName.toLowerCase().includes(query)) ||
        sale.items.some(item => item.productName.toLowerCase().includes(query));

      return matchesPayment && matchesSearch;
    });
  }, [filteredSales, salesPaymentFilter, salesSearch]);

  const salesReportMetrics = useMemo(() => {
    const totalOrders = recordsFilteredSales.length;
    const totalRevenue = recordsFilteredSales.reduce((sum, s) => sum + saleProductRevenue(s), 0);
    const totalTax = recordsFilteredSales.reduce((sum, s) => sum + s.tax, 0);
    const avgTicket = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    const paidRecords = recordsFilteredSales.filter(s => s.paymentMethod !== 'Credit');
    const paidCount = paidRecords.length;
    const paidRevenue = paidRecords.reduce((sum, s) => sum + saleProductRevenue(s), 0);

    const unpaidRecords = recordsFilteredSales.filter(s => s.paymentMethod === 'Credit');
    const unpaidCount = unpaidRecords.length;
    const unpaidRevenue = unpaidRecords.reduce((sum, s) => sum + saleProductRevenue(s), 0);

    const totalProfit = recordsFilteredSales.reduce((sum, s) => {
      const cogs = s.items.reduce((acc, item) => {
        const prod = products.find(p => p.id === item.productId);
        const cost = item.costPriceAtSale ?? (prod ? (prod.costPrice ?? 0) : 0);
        return acc + (cost * item.qty);
      }, 0);
      return sum + (saleProductRevenue(s) - cogs);
    }, 0);

    return {
      totalOrders,
      totalRevenue,
      totalTax,
      avgTicket,
      paidCount,
      paidRevenue,
      unpaidCount,
      unpaidRevenue,
      totalProfit
    };
  }, [recordsFilteredSales, products]);

  // -------------------------------------------------------------
  // 2. Payments Reports Calculation
  // -------------------------------------------------------------
  // paymentMethods: Cash, Card, bank transfer, mobile wallets, Credit
  const paymentModesList = ['All', 'Cash', 'Card', 'Mobile Money', 'Bank', 'Credit'];
  const classifyPaymentMethod = (method?: string) => {
    const value = String(method || '').toLowerCase();
    if (value.includes('credit')) return 'Credit';
    if (value.includes('cash')) return 'Cash';
    if (value.includes('card') || value.includes('paystack')) return 'Card';
    if (value.includes('bank') || value.includes('transfer') || value.includes('wire')) return 'Bank';
    if (value.includes('mpesa') || value.includes('m-pesa') || value.includes('momo') || value.includes('money') || value.includes('airtel') || value.includes('yas') || value.includes('mixx') || value.includes('tigo') || value.includes('wallet')) return 'Mobile Money';
    return method || 'Cash';
  };
  
  const matchesSelectedPaymentMode = (payMethod: string) => {
    if (selectedPaymentMode === 'All') return true;
    return classifyPaymentMethod(payMethod) === selectedPaymentMode;
  };

  const paymentsSalesFiltered = filteredSales.filter(s => matchesSelectedPaymentMode(s.paymentMethod));
  
  // Payment breakdown: use configured paymentChannels if available, else fallback to generic categories
  const configuredChannels: any[] = systemSettings?.paymentChannels || [];

  // Build per-method totals using actual sale.paymentMethod string matching
  const paymentMethodTotals = useMemo(() => {
    const totals: Record<string, { amount: number; count: number; label: string; category: string }> = {};

    filteredSales.forEach(s => {
      const method = s.paymentMethod || 'Cash';
      const rev = saleProductRevenue(s);
      // Try to match to a configured channel
      const matched = configuredChannels.find(ch =>
        ch.name?.toLowerCase() === method.toLowerCase() ||
        ch.provider?.toLowerCase() === method.toLowerCase() ||
        method.toLowerCase().includes(ch.name?.toLowerCase()) ||
        ch.name?.toLowerCase().includes(method.toLowerCase())
      );
      const key = matched ? matched.id : method;
      const label = matched ? matched.name : method;
      const category = matched ? matched.category : classifyPaymentMethod(method);
      if (!totals[key]) totals[key] = { amount: 0, count: 0, label, category };
      totals[key].amount += rev;
      totals[key].count += 1;
    });
    return totals;
  }, [filteredSales, configuredChannels]);

  // Build dynamic payment breakdown using actual payment method names from sales
  // Groups by exact method name recorded on each sale — respects user-configured methods
  const paymentBreakdownDynamic = useMemo(() => {
    const map: Record<string, { revenue: number; count: number }> = {};
    filteredSales.forEach(s => {
      const method = s.paymentMethod || 'Cash';
      if (!map[method]) map[method] = { revenue: 0, count: 0 };
      map[method].revenue += saleProductRevenue(s);
      map[method].count += 1;
    });
    return map;
  }, [filteredSales]);

  const paymentMethodEntries = Object.entries(paymentMethodTotals) as Array<[
    string,
    { amount: number; count: number; label: string; category: string }
  ]>;
  const paymentBreakdownEntries = Object.entries(paymentBreakdownDynamic) as Array<[
    string,
    { revenue: number; count: number }
  ]>;

  // Legacy breakdown (used by existing chart components — kept for backward compat)
  const paymentBreakdown = {
    Cash: filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Cash').reduce((a, s) => a + saleProductRevenue(s), 0),
    CardAndOnline: filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Card').reduce((a, s) => a + saleProductRevenue(s), 0),
    MobileMoney: filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Mobile Money').reduce((a, s) => a + saleProductRevenue(s), 0),
    BankTransfer: filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Bank').reduce((a, s) => a + saleProductRevenue(s), 0),
    Credit: filteredSales.filter(s => classifyPaymentMethod(s.paymentMethod) === 'Credit').reduce((a, s) => a + saleProductRevenue(s), 0)
  };

  // Group Payments by Date/Time Range Frequency (Daily, Monthly, Yearly)
  const getGroupedPayments = (freq: 'day' | 'month' | 'year') => {
    const groups: Record<string, { total: number; cash: number; card: number; momo: number; bank: number; credit: number; count: number }> = {};
    
    paymentsSalesFiltered.forEach(sale => {
      const dateObj = new Date(sale.timestamp);
      let key = '';
      if (freq === 'day') {
        key = dateObj.toLocaleDateString();
      } else if (freq === 'month') {
        key = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      } else {
        key = dateObj.getFullYear().toString();
      }

      if (!groups[key]) {
        groups[key] = { total: 0, cash: 0, card: 0, momo: 0, bank: 0, credit: 0, count: 0 };
      }

      groups[key].total += saleProductRevenue(sale);
      groups[key].count += 1;
      
      const paymentClass = classifyPaymentMethod(sale.paymentMethod);
      if (paymentClass === 'Cash') groups[key].cash += saleProductRevenue(sale);
      else if (paymentClass === 'Card') groups[key].card += saleProductRevenue(sale);
      else if (paymentClass === 'Mobile Money') groups[key].momo += saleProductRevenue(sale);
      else if (paymentClass === 'Bank') groups[key].bank += saleProductRevenue(sale);
      else if (paymentClass === 'Credit') groups[key].credit += saleProductRevenue(sale);
    });

    return Object.entries(groups).map(([date, vals]) => ({ date, ...vals }));
  };

  // -------------------------------------------------------------
  // 3. Product Quantity, Credit Issued, and Valuations
  // -------------------------------------------------------------
  // For each product, calculate total sold on credit
  const getProductStockValuationsList = () => {
    return products.map(prod => {
      // Find all sales for this product
      let qtySoldOnCredit = 0;
      filteredSales.forEach(s => {
        if (s.paymentMethod === 'Credit') {
          s.items.forEach(item => {
            if (item.productId === prod.id) {
              qtySoldOnCredit += item.qty;
            }
          });
        }
      });

      const totalQty = (prod.shopStockQty ?? 0) + (prod.storeStockQty ?? 0);
      const costOfShop = (prod.shopStockQty ?? 0) * prod.costPrice;
      const costOfStore = (prod.storeStockQty ?? 0) * prod.costPrice;
      const costOfCredit = qtySoldOnCredit * prod.costPrice;
      
      const sellOfShop = (prod.shopStockQty ?? 0) * prod.sellingPrice;
      const sellOfStore = (prod.storeStockQty ?? 0) * prod.sellingPrice;
      const sellOfCredit = qtySoldOnCredit * prod.sellingPrice;

      const unrealizedProfitShop = sellOfShop - costOfShop;
      const unrealizedProfitStore = sellOfStore - costOfStore;
      const creditRealizedProfit = sellOfCredit - costOfCredit;

      return {
        id: prod.id,
        product: prod,
        name: prod.name,
        sku: prod.sku,
        category: prod.category,
        shopQty: prod.shopStockQty ?? 0,
        storeQty: prod.storeStockQty ?? 0,
        creditIssuedQty: qtySoldOnCredit,
        sellingPrice: prod.sellingPrice,
        totalQty,
        
        // Valuations
        totalCogs: (totalQty + qtySoldOnCredit) * prod.costPrice,
        totalValue: (totalQty + qtySoldOnCredit) * prod.sellingPrice,
        unrealizedProfit: (totalQty + qtySoldOnCredit) * (prod.sellingPrice - prod.costPrice),

        cogsShop: costOfShop,
        cogsStore: costOfStore,
        cogsCredit: costOfCredit,

        sellShop: sellOfShop,
        sellStore: sellOfStore,
        sellCredit: sellOfCredit,

        profitShop: unrealizedProfitShop,
        profitStore: unrealizedProfitStore,
        profitCredit: creditRealizedProfit
      };
    });
  };

  const productValuationsRaw = getProductStockValuationsList();
  
  // Categorized metrics filter
  const productValuationsFiltered = productValuationsRaw.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = String(p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Valuation aggregators (Shop, Store, Credits)
  const currentValuationTotals = productValuationsRaw.reduce((acc, val) => {
    acc.shopCogs += val.cogsShop;
    acc.shopSell += val.sellShop;
    acc.shopProfit += val.profitShop;

    acc.storeCogs += val.cogsStore;
    acc.storeSell += val.sellStore;
    acc.storeProfit += val.profitStore;

    acc.creditCogs += val.cogsCredit;
    acc.creditSell += val.sellCredit;
    acc.creditProfit += val.profitCredit;

    acc.combinedCogs += (val.cogsShop + val.cogsStore + val.cogsCredit);
    acc.combinedSell += (val.sellShop + val.sellStore + val.sellCredit);
    acc.combinedProfit += (val.profitShop + val.profitStore + val.profitCredit);

    return acc;
  }, {
    shopCogs: 0, shopSell: 0, shopProfit: 0,
    storeCogs: 0, storeSell: 0, storeProfit: 0,
    creditCogs: 0, creditSell: 0, creditProfit: 0,
    combinedCogs: 0, combinedSell: 0, combinedProfit: 0
  });

  // Unique categories list
  const categoriesList = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // -------------------------------------------------------------
  // 4. Product Sales Velocity Rates (Most vs. Least Sold)
  // -------------------------------------------------------------
  const getProductVelocityRates = () => {
    // Aggregator counts
    const mapRates: Record<string, { id: string; name: string; sku: string; unitsSold: number; totalRevenue: number; totalCogs: number; profit: number }> = {};
    
    // Initializer
    products.forEach(p => {
      mapRates[p.id] = { id: p.id, name: p.name, sku: p.sku, unitsSold: 0, totalRevenue: 0, totalCogs: 0, profit: 0 };
    });

    filteredSales.forEach(s => {
      s.items.forEach(item => {
        if (!mapRates[item.productId]) {
          mapRates[item.productId] = { id: item.productId, name: item.productName, sku: 'N/A', unitsSold: 0, totalRevenue: 0, totalCogs: 0, profit: 0 };
        }
        const state = mapRates[item.productId];
        const prodMatch = products.find(pr => pr.id === item.productId);
        const costVal = item.costPriceAtSale ?? (prodMatch ? prodMatch.costPrice : (item.price * 0.6));
        
        state.unitsSold += item.qty;
        state.totalRevenue += (item.price * item.qty * (1 - item.discount / 100));
        state.totalCogs += (costVal * item.qty);
        state.profit = state.totalRevenue - state.totalCogs;
      });
    });

    return Object.values(mapRates).sort((a, b) => {
      return velocitySortOrder === 'desc' 
        ? b.unitsSold - a.unitsSold 
        : a.unitsSold - b.unitsSold;
    });
  };

  const productVelocityRates = getProductVelocityRates();

  // -------------------------------------------------------------
  // 5. User Reports (Client Spending Profiles & Staff Audits)
  // -------------------------------------------------------------
  // Clients breakdown (aggregated by customerName)
  const getClientSpendProfiles = () => {
    const clients: Record<string, { name: string; phone: string; salesCount: number; preferredItem: string; totalSpend: number; profitGenerated: number }> = {};

    filteredSales.forEach(s => {
      const name = s.customerName || 'Walk-In Customer';
      const phone = s.customerPhone || 'Walk-In';
      const key = name.toLowerCase().trim();

      if (!clients[key]) {
        clients[key] = {
          name,
          phone,
          salesCount: 0,
          preferredItem: '',
          totalSpend: 0,
          profitGenerated: 0
        };
      }

      const cl = clients[key];
      cl.salesCount += 1;
      cl.totalSpend += saleProductRevenue(s);
      
      // Calculate profit generated on client
      const cogs = s.items.reduce((acc, item) => {
        const prod = products.find(p => p.id === item.productId);
        const unitCost = item.costPriceAtSale ?? (prod ? prod.costPrice : (item.price * 0.6));
        return acc + (unitCost * item.qty);
      }, 0);
      
      cl.profitGenerated += (saleProductRevenue(s) - cogs);

      // Preferred item logic (Heuristic: item with highest total qty)
      const itemCounts: Record<string, number> = {};
      s.items.forEach(it => {
        itemCounts[it.productName] = (itemCounts[it.productName] || 0) + it.qty;
      });
      let bestItem = cl.preferredItem;
      let maxQty = 0;
      Object.entries(itemCounts).forEach(([name, count]) => {
        if (count > maxQty) {
          maxQty = count;
          bestItem = name;
        }
      });
      cl.preferredItem = bestItem || s.items[0]?.productName || 'Multi-Item';
    });

    return Object.values(clients).sort((a, b) => b.totalSpend - a.totalSpend);
  };

  const clientProfiles = getClientSpendProfiles();

  // Staff Audits
  const getStaffAuditsList = () => {
    const staffRecs: Record<string, { cashierName: string; totalSalesProcessed: number; salesSumAmt: number; expensesLoggedCount: number; expensesChargedAmt: number; profitContribution: number }> = {};

    // Standardize names
    filteredSales.forEach(s => {
      const name = s.cashierName || 'System Till';
      const key = name.toLowerCase().trim();
      if (!staffRecs[key]) {
        staffRecs[key] = { cashierName: name, totalSalesProcessed: 0, salesSumAmt: 0, expensesLoggedCount: 0, expensesChargedAmt: 0, profitContribution: 0 };
      }
      staffRecs[key].totalSalesProcessed += 1;
      staffRecs[key].salesSumAmt += saleProductRevenue(s);

      // Extract sales margin contribution
      const cogs = s.items.reduce((acc, item) => {
        const prod = products.find(p => p.id === item.productId);
        const unitCost = item.costPriceAtSale ?? (prod ? prod.costPrice : (item.price * 0.6));
        return acc + (unitCost * item.qty);
      }, 0);
      staffRecs[key].profitContribution += (saleProductRevenue(s) - cogs);
    });

    filteredExpenses.forEach(e => {
      const name = e.staffName || 'System Till';
      const key = name.toLowerCase().trim();
      if (!staffRecs[key]) {
        staffRecs[key] = { cashierName: name, totalSalesProcessed: 0, salesSumAmt: 0, expensesLoggedCount: 0, expensesChargedAmt: 0, profitContribution: 0 };
      }
      staffRecs[key].expensesLoggedCount += 1;
      staffRecs[key].expensesChargedAmt += e.amount;
      staffRecs[key].profitContribution -= e.amount; // debit deduction contribution
    });

    return Object.values(staffRecs);
  };

  const staffAudits = getStaffAuditsList();

  // Suppliers performance metrics analysis
  const getSupplierReportProfiles = () => {
    const defaultList = suppliers.map(s => ({
      id: s.id,
      name: s.name,
      contact: s.contactPerson || 'Logistics Coordinator',
      phone: s.phone || 'N/A',
      email: s.email || 'N/A',
      ordersCount: 0,
      totalProcured: 0,
      categoryCovered: s.categories?.[0] || 'Unassigned'
    }));

    const result: Record<string, typeof defaultList[0]> = {};
    defaultList.forEach(s => {
      result[s.id] = s;
    });

    if (purchases && purchases.length > 0) {
      purchases.forEach(p => {
        const sId = p.supplierId;
        if (sId && result[sId]) {
          result[sId].ordersCount += 1;
          result[sId].totalProcured += p.totalAmount || 0;
        } else if (p.supplierName) {
          const normalizedId = p.supplierId || `dyn-${p.supplierName.toLowerCase().replace(/\s+/g, '-')}`;
          if (!result[normalizedId]) {
            result[normalizedId] = {
              id: normalizedId,
              name: p.supplierName,
              contact: 'Logistics Liaison',
              phone: 'N/A',
              email: 'N/A',
              ordersCount: 0,
              totalProcured: 0,
              categoryCovered: 'Various Items'
            };
          }
          result[normalizedId].ordersCount += 1;
          result[normalizedId].totalProcured += p.totalAmount || 0;
        }
      });
    }

    return Object.values(result).sort((a, b) => b.totalProcured - a.totalProcured);
  };

  const supplierProfiles = getSupplierReportProfiles();

  const getTabMeta = (tabId: string) => {
    switch (tabId) {
      case 'p&l':
        return {
          label: 'Profit & Loss',
          desc: 'Branches consolidated balance statement & margin logs.',
          icon: BarChart3,
          colorClass: 'bg-purple-100 text-purple-650 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50',
          color: 'purple'
        };
      case 'sales-report':
        return {
          label: 'Sales Report',
          desc: 'Historical transactional journals & checkout audits.',
          icon: TrendingUp,
          colorClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50',
          color: 'emerald'
        };
      case 'dual-channel':
        return {
          label: 'Dual Channel Report',
          desc: 'Wholesale vs retail margin logs and split channel analysis.',
          icon: ShieldAlert,
          colorClass: 'bg-indigo-150 text-indigo-650 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/50',
          color: 'indigo'
        };
      case 'inventory':
        return {
          label: 'Inventory Report',
          desc: 'Storehouse vs active sales floor valuation metrics.',
          icon: Package,
          colorClass: 'bg-blue-100 text-blue-650 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50',
          color: 'blue'
        };
      case 'payments':
        return {
          label: 'Payments Report',
          desc: 'Detailed breakdown of cash, cards, and mobile money splits.',
          icon: DollarSign,
          colorClass: 'bg-amber-100 text-amber-650 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50',
          color: 'amber'
        };
      case 'product-monitoring':
        return {
          label: 'Product Profitability',
          desc: 'Top moving inventory performance & high contribution lines.',
          icon: Tag,
          colorClass: 'bg-teal-105 text-teal-650 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/50',
          color: 'teal'
        };
      case 'users':
        return {
          label: 'Partners & Customers',
          desc: 'Demographic spent ledgers & custom client rankings.',
          icon: Users,
          colorClass: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-450 border border-rose-200/50',
          color: 'rose'
        };
      case 'expenses':
        return {
          label: 'Expense Report',
          desc: 'Audited log of operating cash outflows & booked receipts.',
          icon: MinusCircle,
          colorClass: 'bg-red-105 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50',
          color: 'red'
        };
      case 'velocity':
        return {
          label: 'Sales Velocity',
          desc: 'Daily unit sales speed and run-rate forecast metrics.',
          icon: ShoppingBag,
          colorClass: 'bg-cyan-100 text-cyan-650 dark:bg-cyan-950/40 dark:text-cyan-400 border border-cyan-200/50',
          color: 'cyan'
        };
      case 'deliveries':
        return {
          label: 'Deliveries Report',
          desc: 'Logistics fulfillment times & delivery rider receipts.',
          icon: Truck,
          colorClass: 'bg-orange-100 text-orange-650 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50',
          color: 'orange'
        };
      default:
        return {
          label: 'System Report',
          desc: 'General workspace analytical records and logs.',
          icon: FileText,
          colorClass: 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400 border border-slate-200',
          color: 'slate'
        };
    }
  };

  // Helper date-preset triggers for the mobile quick action pills
  const getTodayRange = () => new Date().toISOString().split('T')[0];
  const getYesterdayRange = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };
  const getLast7DaysRange = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  };
  const checkActivePreset = () => {
    const today = getTodayRange();
    const yesterday = getYesterdayRange();
    const last7 = getLast7DaysRange();
    if (startDateStr === today && endDateStr === today) return 'today';
    if (startDateStr === yesterday && endDateStr === yesterday) return 'yesterday';
    if (startDateStr === last7 && endDateStr === today) return 'last7';
    if (startDateStr === '2020-01-01' && endDateStr === today) return 'all';
    return 'custom';
  };
  const mobileReportKpiCardClass = "native-report-kpi-card bg-white dark:bg-slate-900 px-4 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-2 text-left min-w-0 active:scale-[0.97] transition-transform";
  const mobileReportToneKpiCardClass = "native-report-kpi-card px-4 py-4 rounded-2xl border shadow-sm flex flex-col gap-2 text-left min-w-0 active:scale-[0.97] transition-transform";

  return (
    <div className="space-y-8 animate-fade-in pb-[calc(80px+env(safe-area-inset-bottom))]" id="reports-view-root">
      
      {/* DESKTOP-ONLY INTERFACE CONTAINER */}
      <div className="hidden xl:block space-y-8">
      
      {/* ------------------------------------------------------------- */}
      {/* DESKTOP-ONLY HEADER CONTROLS SECTION */}
      {/* ------------------------------------------------------------- */}
      {/* ── DESKTOP HEADER — redesigned ── */}
      <div className="hidden xl:flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Analytics & Accounts</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {[
            {l:'Today', f:()=>{const t=getTodayRange();setStartDateStr(t);setEndDateStr(t);}},
            {l:'7 days', f:()=>{setStartDateStr(getLast7DaysRange());setEndDateStr(getTodayRange());}},
            {l:'30 days', f:()=>{const d=new Date();d.setDate(d.getDate()-29);setStartDateStr(d.toISOString().split('T')[0]);setEndDateStr(getTodayRange());}},
            {l:'All', f:()=>{setStartDateStr('2020-01-01');setEndDateStr(getTodayRange());}},
          ].map(p=>(
            <button key={p.l} type="button" onClick={p.f}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">{p.l}</button>
          ))}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input type="date" value={startDateStr} onChange={e=>setStartDateStr(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-semibold outline-none text-[11px] cursor-pointer w-24" />
            <span className="text-slate-300 text-xs">→</span>
            <input type="date" value={endDateStr} onChange={e=>setEndDateStr(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-semibold outline-none text-[11px] cursor-pointer w-24" />
          </div>
          <button onClick={printActiveReportPdf} type="button"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors">
            <Printer className="w-3.5 h-3.5" /><span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* ── MOBILE HEADER — premium native hero ── */}
      <div className="xl:hidden space-y-3">
        {/* Dark hero banner */}
        <div className="rounded-2xl overflow-hidden relative" style={{background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',boxShadow:'0 4px 20px rgba(15,23,42,0.2)'}}>
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-5" style={{background:'white'}}/>
          <div className="px-4 pt-4 pb-4 relative">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Reports & Analytics</p>
                {(()=>{ const m=getTabMeta(reportTab); const Icon=m.icon; return(
                  <h1 className="text-white font-black text-[20px] leading-tight mt-0.5">{m.label}</h1>
                );})()}
              </div>
              <div className="flex gap-1.5">
                <button onClick={printActiveReportPdf} type="button"
                  className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'rgba(255,255,255,0.1)'}}>
                  <Printer className="w-4 h-4 text-white"/>
                </button>
              </div>
            </div>
            {/* Date quick chips */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                {l:'Today',   f:()=>{const t=getTodayRange();setStartDateStr(t);setEndDateStr(t);}},
                {l:'7 Days',  f:()=>{setStartDateStr(getLast7DaysRange());setEndDateStr(getTodayRange());}},
                {l:'30 Days', f:()=>{const d=new Date();d.setDate(d.getDate()-29);setStartDateStr(d.toISOString().split('T')[0]);setEndDateStr(getTodayRange());}},
                {l:'All',     f:()=>{setStartDateStr('2020-01-01');setEndDateStr(getTodayRange());}},
              ].map(p=>(
                <button key={p.l} type="button" onClick={p.f}
                  className="px-2 py-1.5 rounded-xl text-[10px] font-bold text-center" style={{background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.75)'}}>{p.l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI mini cards 2×2 — clean elegant cards */}
        <div className="mobile-tablet-kpi-grid gap-2.5" style={{ ['--desktop-kpi-columns' as any]: 'repeat(5, minmax(0, 1fr))' }}>
          {[
            {label:'Total Sales', value:`${currency}${Math.round(totalGrossSales).toLocaleString()}`, sub:`${filteredSales.length} receipts`, color:'#059669', bg:'#f0fdf4', icon:<TrendingUp className="w-4 h-4"/>},
            {label:'Revenue',     value:`${currency}${Math.round(totalSalesRevenue).toLocaleString()}`, sub:'Net revenue', color:'#2563eb', bg:'#eff6ff', icon:<DollarSign className="w-4 h-4"/>},
            {label:'COGS',        value:`${currency}${Math.round(totalCOGS).toLocaleString()}`, sub:`Margin ${totalSalesRevenue>0?Math.round(((totalSalesRevenue-totalCOGS)/totalSalesRevenue)*100):0}%`, color:'#d97706', bg:'#fffbeb', icon:<Package className="w-4 h-4"/>},
            {label:'Expenses',    value:`${currency}${Math.round(totalExpensesCharged).toLocaleString()}`, sub:'Operating', color:'#dc2626', bg:'#fff5f5', icon:<Receipt className="w-4 h-4"/>},
          ].map((kpi,i)=>(
            <div key={i} className="bg-white rounded-2xl p-3.5 min-w-0" style={{border:'1px solid #e2e8f0',boxShadow:'0 8px 24px rgba(15,23,42,0.06)'}}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:kpi.bg,color:kpi.color}}>{kpi.icon}</div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">{kpi.label}</p>
              </div>
              <p className="text-[18px] font-black text-slate-900 leading-tight break-words">{kpi.value}</p>
              <p className="text-[9px] text-slate-400 mt-1.5">{kpi.sub}</p>
            </div>
          ))}
          {/* Net profit stays inside the two-column KPI rhythm on mobile/tablet. */}
          <div className="bg-white rounded-2xl p-3.5 min-w-0" style={{border:'1px solid #e2e8f0',boxShadow:`0 8px 24px ${netProfit>=0?'rgba(5,150,105,0.08)':'rgba(220,38,38,0.08)'}`}}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:netProfit>=0?'#f0fdf4':'#fff5f5',color:netProfit>=0?'#059669':'#dc2626'}}>
                <BarChart3 className="w-4 h-4"/>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Net Profit</p>
            </div>
            <p className={`text-[18px] font-black leading-tight break-words ${netProfit>=0?'text-emerald-700':'text-rose-700'}`}>
              {netProfit<0?'-':''}{currency}{Math.abs(Math.round(netProfit)).toLocaleString()}
            </p>
            <p className={`text-[9px] mt-1.5 ${netProfit>=0?'text-emerald-600':'text-rose-600'}`}>{netProfit>=0?'Surplus':'Deficit'}</p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ── DESKTOP KPI CARDS — clean premium without accent bar ── */}
      <div className="hidden xl:grid grid-cols-4 gap-3">
        {[
          {label:'Total Sales', value:`${currency}${Math.round(totalSalesRevenue).toLocaleString()}`, sub:`${filteredSales.length} sales`, icon:<TrendingUp className="w-4 h-4"/>, color:'#059669', iconBg:'#f0fdf4'},
          {label:'Cost of Goods', value:`${currency}${Math.round(totalCOGS).toLocaleString()}`, sub:`Margin ${totalSalesRevenue>0?Math.round(((totalSalesRevenue-totalCOGS)/totalSalesRevenue)*100):0}%`, icon:<Package className="w-4 h-4"/>, color:'#0891b2', iconBg:'#f0f9ff'},
          {label:'Expenses', value:`${currency}${Math.round(totalExpensesCharged).toLocaleString()}`, sub:<button onClick={()=>setIsExpenseModalOpen(true)} className="text-rose-500 hover:underline cursor-pointer">+ Book Expense</button>, icon:<Receipt className="w-4 h-4"/>, color:'#dc2626', iconBg:'#fff5f5'},
          {label:'Net Profit', value:`${netProfit<0?'-':''}${currency}${Math.abs(Math.round(netProfit)).toLocaleString()}`, sub:netProfit>=0?'↑ Surplus':'↓ Deficit', icon:<DollarSign className="w-4 h-4"/>, color:netProfit>=0?'#059669':'#dc2626', iconBg:netProfit>=0?'#f0fdf4':'#fff5f5'},
        ].map((kpi,i)=>(
          <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-3.5" style={{border:'1px solid #e2e8f0',boxShadow:'0 1px 6px rgba(0,0,0,0.04)'}}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:kpi.iconBg,color:kpi.color}}>
              {kpi.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{kpi.label}</p>
              <p className="text-[16px] font-black leading-tight truncate mt-0.5" style={{color:kpi.color}}>{kpi.value}</p>
              <p className="text-[9px] text-slate-400 mt-0.5 truncate">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ============================================================= */}
      {/* MOBILE KEY METRICS GRID (FIX 2) (2 columns x 2 rows grid) */}
      {/* ============================================================= */}
      <div className="hidden" id="mobile-metrics-cards-grid-old">
        {/* Total Sales */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 border-l-4 border-l-emerald-500 flex flex-col justify-between min-h-[92px]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Total Sales</span>
          </div>
          <div className="mt-1">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 font-sans">
              {currency}{Math.round(totalGrossSales).toLocaleString()}
            </h4>
            <p className="text-[9px] text-slate-400 font-mono leading-none mt-0.5">{filteredSales.length} receipts</p>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 border-l-4 border-l-blue-500 flex flex-col justify-between min-h-[92px]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Revenue</span>
          </div>
          <div className="mt-1">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 font-sans">
              {currency}{Math.round(totalSalesRevenue).toLocaleString()}
            </h4>
            <p className="text-[9px] text-slate-400 font-mono leading-none mt-0.5">Net receipts</p>
          </div>
        </div>

        {/* COGS */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 border-l-4 border-l-amber-500 flex flex-col justify-between min-h-[92px]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-lg shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">COGS</span>
          </div>
          <div className="mt-1">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 font-sans">
              {currency}{Math.round(totalCOGS).toLocaleString()}
            </h4>
            <p className="text-[9px] text-slate-400 font-mono leading-none mt-0.5">
              Margin: {totalSalesRevenue > 0 ? Math.round(((totalSalesRevenue - totalCOGS)/totalSalesRevenue) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 border-l-4 border-l-rose-500 flex flex-col justify-between min-h-[92px]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded-lg shrink-0">
              <MinusCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Expenses</span>
          </div>
          <div className="mt-1">
            <h4 className="text-sm font-black text-rose-600 dark:text-rose-450 font-sans">
              {currency}{Math.round(totalExpensesCharged).toLocaleString()}
            </h4>
            <button 
              type="button"
              onClick={() => setIsExpenseModalOpen(true)}
              className="text-[9px] text-rose-500 font-bold hover:underline cursor-pointer font-sans transition-all block text-left shrink-0 mt-0.5"
            >
              + Book Expense
            </button>
          </div>
        </div>

        {/* Net Profit (Centered as 5th item) */}
        <div className="col-span-2 bg-white dark:bg-slate-900 p-3.5 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 border-l-4 border-l-purple-500 flex flex-col items-center justify-center text-center space-y-2 min-h-[100px]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-lg shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Net Profit</span>
          </div>
          <div className="mt-1">
            <h4 className={`text-base font-black font-sans ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-450' : 'text-rose-600 dark:text-rose-450'}`}>
              {netProfit < 0 ? '-' : ''}{currency}{Math.abs(Math.round(netProfit)).toLocaleString()}
            </h4>
            <div className={`inline-flex items-center text-[9px] font-semibold uppercase mt-1 px-2.5 py-0.5 rounded-full ${netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'}`}>
              {netProfit >= 0 ? 'Surplus' : 'Deficit'}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ── DESKTOP TAB NAV — pill style ── */}
      {(!defaultTab || defaultTab !== 'expenses') && (
        <div className="hidden xl:flex bg-white border border-slate-200 p-1 rounded-2xl gap-1 flex-wrap shadow-xs">
          {[
            {id:'p&l',              label:'Profit & Loss',  icon:FileText,    color:'#059669', reqPerm:'reportsProfitCogs'},
            {id:'sales-report',     label:'Sales',          icon:TrendingUp,  color:'#2563eb', reqPerm:'reportsSalesExpenses'},
            {id:'payments',         label:'Payments',       icon:DollarSign,  color:'#d97706', reqPerm:'reportsSalesExpenses'},
            {id:'inventory',        label:'Inventory',      icon:Package,     color:'#0891b2', reqPerm:'reportsSalesExpenses'},
            {id:'product-monitoring',label:'Products',      icon:BarChart3,   color:'#7c3aed', reqPerm:'reportsSalesExpenses'},
            {id:'dual-channel',     label:'Dual Channel',   icon:ShieldAlert, color:'#4f46e5', reqPerm:'reportsSalesExpenses'},
            {id:'bulk-products',    label:'Bulk',           icon:Scale,       color:'#0369a1', reqPerm:'reportsSalesExpenses'},
            {id:'stock-adjustment', label:'Stock Adj.',     icon:ArrowUpDown, color:'#7c3aed', reqPerm:'reportsSalesExpenses'},
            {id:'users',            label:'Customers',      icon:Users,       color:'#dc2626', reqPerm:'reportsSalesExpenses'},
          ].filter(tab=>{
            if(!rolePermissions)return true;
            const p=(rolePermissions as any)[tab.reqPerm];
            return p===undefined||p.read;
          }).map(tab=>{
            const active=reportTab===tab.id;
            const Icon=tab.icon;
            return(
              <button key={tab.id} type="button" onClick={()=>setReportTab(tab.id as any)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                style={{background:active?tab.color:'transparent',color:active?'#fff':'#64748b',boxShadow:active?`0 2px 8px ${tab.color}30`:'none'}}>
                <Icon className="w-3.5 h-3.5 shrink-0"/>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================= */}
      {/* ── MOBILE REPORT TILES — 4-col icon grid ── */}
      {(!defaultTab || defaultTab !== 'expenses') && (
        <div className="xl:hidden grid grid-cols-4 gap-2 pb-1">
          {[
            {id:'p&l',               label:'P&L',       icon:FileText,    color:'#059669', bg:'#f0fdf4'},
            {id:'sales-report',      label:'Sales',     icon:TrendingUp,  color:'#2563eb', bg:'#eff6ff'},
            {id:'payments',          label:'Payments',  icon:DollarSign,  color:'#d97706', bg:'#fffbeb'},
            {id:'inventory',         label:'Inventory', icon:Package,     color:'#0891b2', bg:'#ecfeff'},
            {id:'product-monitoring',label:'Products',  icon:BarChart3,   color:'#7c3aed', bg:'#f5f3ff'},
            {id:'dual-channel',      label:'Channels',  icon:ShieldAlert, color:'#4f46e5', bg:'#eef2ff'},
            {id:'velocity',          label:'Velocity',  icon:ShoppingBag, color:'#0891b2', bg:'#ecfeff'},
            {id:'users',             label:'Customers', icon:Users,       color:'#dc2626', bg:'#fff5f5'},
          ].filter(tab=>{
            if(!rolePermissions)return true;
            const p=(rolePermissions as any)[tab.id==='p&l'?'reportsProfitCogs':'reportsSalesExpenses'];
            return p===undefined||p.read;
          }).map(tab=>{
            const active=reportTab===tab.id;
            const Icon=tab.icon;
            return(
              <button key={tab.id} type="button" onClick={()=>setReportTab(tab.id as any)}
                className="flex flex-col items-center justify-center py-3 rounded-2xl gap-1.5 relative active:scale-95"
                style={{background:active?tab.color:tab.bg,boxShadow:active?`0 3px 12px ${tab.color}35`:'none'}}>
                {active&&<div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white/70"/>}
                <Icon className="w-5 h-5" style={{color:active?'#fff':tab.color}}/>
                <span className="text-[9px] font-bold leading-tight text-center" style={{color:active?'rgba(255,255,255,0.9)':'#475569'}}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {/* OLD MOBILE DROPDOWN — hidden */}
      {false && <>
          <button
            type="button"
            onClick={() => setMobileSelectorOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-sm text-slate-800 dark:text-slate-100 cursor-pointer min-h-[44px] shadow-xs hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center space-x-2.5">
              {(() => {
                const meta = getTabMeta(reportTab);
                const Icon = meta.icon;
                return (
                  <>
                    <div className={`p-1.5 rounded-lg ${meta.colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{meta.label}</span>
                  </>
                );
              })()}
            </div>
            <ChevronDown className="w-[18px] h-[18px] text-slate-400" />
          </button>

          {/* DROP DOWN BOTTOM SHEET LIST (When Opened) */}
          <div 
            className={`fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${
              mobileSelectorOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setMobileSelectorOpen(false)}
          >
            <div 
              className={`absolute bottom-0 left-0 right-0 max-h-[calc(80dvh-56px-env(safe-area-inset-bottom))] bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-850 flex flex-col select-none transition-transform duration-300 transform ${
                mobileSelectorOpen ? 'translate-y-0 shadow-[-5px_-5px_30px_rgba(0,0,0,0.15)]' : 'translate-y-full'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-850 shrink-0">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">Select Report Type</h3>
                <button 
                  onClick={() => setMobileSelectorOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 font-bold hover:text-slate-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* List options container */}
              <div className="flex-grow overflow-y-auto px-4 py-3 pb-12 space-y-2">
                {[
                  { id: 'p&l', label: 'Profit & Loss', icon: BarChart3, reqPerm: 'reportsProfitCogs' },
                  { id: 'sales-report', label: 'Sales Report', icon: TrendingUp, reqPerm: 'reportsSalesExpenses' },
                  { id: 'dual-channel', label: 'Dual Channel Report', icon: ShieldAlert, reqPerm: 'reportsSalesExpenses' },
                  { id: 'inventory', label: 'Inventory Report', icon: Package, reqPerm: 'reportsSalesExpenses' },
                  { id: 'payments', label: 'Payments Report', icon: DollarSign, reqPerm: 'reportsSalesExpenses' },
                  { id: 'product-monitoring', label: 'Product Profitability', icon: Tag, reqPerm: 'reportsSalesExpenses' },
                { id: 'bulk-products', label: 'Bulk Products Report', icon: Scale, desc: 'Performance and stock conversion matrices for bulk purchasing logic.', colorClass: 'bg-blue-50 text-blue-605 border border-blue-100', reqPerm: 'reportsSalesExpenses' },
                  { id: 'bulk-products', label: 'Bulk Products Report', icon: Scale, reqPerm: 'reportsSalesExpenses' },
                  { id: 'stock-adjustment', label: 'Stock Adjustment Report', icon: ArrowUpDown, desc: 'View all manual stock additions and deductions by date range.', colorClass: 'bg-purple-50 text-purple-600 border border-purple-100', reqPerm: 'reportsSalesExpenses' },
                  { id: 'stock-adjustment', label: 'Stock Adjustment Report', icon: ArrowUpDown, reqPerm: 'reportsSalesExpenses' },
                  { id: 'users', label: 'Partners & Customers', icon: Users, reqPerm: 'reportsSalesExpenses' }
                ].filter(tab => {
                  if (!rolePermissions) return true;
                  const permGroup = (rolePermissions as any)[tab.reqPerm];
                  return permGroup === undefined || permGroup.read;
                }).map((tab) => {
                  const meta = getTabMeta(tab.id);
                  const IconComp = meta.icon;
                  const isActive = reportTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setReportTab(tab.id as any);
                        setMobileSelectorOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer min-h-[56px] text-left ${
                        isActive 
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs font-bold' 
                          : 'bg-white hover:bg-slate-50 dark:bg-slate-905 dark:hover:bg-slate-850 border-slate-100 dark:border-slate-800/80 text-slate-705 dark:text-slate-305'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          isActive 
                            ? 'bg-white/20 text-white border border-white/10' 
                            : meta.colorClass
                        }`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <span className={`text-sm font-black tracking-tight block ${isActive ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                            {meta.label}
                          </span>
                          <span className={`text-[10px] block leading-tight max-w-[210px] ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {meta.desc}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
        </div>
      </>}{/* end hidden old mobile dropdown */}

      {/* ------------------------------------------------------------- */}
      {/* MAIN DATA VIEW AREA */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-6">
        
        {/* TAB 1: P&L COMMERCIAL SUMMARY */}
        {reportTab === 'p&l' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Commercial Profit & Loss Account</h3>
              <p className="text-xs text-slate-500 mt-1">P&L for selected range.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Financial calculations lists */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Statement Items</h4>
                
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-600 font-medium">total sales</span>
                    <span className="font-mono font-bold text-slate-800">{currency}{Math.round(totalSalesRevenue).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-600 font-medium">cost of goods sold</span>
                    <span className="font-mono font-bold text-slate-800">({currency}{Math.round(totalCOGS).toLocaleString()})</span>
                  </div>

                  <div className="flex justify-between items-center text-xs p-3.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-100">
                    <span className="font-bold">Gross profit</span>
                    <span className="font-mono font-black">{currency}{Math.round(grossProfit).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-600 font-medium">total expenses</span>
                    <span className="font-mono font-bold text-rose-600">({currency}{Math.round(totalExpensesCharged).toLocaleString()})</span>
                  </div>

                  <div className={`flex justify-between items-center text-sm p-4 rounded-xl border font-bold ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-900 border-emerald-200' : 'bg-rose-500/10 text-rose-900 border-rose-200'}`}>
                    <span>net profit</span>
                    <span className="font-mono font-black">{netProfit < 0 ? '-' : ''}{currency}{Math.abs(Math.round(netProfit)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Expense Category Allocations Graph List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Operations Charge Metrics</h4>
                <div className="space-y-3">
                  {expensesBreakdown.map(cat => {
                    const pct = totalExpensesCharged > 0 ? (cat.value / totalExpensesCharged) * 100 : 0;
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 font-medium">{cat.name}</span>
                          <span className="font-mono font-bold text-slate-800">
                            {currency}{cat.value.toLocaleString()} ({Math.round(pct)}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-rose-500 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {totalExpensesCharged === 0 && (
                    <div className="text-center py-10 border border-dashed border-slate-200 rounded-3xl text-xs text-slate-500">
                      No expense charges logged within this timescale query.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Chronological Performance Comparison Chart */}
            <div className="border border-slate-200 rounded-3xl p-6 bg-slate-50/50 space-y-4">
              <div>
                <span className="text-[10px] font-mono font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/10">
                  COMPARATIVE PERFORMANCE MATRIX
                </span>
                <h3 className="text-sm font-bold text-slate-800 mt-2 font-sans">
                  Chronological Financial Ledger Variance Graph
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Interactive real-time comparison of sales count volume (secondary axis), sales revenue, COGS, expenses, and net profit trends.
                </p>
              </div>

              <div className="w-full h-[320px] relative mt-2 bg-white rounded-2xl border border-slate-200/80 p-4">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 900, height: 320 }}>
                  <LineChart data={pAndLGraphData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="label" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      dy={5}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                      width={35}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="#a855f7" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(v) => `${v} tx`}
                      width={30}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        borderColor: '#334155', 
                        fontSize: '11px',
                        borderRadius: '12px',
                        color: '#fff',
                        padding: '8px 12px'
                      }} 
                      formatter={(value: any, name: string) => {
                        if (name === 'Sales Ticket Volume') return [`${value} sales`, name];
                        return [`${currency} ${Number(value).toLocaleString()}`, name];
                      }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="salesRevenue" 
                      name="Sales (Revenue)" 
                      stroke="#10b981" 
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="cogs" 
                      name="Cost of Goods (COGS)" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 1 }}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="expenses" 
                      name="Expenses" 
                      stroke="#f43f5e" 
                      strokeWidth={2}
                      dot={{ r: 1 }}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="profit" 
                      name="Profit" 
                      stroke="#06b6d4" 
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="salesCount" 
                      name="Sales Ticket Volume" 
                      stroke="#a855f7" 
                      strokeWidth={1.5}
                      dot={{ r: 1 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* TAB 1.5: COMPREHENSIVE SALES REPORT */}
        {reportTab === 'sales-report' && (() => {
          const {
            totalOrders: totalSalesOrdersCount,
            totalRevenue: totalSalesRevenueVal,
            totalTax: totalRecordsTax,
            avgTicket: avgTicketSize,
            paidCount: paidSalesCount,
            paidRevenue: paidSalesRevenueVal,
            unpaidCount: unpaidSalesCount,
            unpaidRevenue: unpaidSalesRevenueVal,
            totalProfit: totalSalesProfitVal
          } = salesReportMetrics;
          
          return (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
              
              {/* Heading Tab Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">
                    {activeTenant.businessType === 'pharmacy' ? 'Clinical Dispensing & Sales Journal' : 'General Ledger Sales Report'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Audited list of transactions within selected date range: <span className="font-semibold text-slate-700 font-mono">{new Date(startDateStr).toLocaleDateString()} — {new Date(endDateStr).toLocaleDateString()}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const msg = `Excel CSV Compiled: Successfully exported ${recordsFilteredSales.length} records totaling ${currency}${Math.round(totalSalesRevenueVal).toLocaleString()} for ${activeTenant.name}. Check your local system downloads folder.`;
                      alert(msg);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-220 rounded-xl text-xs uppercase font-mono transition-all flex items-center space-x-1 active:scale-95 cursor-pointer"
                  >
                    <span>EXPORT SPREADSHEET</span>
                  </button>
                </div>
              </div>

              {/* Sub controls - Filter and Search */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {/* Search Term */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customer, staff code, item..."
                    value={salesSearch}
                    onChange={(e) => setSalesSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                  />
                </div>

                {/* Payment mode filter */}
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider shrink-0">Payment:</span>
                  <select
                    value={salesPaymentFilter}
                    onChange={(e) => setSalesPaymentFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold font-sans cursor-pointer focus:outline-none"
                  >
                    <option value="All">All Payment Modes</option>
                    <option value="Cash">Cash Payments</option>
                    <option value="Card">Card & Online (Card/Paystack)</option>
                    <option value="Mobile Money">Mobile Wallet Transfer</option>
                    <option value="Bank">Bank Deposit</option>
                    <option value="Credit">Deferred Credit Balances</option>
                  </select>
                </div>

                {/* Display matches quantity */}
                <div className="flex items-center justify-end font-mono text-[10.5px] font-black text-slate-500 uppercase">
                  <span>Showing {recordsFilteredSales.length} of {filteredSales.length} transactions</span>
                </div>
              </div>

              {/* Filtering summary stats metrics grid */}
              <div className="mobile-tablet-kpi-grid gap-3 lg:gap-4" style={{ ['--desktop-kpi-columns' as any]: 'repeat(5, minmax(0, 1fr))' }}>
                {/* Total Sales Orders */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex flex-col justify-between min-h-[108px] text-left min-w-0">
                  <div className="flex items-start space-x-2">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500 font-medium tracking-tight">Total Sales Orders</p>
                      <h4 className="text-lg font-black text-slate-800 mt-1">{totalSalesOrdersCount} Tickets</h4>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full" 
                      style={{ width: `${filteredSales.length > 0 ? (recordsFilteredSales.length / filteredSales.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
 
                {/* Money Earned */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex flex-col justify-between min-h-[108px] text-left min-w-0">
                  <div className="flex items-start space-x-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500 font-medium tracking-tight">Money Earned</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">{currency}{Math.round(totalSalesRevenueVal).toLocaleString()}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-sans mt-3 border-t border-slate-100 pt-2 leading-tight">VAT: {currency}{Math.round(totalRecordsTax).toLocaleString()} | Avg: {currency}{Math.round(avgTicketSize).toLocaleString()}</p>
                </div>

                {/* Paid Transactions Info */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex flex-col justify-between min-h-[108px] text-left min-w-0">
                  <div className="flex items-start space-x-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500 font-medium tracking-tight">Paid orders</p>
                      <h4 className="text-lg font-black text-emerald-800 mt-1">{currency}{Math.round(paidSalesRevenueVal).toLocaleString()}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-sans mt-3 border-t border-slate-100 pt-2 leading-tight">{paidSalesCount} orders paid & cleared</p>
                </div>

                {/* Unpaid / Credit Info */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex flex-col justify-between min-h-[108px] text-left min-w-0">
                  <div className="flex items-start space-x-2">
                    <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500 font-medium tracking-tight">Unpaid orders</p>
                      <h4 className="text-lg font-bold text-amber-700 mt-1">{currency}{Math.round(unpaidSalesRevenueVal).toLocaleString()}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-sans mt-3 border-t border-slate-100 pt-2 leading-tight">{unpaidSalesCount} on-credit outstanding</p>
                </div>

                {/* Profit Generated */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex flex-col justify-between min-h-[108px] text-left min-w-0">
                  <div className="flex items-start space-x-2">
                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500 font-medium tracking-tight">Profit generated</p>
                      <h4 className="text-lg font-black text-indigo-700 mt-1">{currency}{Math.round(totalSalesProfitVal).toLocaleString()}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-sans mt-3 border-t border-slate-100 pt-2 leading-tight">Margin: {totalSalesRevenueVal > 0 ? Math.round((totalSalesProfitVal / totalSalesRevenueVal) * 100) : 0}% of sales</p>
                </div>
              </div>

              {/* Table of Transactions */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Reference ID</th>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Customer / Guest</th>
                      <th className="p-4">Items Breakdown</th>
                      <th className="p-4">Staff Member</th>
                      <th className="p-4 text-center">Payment Mode</th>
                      <th className="p-4 text-right">Tax Paid</th>
                      <th className="p-4 text-right font-black">Gross Total</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {recordsFilteredSales.map(sale => {
                      // Adapt customer based on business niche
                      let customerLabel = 'Walk-In Customer';
                      if (sale.customerName) {
                        customerLabel = sale.customerName;
                      } else {
                        if (activeTenant.businessType === 'pharmacy') {
                          customerLabel = 'Walk-In Patient';
                        } else if (activeTenant.businessType === 'restaurant') {
                          customerLabel = 'Walk-In Diner';
                        } else if (activeTenant.businessType === 'hotel') {
                          customerLabel = 'Walk-In Guest';
                        }
                      }

                      // Details list
                      const totalItemsCount = sale.items.reduce((acc, current) => acc + current.qty, 0);

                      return (
                        <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-mono font-extrabold text-slate-800 leading-none">
                            <span className="text-[10.5px] text-indigo-700">{sale.id}</span>
                          </td>
                          <td className="p-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {new Date(sale.timestamp).toLocaleString()}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="font-bold text-slate-800">{customerLabel}</div>
                            {sale.customerPhone && (
                              <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">{sale.customerPhone}</div>
                            )}
                          </td>
                          <td className="p-4 max-w-[240px]">
                            <p className="font-medium text-slate-700 truncate" title={sale.items.map(it => `${it.qty}x ${it.productName}`).join(', ')}>
                              {sale.items.map(it => `${it.qty}x ${it.productName}`).join(', ')}
                            </p>
                            <span className="text-[9px] font-mono text-slate-400 uppercase mt-0.5 block">{totalItemsCount} total unit{totalItemsCount !== 1 ? 's' : ''} sold</span>
                          </td>
                          <td className="p-4 whitespace-nowrap font-medium text-slate-705">
                            <span className="text-slate-500 text-[10px] font-mono block">
                              {activeTenant.businessType === 'pharmacy' ? 'Pharmacist:' : activeTenant.businessType === 'restaurant' ? 'Server:' : 'Cashier:'}
                            </span>
                            <span className="font-bold">{sale.cashierName || 'Primary Staff'}</span>
                          </td>
                          <td className="p-4 whitespace-nowrap text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase tracking-wider ${
                              sale.paymentMethod === 'Credit' 
                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                : sale.paymentMethod === 'Cash' 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-250/60' 
                                  : ['Card', 'Paystack'].includes(sale.paymentMethod)
                                    ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                    : 'bg-orange-100 text-orange-850 border border-orange-200'
                            }`}>
                              {sale.paymentMethod}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono text-slate-505">
                            {currency}{Math.round(sale.tax).toLocaleString()}
                          </td>
                          <td className="p-4 text-right font-mono font-extrabold text-slate-900 text-sm">
                            {currency}{Math.round(sale.total).toLocaleString()}
                          </td>
                          <td className="p-4 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedInspectSale(sale)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-650 rounded-xl transition-all cursor-pointer font-sans font-bold text-[10px] flex items-center space-x-1 mx-auto text-slate-600 active:scale-95 border border-slate-200/80 hover:border-indigo-200"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                              <span>INSPECT RECEIPT</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {recordsFilteredSales.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-16 text-center text-sm text-slate-400 font-medium font-sans bg-slate-50/50">
                          <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-bold text-slate-600 uppercase tracking-wide">No transactions matched research parameters</p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto font-light">Change date or filter.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          );
        })()}

        {/* TAB 2: PAYMENTS LEDGER & CHANNELS */}
        {reportTab === 'payments' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Received Payments & Channel Ledger</h3>
                <p className="text-xs text-slate-500 mt-1">Payment summary.</p>
              </div>

              {/* Tab payment filter rails */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
                {paymentModesList.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedPaymentMode(m)}
                    className={`px-3 py-1.5 rounded-lg border-none cursor-pointer font-sans transition-colors ${
                      selectedPaymentMode === m ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* High level counters — uses configured payment channels if available */}
            <div className="mobile-tablet-kpi-grid gap-3 sm:gap-4 pb-2" style={{ ['--desktop-kpi-columns' as any]: 'repeat(4, minmax(0, 1fr))' }}>
              {Object.keys(paymentMethodTotals).length > 0 ? (
                // Show per-configured-channel breakdown
                paymentMethodEntries
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .map(([key, { amount, count, label, category }]) => {
                    const isCredit = category === 'Credit' || label.toLowerCase().includes('credit');
                    const isMobile = category === 'telco' || typeof category === 'string' && category.includes('Mobile Money');
                    const isBank = category === 'bank';
                    const bg = isCredit ? 'bg-amber-50 border-amber-200' : isMobile ? 'bg-emerald-50 border-emerald-100' : isBank ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100';
                    const textColor = isCredit ? 'text-amber-700' : isMobile ? 'text-emerald-700' : isBank ? 'text-blue-700' : 'text-slate-800';
                    return (
                      <div key={key} className={`border p-3.5 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0 ${bg}`}>
                        <p className={`text-[10px] font-mono font-bold uppercase tracking-widest leading-none truncate ${textColor} opacity-70`}>{label}</p>
                        <h5 className={`text-lg font-black mt-1.5 ${textColor}`}>{currency}{Math.round(amount).toLocaleString()}</h5>
                        <p className="text-[10px] text-slate-400 mt-0.5">{count} transaction{count !== 1 ? 's' : ''}</p>
                      </div>
                    );
                  })
              ) : (
                // No configured channels — show breakdown by actual payment method names used in sales
                Object.keys(paymentBreakdownDynamic).length > 0 ? (
                  paymentBreakdownEntries
                    .sort((a, b) => b[1].revenue - a[1].revenue)
                    .map(([method, { revenue, count }]) => {
                      const cat = classifyPaymentMethod(method);
                      const isCredit = cat === 'Credit';
                      const isMobile = cat === 'Mobile Money';
                      const isBank = cat === 'Bank';
                      const bg = isCredit ? 'bg-amber-50 border-amber-200' : isMobile ? 'bg-emerald-50 border-emerald-100' : isBank ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100';
                      const textColor = isCredit ? 'text-amber-700' : isMobile ? 'text-emerald-700' : isBank ? 'text-blue-700' : 'text-slate-800';
                      return (
                        <div key={method} className={`border p-3.5 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0 ${bg}`}>
                          <p className={`text-[10px] font-mono font-bold uppercase tracking-widest leading-none truncate ${textColor} opacity-70`}>{method}</p>
                          <h5 className={`text-lg font-black mt-1.5 ${textColor}`}>{currency}{Math.round(revenue).toLocaleString()}</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5">{count} transaction{count !== 1 ? 's' : ''}</p>
                        </div>
                      );
                    })
                ) : (
                  <>
                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                    <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Cash</p>
                    <h5 className="text-lg font-black text-slate-800 mt-1.5">{currency}{paymentBreakdown.Cash.toLocaleString()}</h5>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                    <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Card & Online</p>
                    <h5 className="text-lg font-black text-slate-800 mt-1.5">{currency}{paymentBreakdown.CardAndOnline.toLocaleString()}</h5>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                    <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Mobile Money</p>
                    <h5 className="text-lg font-black text-slate-800 mt-1.5">{currency}{paymentBreakdown.MobileMoney.toLocaleString()}</h5>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                    <p className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest leading-none">Store Credit</p>
                    <h5 className="text-lg font-black text-amber-700 mt-1.5">{currency}{paymentBreakdown.Credit.toLocaleString()}</h5>
                  </div>
                  </>
                )
              )}
            </div>

            {/* Daily, Monthly, Yearly table views */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Date Aggregated Timeline Transactions</h4>
              
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Timeline / Date String</th>
                      <th className="p-4 text-center">Receipt Count</th>
                      <th className="p-4 text-right">Cash Received</th>
                      <th className="p-4 text-right">Card Volume</th>
                      <th className="p-4 text-right">MOMO Volume</th>
                      <th className="p-4 text-right text-amber-700">Credit Volume</th>
                      <th className="p-4 text-right font-black">Gross Receipts Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {getGroupedPayments('day').map(seq => (
                      <tr key={seq.date} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-800">{seq.date}</td>
                        <td className="p-4 text-center font-bold text-slate-500">{seq.count}</td>
                        <td className="p-4 text-right font-mono text-slate-700">{currency}{seq.cash.toLocaleString()}</td>
                        <td className="p-4 text-right font-mono text-slate-700">{currency}{seq.card.toLocaleString()}</td>
                        <td className="p-4 text-right font-mono text-slate-700">{currency}{seq.momo.toLocaleString()}</td>
                        <td className="p-4 text-right font-mono text-amber-700 font-bold bg-amber-500/5">{currency}{seq.credit.toLocaleString()}</td>
                        <td className="p-4 text-right font-mono text-slate-900 font-black">{currency}{seq.total.toLocaleString()}</td>
                      </tr>
                    ))}
                    {getGroupedPayments('day').length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No transactions found for payment filter constraints inside date ranges.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}        {/* TAB 3: SKU STOCK & CREDIT VALUATIONS */}
        {reportTab === 'inventory' && (() => {
          const showProfitCogs = rolePermissions?.reportsProfitCogs?.read !== false;
          return (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Stock Valuations & Warehouse Split</h3>
                  <p className="text-xs text-slate-455 mt-1">Stock, cost, and profit.</p>
                </div>

                {/* Categorization controls and query key */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl max-w-xs text-xs">
                    <Search className="w-4 h-4 text-slate-400 mr-2" />
                    <input
                      type="text"
                      placeholder="Search Code or Name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent border-none focus:outline-none w-full text-slate-800"
                    />
                  </div>

                  <div className="flex items-center text-xs text-slate-700">
                    <span className="mr-2 font-bold text-[10px] uppercase font-mono text-slate-400">Class:</span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-slate-100 border border-slate-200 focus:outline-none px-2 py-1.5 rounded-xl font-bold text-slate-700 cursor-pointer"
                    >
                      {categoriesList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* High visual grid breakdown */}
              <div className="mobile-tablet-kpi-grid gap-3 sm:gap-5" style={{ ['--desktop-kpi-columns' as any]: 'repeat(3, minmax(0, 1fr))' }}>
                
                {/* Shop Stock Val */}
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl relative overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                  <span className="absolute top-2 right-2 bg-emerald-100 text-emerald-800 text-[8px] font-black font-mono tracking-widest rounded px-1.5 py-0.5">SHOP FLOOR</span>
                  <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Shelf Valuation</p>
                  <div className="mt-2 text-xs space-y-1">
                    {showProfitCogs && <div className="flex justify-between"><span className="text-slate-500">Total COGS Cost:</span><span className="font-mono font-bold text-slate-800">{currency}{Math.round(currentValuationTotals.shopCogs).toLocaleString()}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">{activeTenant.businessType === 'pharmacy' ? 'Dispensing Worth:' : 'Retail Worth:'}</span><span className="font-mono font-bold text-slate-800">{currency}{Math.round(currentValuationTotals.shopSell).toLocaleString()}</span></div>
                    {showProfitCogs && <div className="flex justify-between pt-1 border-t border-slate-200 text-emerald-800 font-bold"><span>Margin Outlook:</span><span className="font-mono">{currency}{Math.round(currentValuationTotals.shopProfit).toLocaleString()}</span></div>}
                  </div>
                </div>

                {/* Store Backroom Val */}
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl relative overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                  <span className="absolute top-2 right-2 bg-blue-105 text-blue-800 text-[8px] font-black font-mono tracking-widest rounded px-1.5 py-0.5">BACKROOM STORE</span>
                  <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Store Valuation</p>
                  <div className="mt-2 text-xs space-y-1">
                    {showProfitCogs && <div className="flex justify-between"><span className="text-slate-500">Total COGS Cost:</span><span className="font-mono font-bold text-slate-800">{currency}{Math.round(currentValuationTotals.storeCogs).toLocaleString()}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">{activeTenant.businessType === 'pharmacy' ? 'Dispensing Worth:' : 'Retail Worth:'}</span><span className="font-mono font-bold text-slate-800">{currency}{Math.round(currentValuationTotals.storeSell).toLocaleString()}</span></div>
                    {showProfitCogs && <div className="flex justify-between pt-1 border-t border-slate-200 text-emerald-800 font-bold"><span>Margin Outlook:</span><span className="font-mono">{currency}{Math.round(currentValuationTotals.storeProfit).toLocaleString()}</span></div>}
                  </div>
                </div>

                {/* Debt Credit Val */}
                <div className="bg-amber-500/5 border border-amber-200 p-4 rounded-2xl relative overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                  <span className="absolute top-2 right-2 bg-amber-200 text-amber-800 text-[8px] font-black font-mono tracking-widest rounded px-1.5 py-0.5">OUTSTANDING CREDIT</span>
                  <p className="text-[10px] font-mono font-bold text-amber-600 uppercase tracking-widest">On-Credit Worth</p>
                  <div className="mt-2 text-xs space-y-1">
                    {showProfitCogs && <div className="flex justify-between"><span className="text-slate-500">COGS Outlay:</span><span className="font-mono font-bold text-slate-800">{currency}{Math.round(currentValuationTotals.creditCogs).toLocaleString()}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">Invoiced Receivables:</span><span className="font-mono font-bold text-amber-800">{currency}{Math.round(currentValuationTotals.creditSell).toLocaleString()}</span></div>
                    {showProfitCogs && <div className="flex justify-between pt-1 border-t border-amber-200 text-amber-850 font-bold"><span>Unrealized Earnings:</span><span className="font-mono">{currency}{Math.round(currentValuationTotals.creditProfit).toLocaleString()}</span></div>}
                  </div>
                </div>

              </div>

              {/* Cumulative valuation metrics file */}
              <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs flex flex-wrap justify-between items-center gap-4">
                <span className="text-[10px] tracking-widest font-black uppercase text-slate-400">Grand Total Combined Valuation:</span>
                <div className="flex space-x-6">
                  {showProfitCogs && <div><span className="text-slate-500">COGS:</span> <span className="text-white font-bold">{currency}{Math.round(currentValuationTotals.combinedCogs).toLocaleString()}</span></div>}
                  <div><span className="text-slate-500">{activeTenant.businessType === 'pharmacy' ? 'DISPENSING WORTH:' : 'RETAIL WORTH:'}</span> <span className="text-emerald-400 font-bold">{currency}{Math.round(currentValuationTotals.combinedSell).toLocaleString()}</span></div>
                  {showProfitCogs && <div><span className="text-slate-500">POSSIBLE PROFIT:</span> <span className="text-white font-extrabold">{currency}{Math.round(currentValuationTotals.combinedProfit).toLocaleString()}</span></div>}
                </div>
              </div>

              {/* Individual SKU list */}
              <div className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-[0_16px_40px_rgba(15,23,42,0.055)]">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">Valuation Journal Listings</h4>
                    <p className="text-xs text-slate-500 mt-1">Desktop ledger view for warehouse split, credit stock, value and profit outlook.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-500 shrink-0">
                    {productValuationsFiltered.length} products
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1040px] w-full text-left border-collapse text-xs font-sans">
                    <thead>
                      <tr className="bg-white border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
                        <th className="p-4">Product</th>
                        <th className="p-4 text-center">Shop Floor</th>
                        <th className="p-4 text-center">Backroom</th>
                        <th className="p-4 text-center text-amber-700">Credit Stock</th>
                        <th className="p-4 text-center">Total Units</th>
                        {showProfitCogs && <th className="p-4 text-right">COGS Value</th>}
                        <th className="p-4 text-right">Retail Value</th>
                        {showProfitCogs && <th className="p-4 text-right">Profit Outlook</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productValuationsFiltered.map(p => {
                        const product = p.product;
                        const stockIsLow = p.totalQty <= (product.alertQty || 0);
                        const totalCogsValue = p.cogsShop + p.cogsStore + p.cogsCredit > 0 ? p.totalCogs : 0;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition-colors align-middle">
                            <td className="p-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center p-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                                  {product.image ? (
                                    <CachedImage src={product.image} alt={p.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Package className="w-5 h-5 text-slate-400" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900 leading-tight truncate max-w-[260px]">{p.name}</p>
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-mono font-bold uppercase">SKU {p.sku || 'N/A'}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-mono font-bold uppercase max-w-[160px] truncate">{p.category || 'Uncategorized'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <span className="inline-flex justify-center min-w-[92px] px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 font-black text-emerald-800">{formatProductQuantity(p.shopQty, product)}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="inline-flex justify-center min-w-[92px] px-3 py-2 rounded-2xl bg-blue-50 border border-blue-100 font-black text-blue-800">{formatProductQuantity(p.storeQty, product)}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="inline-flex justify-center min-w-[92px] px-3 py-2 rounded-2xl bg-amber-50 border border-amber-100 font-black text-amber-800">{formatProductQuantity(p.creditIssuedQty, product)}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex justify-center min-w-[92px] px-3 py-2 rounded-2xl border font-black ${stockIsLow ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>{formatProductQuantity(p.totalQty, product)}</span>
                            </td>
                            {showProfitCogs && <td className="p-4 text-right font-mono text-slate-600">{currency}{totalCogsValue.toLocaleString()}</td>}
                            <td className="p-4 text-right font-mono font-black text-slate-900">{currency}{p.totalValue.toLocaleString()}</td>
                            {showProfitCogs && <td className="p-4 text-right font-mono font-black text-emerald-700">{currency}{p.unrealizedProfit.toLocaleString()}</td>}
                          </tr>
                        );
                      })}
                      {productValuationsFiltered.length === 0 && (
                        <tr>
                          <td colSpan={showProfitCogs ? 8 : 6} className="p-10 text-center text-slate-500">
                            No product items match the catalog category search query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
        );
      })()}



        {/* TAB 5: CUSTOMER AUDITS & STAFF PERFORMANCE */}
        {reportTab === 'users' && (
          <div className="space-y-6">
            
            {/* 1. Client profiles */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Client Profiles & Spend Analysis</h3>
                <p className="text-xs text-slate-500 mt-1">Customer totals and credit.</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Customer Client Name</th>
                      <th className="p-4 font-mono">Phone Contact</th>
                      <th className="p-4 text-center">Transactions Count</th>
                      <th className="p-4">Preferred Recurrent Item</th>
                      <th className="p-4 text-right">Aggregate Spend value</th>
                      <th className="p-4 text-right font-black text-emerald-850">Cumulative Profit Contributed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {clientProfiles.map(cl => (
                      <tr key={cl.name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{cl.name}</td>
                        <td className="p-4 font-mono text-slate-550">{cl.phone}</td>
                        <td className="p-4 text-center font-bold text-slate-600">{cl.salesCount} purchases</td>
                        <td className="p-4 font-bold text-slate-600 truncate max-w-[190px]">{cl.preferredItem}</td>
                        <td className="p-4 text-right font-mono text-slate-800 font-black">{currency}{Math.round(cl.totalSpend).toLocaleString()}</td>
                        <td className="p-4 text-right font-mono text-emerald-700 bg-emerald-500/5 font-black">{currency}{Math.round(cl.profitGenerated).toLocaleString()}</td>
                      </tr>
                    ))}
                    {clientProfiles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No client history indexed within this timeline.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 1.5 Suppliers trade log */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Wholesale Suppliers & Procurements Trade Log</h3>
                <p className="text-xs text-slate-500 mt-1">Supplier totals.</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Supplier Name</th>
                      <th className="p-4">Contact Info</th>
                      <th className="p-4">Procured Category</th>
                      <th className="p-4 text-center">Orders Count</th>
                      <th className="p-4 text-right">Aggregate Procurement Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {supplierProfiles.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{s.name}</td>
                        <td className="p-4 space-y-0.5">
                          <p className="font-semibold text-slate-700">{s.contact}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{s.phone} | {s.email}</p>
                        </td>
                        <td className="p-4 text-slate-600 font-semibold">{s.categoryCovered}</td>
                        <td className="p-4 text-center text-slate-600 font-bold">{s.ordersCount} purchases</td>
                        <td className="p-4 text-right font-mono text-slate-800 font-black">{currency}{Math.round(s.totalProcured).toLocaleString()}</td>
                      </tr>
                    ))}
                    {supplierProfiles.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          No wholesale supplier records indexed on this branch ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Staff performance and earnings */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Staff Sales & Cost Accountability</h3>
                <p className="text-xs text-slate-500 mt-1">Cashier totals.</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Staff Member / Cashier Name</th>
                      <th className="p-4 text-center">Sales Processed</th>
                      <th className="p-4 text-right">Aggregate Sales Amt</th>
                      <th className="p-4 text-center text-rose-700">Expenses Logged</th>
                      <th className="p-4 text-right text-rose-700">Expenses value Total</th>
                      <th className="p-4 text-right font-black text-slate-900 bg-slate-50">Branch Net Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {staffAudits.map(staff => (
                      <tr key={staff.cashierName} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-black text-slate-800">{staff.cashierName}</td>
                        <td className="p-4 text-center font-bold text-slate-600">{staff.totalSalesProcessed} approved sales</td>
                        <td className="p-4 text-right font-mono text-slate-800">{currency}{Math.round(staff.salesSumAmt).toLocaleString()}</td>
                        <td className="p-4 text-center font-bold text-rose-600 bg-rose-50">{staff.expensesLoggedCount} dockets</td>
                        <td className="p-4 text-right font-mono text-rose-600 bg-rose-50">({currency}{Math.round(staff.expensesChargedAmt).toLocaleString()})</td>
                        <td className={`p-4 text-right font-mono font-black bg-slate-50 ${staff.profitContribution >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {staff.profitContribution < 0 ? '-' : ''}{currency}{Math.abs(Math.round(staff.profitContribution)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {staffAudits.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No personnel files indexed on this branch ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 6: BRANCH EXPENSES JOURNAL */}
        {reportTab === 'expenses' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Operating Expenses Logs Receipt</h3>
                <p className="text-xs text-slate-500 mt-1">Expense totals.</p>
              </div>

              {/* Action triggers */}
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-sans cursor-pointer transition-all flex items-center space-x-2 shadow-sm shrink-0 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Log New Expense</span>
              </button>
            </div>

            {/* Expenses Lists */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
                    <th className="p-4">Expense ID</th>
                    <th className="p-4">Date Recorded</th>
                    <th className="p-4">Expense Category</th>
                    <th className="p-4">Specification / Description</th>
                    <th className="p-4">Recorded By (Staff)</th>
                    <th className="p-4 font-mono">Receipt Invoice Reference</th>
                    <th className="p-4 text-right font-black text-rose-700">Amount Charged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-mono text-slate-505 leading-none">{exp.id}</td>
                      <td className="p-4 whitespace-nowrap text-slate-600">{new Date(exp.timestamp).toLocaleString()}</td>
                      <td className="p-4 whitespace-nowrap"><span className="px-2 py-1 bg-rose-50 text-rose-700 font-bold border border-rose-100 text-[9px] uppercase tracking-wide rounded-md font-sans">{exp.category}</span></td>
                      <td className="p-4 font-medium text-slate-700 max-w-[280px] truncate" title={exp.description}>{exp.description}</td>
                      <td className="p-4 font-semibold text-slate-800">{exp.staffName || 'Operator'}</td>
                      <td className="p-4 font-mono font-bold text-slate-500">
                        <div className="flex items-center space-x-2">
                          <span>{exp.receiptRef || 'UNSUPPORTED'}</span>
                          {exp.receiptImage && (
                            <button
                              type="button"
                              onClick={() => setPreviewReceiptImage(exp.receiptImage || null)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer flex items-center space-x-1 border border-rose-100 shadow-xs"
                              title="View Attached Receipt Image"
                            >
                              <Image className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-sans font-bold">Image</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-rose-700 font-black">{currency}{exp.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No expense logs exist within standard dates. Click 'Log New Expense' to test registering direct debits.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: INDIVIDUAL PRODUCT PERFORMANCE MONITORING */}
                      {reportTab === 'bulk-products' && (
                <div className="space-y-5 animate-fade-in text-left">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-800 uppercase tracking-widest font-mono flex items-center space-x-2">
                      <Scale className="w-5 h-5 text-emerald-600" />
                      <span>Uchambuzi wa Ununuzi wa Jumla (Bulk Tracker)</span>
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.filter(p => p.isBulkProduct).length === 0 && (
                      <div className="col-span-full py-8 text-center text-slate-400 font-mono text-xs bg-white rounded-2xl border border-slate-200 border-dashed">
                        Hakuna bidhaa za jumla zilizorekodiwa (No bulk products configured yet)
                      </div>
                    )}
                    {products.filter(p => p.isBulkProduct).map(p => {
                      const baseUnit = p.inventorySettings?.baseUnit || p.baseUnit || p.sellUnit || p.unit || 'unit';
                      const packageUnit = p.inventorySettings?.purchaseUnit || p.purchaseUnit || p.bulkUnit || 'package';
                      const conversion = Math.max(0.001, Number(p.inventorySettings?.conversionToBaseUnit || p.conversionToBaseUnit || p.bulkPurchaseQty || 1));
                      const pricePerBase = Number(p.inventorySettings?.defaultPricePerBaseUnit || p.defaultPricePerBaseUnit || p.sellUnitPrice || p.sellingPrice || 0);
                      const costPerBase = Number(p.costPrice || 0);
                      const packageCost = Number(p.packageBuyingCost || p.inventorySettings?.packageBuyingCost || (costPerBase * conversion));
                      const totalRevenue = conversion * pricePerBase;
                      const grossProfit = totalRevenue - packageCost;
                      const breakeven = pricePerBase > 0 ? Math.ceil(packageCost / pricePerBase) : 0;

                      let unitsSold = 0;
                      let periodRevenue = 0;
                      let periodCogs = 0;
                      filteredSales.forEach(s => {
                          s.items.forEach(it => {
                              if (it.productId === p.id) {
                                  unitsSold += it.baseQuantityDeducted ?? it.qty;
                                  periodRevenue += it.qty * it.price * (1 - (it.discount || 0) / 100);
                                  periodCogs += (it.costPriceAtSale ?? costPerBase) * it.qty;
                              }
                          });
                      });

                      const periodProfit = periodRevenue - periodCogs;

                      return (
                        <div key={p.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 space-y-3 font-mono text-xs shrink-0">
                          <h4 className="font-bold font-sans text-slate-800 text-sm truncate">{p.name}</h4>
                          <div className="space-y-1 text-slate-600">
                            <div className="flex justify-between"><span>Package:</span> <span className="font-bold">1 {packageUnit} = {conversion.toLocaleString()} {baseUnit}</span></div>
                            <div className="flex justify-between"><span>Buy:</span> <span className="font-bold">{currency}{packageCost.toLocaleString()} / {packageUnit}</span></div>
                            <div className="flex justify-between"><span>Sell:</span> <span className="font-bold">{currency}{pricePerBase.toLocaleString()} / {baseUnit}</span></div>
                            <div className="flex justify-between"><span>Mode:</span> <span className="font-bold uppercase text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">{p.sellingMode}</span></div>
                            <div className="flex justify-between"><span>Total base:</span> <span className="font-bold text-slate-800">{conversion.toLocaleString()} {baseUnit}</span></div>
                            <div className="flex justify-between border-t border-slate-100 pt-1"><span>Breakeven:</span> <span className="font-bold text-slate-800">{breakeven} {baseUnit} required</span></div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 space-y-1">
                            <div className="flex justify-between text-emerald-600"><span>Gross Revenue:</span> <span className="font-bold">{currency}{totalRevenue.toLocaleString()}</span></div>
                            <div className="flex justify-between text-emerald-700"><span>Gross Profit:</span> <span className="font-bold">{currency}{grossProfit.toLocaleString()}</span></div>
                          </div>
                          <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 space-y-1">
                            <div className="flex justify-between text-indigo-700 font-bold"><span>Period Sold:</span> <span>{unitsSold.toFixed(2)} {baseUnit}</span></div>
                            <div className="flex justify-between text-indigo-800 font-bold"><span>Period Revenue:</span> <span>{currency}{periodRevenue.toLocaleString()}</span></div>
                            <div className="flex justify-between text-indigo-900 font-bold"><span>Period Profit:</span> <span>{currency}{periodProfit.toLocaleString()}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {reportTab === 'stock-adjustment' && (() => {
                const allAdjustments: any[] = JSON.parse(onlineStorage.getItem('jasper_stock_adjustments') || '[]');
                const startTs = new Date(startDateStr).setHours(0,0,0,0);
                const endTs = new Date(endDateStr).setHours(23,59,59,999);
                const adjustments = allAdjustments.filter((a: any) => {
                  const t = new Date(a.adjustedAt).getTime();
                  return t >= startTs && t <= endTs;
                });
                const totalAdded = adjustments.filter((a:any) => a.type === 'add').reduce((s:number,a:any) => s + a.qty, 0);
                const totalDeducted = adjustments.filter((a:any) => a.type === 'deduct').reduce((s:number,a:any) => s + a.qty, 0);
                return (
                  <div className="space-y-5 animate-fade-in">
                    {/* Header */}
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <ArrowUpDown className="w-5 h-5 text-purple-600" />
                        Stock Adjustment Report
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manual stock additions and deductions</p>
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Events</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">{adjustments.length}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Units Added</p>
                        <p className="text-2xl font-black text-emerald-700 mt-1">+{totalAdded}</p>
                      </div>
                      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Units Deducted</p>
                        <p className="text-2xl font-black text-rose-700 mt-1">-{totalDeducted}</p>
                      </div>
                    </div>

                    {adjustments.length === 0 ? (
                      <div className="text-center py-16 text-slate-400">
                        <ArrowUpDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold text-sm">No stock adjustments in this date range</p>
                        <p className="text-xs mt-1">Use Products → Adjust Stock to record manual changes</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop table */}
                        <div className="hidden md:block bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date & Time</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Product</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">SKU</th>
                                <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Type</th>
                                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Qty</th>
                                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Before</th>
                                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">After</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adjustments.map((a: any, i: number) => (
                                <tr key={a.id || i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                    {new Date(a.adjustedAt).toLocaleDateString()}<br/>
                                    <span className="text-[10px] text-slate-400">{new Date(a.adjustedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-bold text-slate-800 leading-tight">{a.productName}</p>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{a.sku || '—'}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${a.type === 'add' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                      {a.type === 'add' ? '+ ADD' : '− DEDUCT'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`text-sm font-black ${a.type === 'add' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {a.type === 'add' ? '+' : '-'}{a.qty}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm text-slate-500">{a.previousStock}</td>
                                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">{a.newStock}</td>
                                  <td className="px-4 py-3 text-xs text-slate-400 max-w-[140px] truncate">{a.reason || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile / tablet cards */}
                        <div className="md:hidden space-y-2.5">
                          {adjustments.map((a: any, i: number) => (
                            <div key={a.id || i} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-slate-800 text-[15px] leading-tight truncate">{a.productName}</p>
                                  {a.sku && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{a.sku}</p>}
                                </div>
                                <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${a.type === 'add' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {a.type === 'add' ? '+ ADD' : '− DEDUCT'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 mb-3">
                                <div className="bg-slate-50 rounded-xl p-2 text-center">
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Qty</p>
                                  <p className={`text-[15px] font-black mt-0.5 ${a.type === 'add' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {a.type === 'add' ? '+' : '-'}{a.qty}
                                  </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-2 text-center">
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Before</p>
                                  <p className="text-[15px] font-black text-slate-600 mt-0.5">{a.previousStock}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-2 text-center">
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">After</p>
                                  <p className="text-[15px] font-black text-slate-800 mt-0.5">{a.newStock}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span>{new Date(a.adjustedAt).toLocaleDateString()} {new Date(a.adjustedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                                {a.reason && <span className="text-slate-500 font-medium truncate ml-2 max-w-[150px]">{a.reason}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {reportTab === 'product-monitoring' && (() => {
          const isAll = selectedMonitoredProductId === 'all';
          const monitoredProduct = isAll ? undefined : products.find(p => p.id === selectedMonitoredProductId);
          
          // Filtered sales that contain the selected product (or all sales if 'all' is chosen)
          const salesForMonitoredProduct = isAll 
            ? filteredSales 
            : filteredSales.filter(sale => 
                sale.items.some(item => item.productId === selectedMonitoredProductId)
              );

          let totalQtySold = 0;
          let totalRevenue = 0;
          let totalCogs = 0;

          salesForMonitoredProduct.forEach(sale => {
            sale.items.forEach(item => {
              if (isAll || item.productId === selectedMonitoredProductId) {
                totalQtySold += item.qty;
                const itemDiscount = item.discount || 0;
                let itemSub = item.price * item.qty;
                if (item.discountType === 'cash') {
                  itemSub = Math.max(0, itemSub - itemDiscount);
                } else {
                  itemSub = itemSub * (1 - itemDiscount / 100);
                }
                totalRevenue += itemSub;
                
                const itemProd = products.find(p => p.id === item.productId);
                totalCogs += (item.costPriceAtSale ?? itemProd?.costPrice ?? 0) * item.qty;
              }
            });
          });

          const totalProductProfit = totalRevenue - totalCogs;
          const productProfitMargin = totalRevenue > 0 ? (totalProductProfit / totalRevenue) * 100 : 0;

          // Simple Search & Select filtered product lookup
          const filteredOptions = products.filter(p => 
            String(p.name || '').toLowerCase().includes(productSearchQuery.toLowerCase()) ||
            String(p.sku || '').toLowerCase().includes(productSearchQuery.toLowerCase())
          );

          // Get daily performance data
          const getProductDailyTrendArr = () => {
            const dailyMap: Record<string, { date: string; qty: number; revenue: number; profit: number; txCount: number }> = {};
            
            salesForMonitoredProduct.forEach(sale => {
              const key = new Date(sale.timestamp).toISOString().split('T')[0];
              if (!dailyMap[key]) {
                dailyMap[key] = { date: key, qty: 0, revenue: 0, profit: 0, txCount: 0 };
              }
              
              const dayData = dailyMap[key];
              dayData.txCount += 1;
              sale.items.forEach(item => {
                if (isAll || item.productId === selectedMonitoredProductId) {
                  dayData.qty += item.qty;
                  const itemDiscount = item.discount || 0;
                  let itemSub = item.price * item.qty;
                  if (item.discountType === 'cash') {
                    itemSub = Math.max(0, itemSub - itemDiscount);
                  } else {
                    itemSub = itemSub * (1 - itemDiscount / 100);
                  }
                  dayData.revenue += itemSub;
                  const itemProd = products.find(p => p.id === item.productId);
                  dayData.profit += itemSub - (item.costPriceAtSale ?? itemProd?.costPrice ?? 0) * item.qty;
                }
              });
            });

            return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
          };

          const productDailyTrend = getProductDailyTrendArr();
          const maxDailyQty = Math.max(...productDailyTrend.map(d => d.qty), 1);

          // All products aggregate stock
          const sumShopStock = products.reduce((sum, p) => sum + (p.shopStockQty ?? 0), 0);
          const sumStoreStock = products.reduce((sum, p) => sum + (p.storeStockQty ?? 0), 0);
          const sumPhysicalStock = sumShopStock + sumStoreStock;

          // Process stats for every product in the current date range
          const rawProductBreakdowns = products.map(p => {
            let qtySold = 0;
            let revenue = 0;
            let cogs = 0;

            filteredSales.forEach(sale => {
              sale.items.forEach(item => {
                if (item.productId === p.id) {
                  qtySold += item.qty;
                  const itemDiscount = item.discount || 0;
                  let itemSub = item.price * item.qty;
                  if (item.discountType === 'cash') {
                    itemSub = Math.max(0, itemSub - itemDiscount);
                  } else {
                    itemSub = itemSub * (1 - itemDiscount / 100);
                  }
                  revenue += itemSub;
                  cogs += (item.costPriceAtSale ?? p.costPrice ?? 0) * item.qty;
                }
              });
            });

            const profit = revenue - cogs;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

            return {
              ...p,
              qtySold,
              revenue,
              cogs,
              profit,
              margin
            };
          });

          // Sort product breakdowns based on user preference
          const productBreakdowns = [...rawProductBreakdowns].sort((a, b) => {
            if (productSortBy === 'name' || productSortBy === 'sku') {
              const strA = String(a[productSortBy] || '').toLowerCase();
              const strB = String(b[productSortBy] || '').toLowerCase();
              if (productSortOrder === 'asc') {
                return strA.localeCompare(strB);
              } else {
                return strB.localeCompare(strA);
              }
            }

            let valA = 0;
            let valB = 0;

            if (productSortBy === 'totOnHand') {
              valA = (a.shopStockQty ?? 0) + (a.storeStockQty ?? 0);
              valB = (b.shopStockQty ?? 0) + (b.storeStockQty ?? 0);
            } else {
              valA = a[productSortBy] ?? 0;
              valB = b[productSortBy] ?? 0;
            }

            if (productSortOrder === 'desc') {
              return valB - valA;
            } else {
              return valA - valB;
            }
          });

          // Single date logic
          const isSingleDateMode = startDateStr === endDateStr;

          const handleSingleDateToggle = (checked: boolean) => {
            if (checked) {
              setEndDateStr(startDateStr);
            } else {
              setEndDateStr(new Date().toISOString().split('T')[0]);
            }
          };

          const setPresetDateRangeMode = (preset: 'today' | 'this-week' | 'this-month' | 'last-30') => {
            const today = new Date();
            const endStr = today.toISOString().split('T')[0];
            let startStr = '';

            if (preset === 'today') {
              startStr = endStr;
            } else if (preset === 'this-week') {
              const dayOfWeek = today.getDay();
              const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
              const monday = new Date(today.setDate(diff));
              startStr = monday.toISOString().split('T')[0];
            } else if (preset === 'this-month') {
              const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
              const tzOffset = firstDay.getTimezoneOffset() * 60000;
              const localFirstDay = new Date(firstDay.getTime() - tzOffset);
              startStr = localFirstDay.toISOString().split('T')[0];
            } else if (preset === 'last-30') {
              const past30 = new Date();
              past30.setDate(past30.getDate() - 30);
              startStr = past30.toISOString().split('T')[0];
            }

            setStartDateStr(startStr);
            setEndDateStr(endStr);
          };

          return (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
              
              {/* Product selector & Date range suggestions heading */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="space-y-4 max-w-xl w-full">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Product Performance & Margin Tracker</h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">
                      Select a product or view all stock.
                    </p>
                  </div>

                  {/* Product Search & Dropdown Selector */}
                  <div className="relative flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Type name or code to filter dropdown..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <select
                      value={selectedMonitoredProductId}
                      onChange={(e) => {
                        setSelectedMonitoredProductId(e.target.value);
                        setProductSearchQuery('');
                      }}
                      className="flex-1 bg-white border border-slate-220 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 cursor-pointer focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="all">🌐 [VIEW ALL PRODUCTS] — Combined Performance</option>
                      {filteredOptions.length > 0 ? (
                        filteredOptions.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                        ))
                      ) : (
                        <option value="">No products match search</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Date Selection Box with Calendar Inputs & Quick Toggles */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 shrink-0 lg:max-w-md w-full">
                  <span className="text-[10px] uppercase font-bold text-slate-455 font-mono tracking-wider block font-black">Specify Target Date or Ranges</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="flex flex-col space-y-1 bg-white p-2 rounded-xl border border-slate-200">
                      <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Date A (From)</label>
                      <input
                        type="date"
                        value={startDateStr}
                        onChange={(e) => {
                          setStartDateStr(e.target.value);
                          if (isSingleDateMode) {
                            setEndDateStr(e.target.value);
                          }
                        }}
                        className="bg-transparent text-slate-800 font-bold outline-none focus:ring-0 text-xs cursor-pointer border-none p-0 mt-0.5"
                      />
                    </div>

                    <div className={`flex flex-col space-y-1 p-2 rounded-xl border transition-all ${isSingleDateMode ? 'bg-slate-100/50 border-dashed border-slate-200 opacity-50' : 'bg-white border-slate-200'}`}>
                      <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Date B (To)</label>
                      <input
                        type="date"
                        value={endDateStr}
                        disabled={isSingleDateMode}
                        onChange={(e) => setEndDateStr(e.target.value)}
                        className="bg-transparent text-slate-800 font-bold outline-none focus:ring-0 text-xs cursor-pointer border-none p-0 mt-0.5 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 border-t border-slate-200">
                    {/* Toggle Single Date Mode */}
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSingleDateMode}
                        onChange={(e) => handleSingleDateToggle(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-3.5 w-3.5"
                      />
                      <span className="text-[10.5px] font-bold text-slate-600 select-none">Single Date Only</span>
                    </label>

                    {/* Suggest Date range buttons */}
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'today', label: 'Today' },
                        { id: 'this-week', label: 'Week' },
                        { id: 'this-month', label: 'Month' },
                        { id: 'last-30', label: '30 Days' }
                      ].map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPresetDateRangeMode(preset.id as any)}
                          className="px-2 py-1 bg-white hover:bg-slate-200 border border-slate-220 rounded-md text-[10px] font-bold text-slate-705 transition-colors uppercase font-mono active:scale-95 cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error fallback when product not found */}
              {!isAll && !monitoredProduct ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-3xl text-sm text-slate-500 font-sans">
                  Please select a product from the options menu above to view performance details.
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Grid layout for stock positions & margin insights */}
                  <div className="mobile-tablet-kpi-grid gap-5" style={{ ['--desktop-kpi-columns' as any]: 'repeat(3, minmax(0, 1fr))' }}>
                    
                    {/* Live Stock distribution panel */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                          {isAll ? 'Unified Physical Stock' : 'Current Stock Allocation'}
                        </h4>
                      </div>
                      
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                          <span className="text-slate-500 font-medium">{isAll ? 'Shop Floor (Combined):' : 'Shop Floor Balance:'}</span>
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-md">
                            {isAll ? `${sumShopStock.toLocaleString()} units` : formatProductQuantity(monitoredProduct?.shopStockQty ?? 0, monitoredProduct)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                          <span className="text-slate-500 font-medium">{isAll ? 'Backrooms (Combined):' : 'Store Backroom Balance:'}</span>
                          <span className="font-mono font-bold text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded-md">
                            {isAll ? `${sumStoreStock.toLocaleString()} units` : formatProductQuantity(monitoredProduct?.storeStockQty ?? 0, monitoredProduct)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-500 font-black">Total Physical On-Hand:</span>
                          <span className="font-mono font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded-md">
                            {isAll ? `${sumPhysicalStock.toLocaleString()} units` : formatProductQuantity(((monitoredProduct?.shopStockQty ?? 0) + (monitoredProduct?.storeStockQty ?? 0)), monitoredProduct)}
                          </span>
                        </div>
                      </div>

                      {!isAll && monitoredProduct && (
                        ((monitoredProduct.shopStockQty ?? 0) + (monitoredProduct.storeStockQty ?? 0)) <= (monitoredProduct.alertQty ?? 5) ? (
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 flex items-center space-x-2 text-[10.5px] font-bold text-amber-800 leading-normal font-sans animate-pulse">
                            <span>Low stock: below alert ({formatProductQuantity(monitoredProduct.alertQty ?? 5, monitoredProduct)}). Consider purchasing replenishment batch.</span>
                          </div>
                        ) : (
                          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center space-x-2 text-[10.5px] font-bold text-emerald-800 leading-normal font-sans">
                            <span>Stock OK: above alert ({formatProductQuantity(monitoredProduct.alertQty ?? 5, monitoredProduct)}).</span>
                          </div>
                        )
                      )}

                      {isAll && (
                        <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[10.5px] text-slate-600 font-bold leading-normal">
                          Aggregate physical balances of {products.length} registered products currently being managed in active database catalog.
                        </div>
                      )}
                    </div>

                    {/* Sales overview panel within date range */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">Date Range Sales Volume</h4>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                          <span className="text-slate-500 font-medium">Total Quantity Sold:</span>
                          <span className="font-mono font-bold text-slate-800">{isAll ? `${totalQtySold.toLocaleString()} mixed units` : formatProductQuantity(totalQtySold, monitoredProduct)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                          <span className="text-slate-500 font-medium">Active Receipts Involved:</span>
                          <span className="font-mono font-bold text-slate-800">{salesForMonitoredProduct.length} sales receipt{salesForMonitoredProduct.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-500 font-medium">{isAll ? 'Avg Items per Invoice:' : 'Weighted Sales Price:'}</span>
                          <span className="font-mono font-bold text-indigo-700">
                            {isAll 
                              ? (salesForMonitoredProduct.length > 0 ? (totalQtySold / salesForMonitoredProduct.length).toFixed(1) : '0') + ' items'
                              : currency + (monitoredProduct?.sellingPrice ?? 0).toLocaleString() + ` / ${getProductUnitName(monitoredProduct)}`
                            }
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[10.5px] font-medium text-slate-655 leading-relaxed font-sans">
                        These aggregate details represent customer orders filled between <span className="font-bold text-slate-800 font-mono">{new Date(startDateStr).toLocaleDateString()}</span> and <span className="font-bold text-slate-800 font-mono">{new Date(endDateStr).toLocaleDateString()}</span>.
                      </div>
                    </div>

                    {/* Cost, sales yield & profit analysis */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">Commercial Margin Analysis</h4>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                          <span className="text-slate-500 font-medium">COGS Worth (Cost):</span>
                          <span className="font-mono font-bold text-rose-600">({currency}{Math.round(totalCogs).toLocaleString()})</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200">
                          <span className="text-slate-500 font-medium">Sales Revenue:</span>
                          <span className="font-mono font-extrabold text-emerald-700">{currency}{Math.round(totalRevenue).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-505 font-black">Net Margin Profit:</span>
                          <span className="font-mono font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">{currency}{Math.round(totalProductProfit).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[10.5px] font-bold text-emerald-850 flex justify-between items-center font-sans">
                        <span>Adjusted Segment Markup Margin:</span>
                        <span className="font-mono font-black text-xs text-emerald-950">{Math.round(productProfitMargin)}%</span>
                      </div>
                    </div>

                  </div>

                  {/* Conditional detailed views */}
                  {isAll ? (
                    // CHOSEN VIEW ALL: Render a gorgeous, detailed table of EACH product's stats side-by-side
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                      
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">🌐 Active Catalog — Collective Products Ledger</h4>
                          <p className="text-[11px] text-slate-455 font-sans mt-0.5">
                            Arrange products by sold metrics, revenues, and margins to trace high vs. low performance stock lines.
                          </p>
                        </div>

                        {/* Sorting controller widget */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0">
                            <span className="text-[10px] font-mono font-bold uppercase text-slate-400 px-1.5">Rank Metric:</span>
                            <select
                              value={productSortBy}
                              onChange={(e) => setProductSortBy(e.target.value as any)}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-705 cursor-pointer outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value="qtySold">Units Sold</option>
                              <option value="revenue">Total Revenue</option>
                              <option value="profit">Profit Created</option>
                              <option value="margin">Margin %</option>
                              <option value="totOnHand">Stock On Hand</option>
                              <option value="name">Product Name</option>
                              <option value="sku">Item Code</option>
                            </select>
                          </div>

                          <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setProductSortOrder('desc')}
                              className={`px-3 py-1 rounded-lg text-[10.5px] font-bold uppercase cursor-pointer transition-all flex items-center space-x-1 ${
                                productSortOrder === 'desc'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-505 hover:text-slate-800'
                              }`}
                            >
                              <span>Best Performers ↓</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setProductSortOrder('asc')}
                              className={`px-3 py-1 rounded-lg text-[10.5px] font-bold uppercase cursor-pointer transition-all flex items-center space-x-1 ${
                                productSortOrder === 'asc'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-slate-505 hover:text-slate-800'
                              }`}
                            >
                              <span>Slow Performers ↑</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest select-none">
                              <th 
                                onClick={() => handleProductHeaderSort('name')}
                                className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center space-x-1 justify-start">
                                  <span>Product Name / Code</span>
                                  {productSortBy === 'name' && (
                                    <span className="text-emerald-600 font-extrabold">{productSortOrder === 'desc' ? '▼' : '▲'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="p-3 text-right">Shop Stock</th>
                              <th className="p-3 text-right">Store Stock</th>
                              <th 
                                onClick={() => handleProductHeaderSort('totOnHand')}
                                className="p-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center space-x-1 justify-end">
                                  <span>Total On Hand</span>
                                  {productSortBy === 'totOnHand' && (
                                    <span className="text-emerald-600 font-extrabold">{productSortOrder === 'desc' ? '▼' : '▲'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                onClick={() => handleProductHeaderSort('qtySold')}
                                className="p-3 text-right text-indigo-700 cursor-pointer hover:bg-indigo-50/50 transition-colors"
                              >
                                <div className="flex items-center space-x-1 justify-end">
                                  <span>Units Sold</span>
                                  {productSortBy === 'qtySold' && (
                                    <span className="text-indigo-600 font-extrabold">{productSortOrder === 'desc' ? '▼' : '▲'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                onClick={() => handleProductHeaderSort('revenue')}
                                className="p-3 text-right text-indigo-700 cursor-pointer hover:bg-indigo-50/50 transition-colors font-mono"
                              >
                                <div className="flex items-center space-x-1 justify-end">
                                  <span>Total Revenue</span>
                                  {productSortBy === 'revenue' && (
                                    <span className="text-indigo-600 font-extrabold">{productSortOrder === 'desc' ? '▼' : '▲'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="p-3 text-right text-rose-600 font-mono">Total COGS</th>
                              <th 
                                onClick={() => handleProductHeaderSort('profit')}
                                className="p-3 text-right text-emerald-700 cursor-pointer hover:bg-emerald-50/50 transition-colors font-mono"
                              >
                                <div className="flex items-center space-x-1 justify-end">
                                  <span>Profit Created</span>
                                  {productSortBy === 'profit' && (
                                    <span className="text-emerald-600 font-extrabold">{productSortOrder === 'desc' ? '▼' : '▲'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                onClick={() => handleProductHeaderSort('margin')}
                                className="p-3 text-right text-emerald-800 cursor-pointer hover:bg-emerald-50/50 transition-colors font-mono"
                              >
                                <div className="flex items-center space-x-1 justify-end">
                                  <span>Margin %</span>
                                  {productSortBy === 'margin' && (
                                    <span className="text-emerald-605 font-extrabold">{productSortOrder === 'desc' ? '▼' : '▲'}</span>
                                  )}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans font-medium text-slate-700">
                            {productBreakdowns.map(p => {
                              const totOnHand = (p.shopStockQty ?? 0) + (p.storeStockQty ?? 0);
                              return (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3">
                                    <div className="font-bold text-slate-800">{p.name}</div>
                                    <div className="text-[10px] font-mono text-slate-400">Code: {p.barcode || p.sku}</div>
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20 font-sans">
                                    {formatProductQuantity(p.shopStockQty ?? 0, p)}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-blue-700 bg-blue-50/20 font-sans">
                                    {formatProductQuantity(p.storeStockQty ?? 0, p)}
                                  </td>
                                  <td className="p-3 text-right font-mono font-black text-slate-800 bg-slate-100/30 font-sans">
                                    {formatProductQuantity(totOnHand, p)}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold bg-indigo-50/10">
                                    {p.qtySold > 0 ? (
                                      <span className="text-indigo-700 font-black font-sans">{formatProductQuantity(p.qtySold, p)}</span>
                                    ) : (
                                      <span className="text-slate-400">0</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-mono font-black text-slate-800 font-sans">
                                    {currency}{Math.round(p.revenue).toLocaleString()}
                                  </td>
                                  <td className="p-3 text-right font-mono text-rose-600 font-sans" title="Cost of Goods Sold">
                                    {currency}{Math.round(p.cogs).toLocaleString()}
                                  </td>
                                  <td className={`p-3 text-right font-mono font-black font-sans ${p.profit >= 0 ? 'text-emerald-700 bg-emerald-50/30' : 'text-rose-600'}`}>
                                    {p.profit >= 0 ? '+' : ''}{currency}{Math.round(p.profit).toLocaleString()}
                                  </td>
                                  <td className="p-3 text-right font-mono font-sans">
                                    <span className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] font-mono ${
                                      p.margin > 40 ? 'bg-emerald-100 text-emerald-800' :
                                      p.margin > 15 ? 'bg-indigo-100 text-indigo-800' :
                                      p.margin > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {Math.round(p.margin)}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    // SPECIFIC PRODUCT ACTIVE: Render Daily Trend Line and Invoices List
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* 1. HTML visual chart timeline */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">Daily Sales Volume Timeline</p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase font-black">Max peak: {formatProductQuantity(maxDailyQty, monitoredProduct)}</span>
                        </div>

                        <div className="space-y-3 pt-2 font-sans">
                          {productDailyTrend.map(day => {
                            const pct = (day.qty / maxDailyQty) * 100;
                            return (
                              <div key={day.date} className="space-y-1">
                                <div className="flex justify-between items-center text-[11px] text-slate-600 font-mono">
                                  <span className="font-bold">{new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                  <span className="font-black text-slate-800 font-sans">{formatProductQuantity(day.qty, monitoredProduct)} ({currency}{Math.round(day.revenue).toLocaleString()})</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-emerald-705 font-mono font-black w-10 text-right">+{currency}{Math.round(day.profit).toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                          {productDailyTrend.length === 0 && (
                            <div className="text-center py-12 text-slate-455 text-xs font-sans">
                              No consumer sales activity tracked for this product during selected dates.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. List of recent sale logs containing the product */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">Recent Transaction Receipts ({salesForMonitoredProduct.length})</h4>
                        
                        <div className="divide-y divide-slate-200 overflow-y-auto max-h-[320px] pr-1 space-y-2.5">
                          {salesForMonitoredProduct.slice(0, 10).map(sale => {
                            const saleItem = sale.items.find(it => it.productId === selectedMonitoredProductId);
                            if (!saleItem) return null;

                            let itemValue = saleItem.price * saleItem.qty;
                            const disc = saleItem.discount || 0;
                            if (saleItem.discountType === 'cash') {
                              itemValue = Math.max(0, itemValue - disc);
                            } else {
                              itemValue = itemValue * (1 - disc / 100);
                            }

                            const designCogs = (saleItem.costPriceAtSale ?? monitoredProduct?.costPrice ?? 0) * saleItem.qty;
                            const designProfit = itemValue - designCogs;

                            return (
                              <div key={sale.id} className="pt-2.5 first:pt-0 flex justify-between items-start text-xs font-sans">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="font-mono font-black text-indigo-700">{sale.id}</span>
                                    <span className="text-[10px] font-mono text-slate-455">— {new Date(sale.timestamp).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-slate-500 leading-normal">
                                    Guest/Client: <span className="font-bold text-slate-700">{sale.customerName || 'Walk-In Customer'}</span>
                                  </p>
                                  <p className="text-slate-500 leading-normal">
                                    Quantity Ordered: <span className="font-black text-slate-800 font-mono font-sans">{formatProductQuantity(saleItem.qty, monitoredProduct)}</span> {disc > 0 && <span className="text-rose-600 font-black font-mono">({disc}% off)</span>}
                                  </p>
                                </div>

                                <div className="text-right space-y-0.5">
                                  <span className="font-mono font-extrabold text-slate-800 block">{currency}{Math.round(itemValue).toLocaleString()}</span>
                                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md block">Profit: +{currency}{Math.round(designProfit).toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                          {salesForMonitoredProduct.length === 0 && (
                            <div className="text-center py-12 text-slate-455 text-xs font-sans">
                              No ledger invoice filings exist for this product within this date set.
                            </div>
                          )}
                          {salesForMonitoredProduct.length > 10 && (
                            <p className="text-[10.5px] font-mono font-medium text-slate-400 text-center pt-2">
                              Only displaying up to the 10 most recent transactions.
                            </p>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

            </div>
          );
        })()}

        {reportTab === 'dual-channel' && (() => {
          // Computations
          let retailRevenue = 0;
          let wholesaleRevenue = 0;
          let retailCogs = 0;
          let wholesaleCogs = 0;
          let retailOrders = 0;
          let wholesaleOrders = 0;

          // Per product maps
          const productStats: Record<string, {
            product: Product;
            retailQty: number;
            wholesaleQty: number;
            retailRev: number;
            wholesaleRev: number;
            retailCost: number;
            wholesaleCost: number;
          }> = {};

          // Initialize with all products
          products.forEach(p => {
            productStats[p.id] = {
              product: p,
              retailQty: 0,
              wholesaleQty: 0,
              retailRev: 0,
              wholesaleRev: 0,
              retailCost: 0,
              wholesaleCost: 0
            };
          });

          // Process current filtered sales
          filteredSales.forEach(sale => {
            const isWholesaleChannel = sale.channel === 'wholesale';
            if (isWholesaleChannel) {
              wholesaleOrders++;
            } else {
              retailOrders++;
            }

            sale.items.forEach(item => {
              const matchedProduct = products.find(p => p.id === item.productId);
              if (!matchedProduct) return;

              // Retrieve cost and quantity
              const qty = item.qty;
              const cost = (item.costPriceAtSale ?? (matchedProduct.costPrice || 0));
              const unitPrice = item.price;
              const revenue = qty * unitPrice;
              const cogs = qty * cost;

              // Update product aggregation
              if (!productStats[item.productId]) {
                productStats[item.productId] = {
                  product: matchedProduct,
                  retailQty: 0,
                  wholesaleQty: 0,
                  retailRev: 0,
                  wholesaleRev: 0,
                  retailCost: 0,
                  wholesaleCost: 0
                };
              }

              const stats = productStats[item.productId];
              if (isWholesaleChannel) {
                stats.wholesaleQty += qty;
                stats.wholesaleRev += revenue;
                stats.wholesaleCost += cogs;
                
                wholesaleRevenue += revenue;
                wholesaleCogs += cogs;
              } else {
                stats.retailQty += qty;
                stats.retailRev += revenue;
                stats.retailCost += cogs;
                
                retailRevenue += revenue;
                retailCogs += cogs;
              }
            });
          });

          const retailProfit = retailRevenue - retailCogs;
          const wholesaleProfit = wholesaleRevenue - wholesaleCogs;
          const totalChannelRev = retailRevenue + wholesaleRevenue;
          const totalChannelCogs = retailCogs + wholesaleCogs;
          const grandChannelProfit = totalChannelRev - totalChannelCogs;

          const retailMargin = retailRevenue > 0 ? (retailProfit / retailRevenue) * 100 : 0;
          const wholesaleMargin = wholesaleRevenue > 0 ? (wholesaleProfit / wholesaleRevenue) * 100 : 0;

          // Convert stats map to array for tabular loop
          const productListStats = Object.values(productStats).filter(st => {
            const hasActivity = st.retailQty > 0 || st.wholesaleQty > 0;
            return hasActivity;
          });

          // Function to export to CSV
          const handleExportDualChannelCSV = () => {
            let csv = "Jasper - Dual-Channel Profit Audit Report\r\n";
            csv += `Generational Range: ${startDateStr} to ${endDateStr}\r\n\r\n`;
            
            csv += "CHANNEL LEVEL PERFORMANCE SUMMARY\r\n";
            csv += `Retail Channel Revenue: ${currency}${Math.round(retailRevenue).toLocaleString()}, Cost COGS: ${currency}${Math.round(retailCogs).toLocaleString()}, Margin: ${retailMargin.toFixed(1)}%, Sales Orders: ${retailOrders}\r\n`;
            csv += `Wholesale Channel Revenue: ${currency}${Math.round(wholesaleRevenue).toLocaleString()}, Cost COGS: ${currency}${Math.round(wholesaleCogs).toLocaleString()}, Margin: ${wholesaleMargin.toFixed(1)}%, Sales Orders: ${wholesaleOrders}\r\n`;
            csv += `Combined Net Channel Profits: ${currency}${Math.round(grandChannelProfit).toLocaleString()}\r\n\r\n`;

            csv += "PER-PRODUCT DUAL SELLING CHANNEL PERFORMANCE\r\n";
            csv += "Item Code,Product,Cost Price,Retail Price,Wholesale Price,Retail Qty,Retail Rev,Wholesale Qty,Wholesale Rev,Total Cost,Total Profit,Profit Margin\r\n";
            
            productListStats.forEach(st => {
              const totalCost = st.retailCost + st.wholesaleCost;
              const totalRevenue = st.retailRev + st.wholesaleRev;
              const totalProfit = totalRevenue - totalCost;
              const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

              csv += `"${st.product.sku}","${st.product.name}",${st.product.costPrice},${st.product.sellingPrice},${st.product.wholesalePrice || 0},${st.retailQty},${st.retailRev},${st.wholesaleQty},${st.wholesaleRev},${totalCost},${totalProfit},${margin.toFixed(1)}%\r\n`;
            });

            csv += "\r\nSECURITY APPROVAL EXCEPTIONS HISTORY\r\n";
            csv += "Log ID,Timestamp,Exception Description,Approver Status\r\n";
            
            // Collect exclusions from all logged metadata
            const exceptions = sales.flatMap(s => s.approvals || []);
            exceptions.forEach((exc: any) => {
              csv += `"${exc.id}","${exc.timestamp}","${exc.description}","${exc.status}"\r\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Jasper_Dual_Channel_Profits_${startDateStr}_to_${endDateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };

          return (
            <div className="space-y-6 animate-fade-in text-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-5 rounded-3xl">
                <div className="text-left">
                  <h4 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">📦 Double Channel Retail-Wholesale Reconciliation</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">Inventory profit summary.</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportDualChannelCSV}
                  className="py-2.5 px-4 bg-slate-900 border border-slate-950 font-extrabold text-white text-[11px] uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-all cursor-pointer shadow-sm select-none"
                >
                  📥 Export Channel Audit XLS-CSV
                </button>
              </div>

              {/* 1. CHANNEL SUMMARY CARDS */}
              <div className="mobile-tablet-kpi-grid gap-5" style={{ ['--desktop-kpi-columns' as any]: 'repeat(3, minmax(0, 1fr))' }}>
                {/* Retail card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:border-emerald-300 transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none" />
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-[10px] font-black tracking-widest uppercase text-emerald-850 bg-emerald-50 px-2.5 py-1 rounded-lg">🛒 Retail Summary</span>
                    <span className="text-xs font-mono font-black text-slate-400">Total: {retailOrders} Sales</span>
                  </div>
                  <div className="py-2.5 space-y-1.5 text-left">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-medium">Retail Revenue:</span>
                      <span className="font-mono text-xs font-extrabold text-slate-800">{currency}{Math.round(retailRevenue).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-medium">Retail Cost COGS:</span>
                      <span className="font-mono text-xs font-bold text-slate-600">{currency}{Math.round(retailCogs).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-t border-dashed border-slate-100 pt-1.5">
                      <span className="text-xs font-bold text-slate-705">Net Profit:</span>
                      <span className="font-mono text-sm font-black text-emerald-700">{currency}{Math.round(retailProfit).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-slate-400 font-bold">Estimated Margin:</span>
                      <span className="text-xs font-black text-emerald-600 font-mono">{(retailMargin > 100 ? 100 : retailMargin).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Wholesale card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:border-teal-300 transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none" />
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-[10px] font-black tracking-widest uppercase text-teal-850 bg-teal-50 px-2.5 py-1 rounded-lg">📦 Wholesale Summary</span>
                    <span className="text-xs font-mono font-black text-slate-400">Total: {wholesaleOrders} Bulk</span>
                  </div>
                  <div className="py-2.5 space-y-1.5 text-left">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-medium">Wholesale Revenue:</span>
                      <span className="font-mono text-xs font-extrabold text-slate-800">{currency}{Math.round(wholesaleRevenue).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-medium">Wholesale Cost COGS:</span>
                      <span className="font-mono text-xs font-bold text-slate-600">{currency}{Math.round(wholesaleCogs).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-t border-dashed border-slate-100 pt-1.5">
                      <span className="text-xs font-bold text-slate-705">Net Profit:</span>
                      <span className="font-mono text-sm font-black text-teal-700">{currency}{Math.round(wholesaleProfit).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-slate-400 font-bold">Estimated Margin:</span>
                      <span className="text-xs font-black text-teal-650 font-mono">{(wholesaleMargin > 100 ? 100 : wholesaleMargin).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Combined card */}
                <div className="bg-slate-900 border border-slate-950 text-slate-100 rounded-3xl p-5 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-[10px] font-black tracking-widest uppercase text-amber-400 bg-amber-950/45 border border-amber-900 px-2.5 py-1 rounded-lg">📈 Combined Branch Profits</span>
                    <span className="text-xs font-sans font-bold text-slate-400">POS Audits</span>
                  </div>
                  <div className="py-4 space-y-1 text-left">
                    <span className="text-slate-400 font-medium text-[10.5px]">RECONCILED PROFIT POOL</span>
                    <h2 className="text-2xl font-black text-emerald-400 font-mono tracking-tight">{currency}{Math.round(grandChannelProfit).toLocaleString()}</h2>
                    <p className="text-[9.5px] text-slate-500 leading-relaxed pt-1 font-sans">
                      Based on sales and purchase costs.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. DUAL-CHANNEL PER PRODUCT PROFIT SHEET */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-705 uppercase tracking-wider">Per-Product Channel Profit Audit Ledger</span>
                  <span className="text-[10px] text-slate-500">Displaying products with active sales logs</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                        <th className="py-3.5 px-5">Product Details & Code</th>
                        <th className="py-3.5 px-4 text-center">Base Cost</th>
                        <th className="py-3.5 px-4 text-center">Retail Channel</th>
                        <th className="py-3.5 px-4 text-center">Wholesale Channel</th>
                        <th className="py-3.5 px-4 text-center">Total Revenue</th>
                        <th className="py-3.5 px-4 text-center">Cost COGS</th>
                        <th className="py-3.5 px-4 text-right pr-5">Net Profits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11.5px] font-medium text-slate-700">
                      {productListStats.map(st => {
                        const totRev = st.retailRev + st.wholesaleRev;
                        const totCogs = st.retailCost + st.wholesaleCost;
                        const netProf = totRev - totCogs;
                        const margin = totRev > 0 ? (netProf / totRev) * 100 : 0;

                        return (
                          <tr key={st.product.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-5 text-left">
                              <p className="font-bold text-slate-800">{st.product.name}</p>
                              <span className="text-[9.5px] font-mono text-slate-500 font-bold">{st.product.sku}</span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono">
                              {currency}{Number(st.product.costPrice).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="inline-block text-left">
                                <p className="font-mono text-[11px] font-bold text-emerald-800">{currency}{Math.round(st.retailRev).toLocaleString()}</p>
                                <p className="text-[9px] font-mono text-slate-400 font-semibold">{formatProductQuantity(st.retailQty, st.product)} sold</p>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="inline-block text-left">
                                <p className="font-mono text-[11px] font-bold text-teal-850">{currency}{Math.round(st.wholesaleRev).toLocaleString()}</p>
                                <p className="text-[9px] font-mono text-slate-400 font-semibold">{formatProductQuantity(st.wholesaleQty, st.product)} sold</p>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                              {currency}{Math.round(totRev).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-500">
                              {currency}{Math.round(totCogs).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right pr-5">
                              <p className={`font-mono font-black ${netProf >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {currency}{Math.round(netProf).toLocaleString()}
                              </p>
                              <span className="text-[9px] font-bold text-slate-400 font-sans">Margin: {margin.toFixed(1)}%</span>
                            </td>
                          </tr>
                        );
                      })}
                      {productListStats.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 text-xs font-bold leading-relaxed">
                            No sales in this range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. PERMANENT OWNER APPROVAL AUDIT EXEMPTIONS LOG */}
              <div className="bg-slate-900 text-slate-100 rounded-3xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-xs font-black text-slate-100 uppercase tracking-wider">Live Security Audit exceptions register</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded px-2.5 py-0.5">Permanent Log Ledger</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold text-[9px] uppercase">
                        <th className="py-3 px-5">Verification ID</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Conflict Description / Till Request</th>
                        <th className="py-3 px-4 text-right pr-5">Override Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px] font-medium text-slate-300">
                      {(() => {
                        // Gather approvals from all sales
                        const allExs = sales.flatMap(s => s.approvals || []);
                        
                        return (
                          <>
                            {allExs.map((exc: any) => (
                              <tr key={exc.id} className="hover:bg-slate-950/30 transition-colors">
                                <td className="py-3.5 px-5 font-mono text-[10px] font-black text-rose-400 text-left">
                                  {exc.id.toUpperCase()}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-slate-400 text-[10px] text-left">
                                  {exc.timestamp}
                                </td>
                                <td className="py-3.5 px-4 font-sans text-xs text-slate-300 font-semibold max-w-sm text-left">
                                  {exc.description}
                                </td>
                                <td className="py-3.5 px-4 text-right pr-5">
                                  <span className={`px-2 py-0.5 rounded font-black text-[9px] border inline-block ${
                                    exc.status === 'PENDING'
                                      ? 'bg-amber-950/80 text-amber-400 border-amber-900 animate-pulse'
                                      : exc.status === 'BYPASSED'
                                        ? 'bg-emerald-950/80 text-emerald-450 border-emerald-990'
                                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                                  }`}>
                                    {exc.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {allExs.length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 text-xs font-bold leading-relaxed">
                                  No transaction-critical alerts, clearances or void overrides on file. Branch operating fully on-rails.
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          );
        })()}

      </div>
      </div>

      {/* ============================================================= */}
      {/* MOBILE-ONLY BRAND REDESIGNED REPORTS LAYOUT (xl:hidden) */}
      {/* ============================================================= */}
      <div className="block xl:hidden pb-20 select-none">
        {mobileView === 'menu' ? (
          <div className="space-y-5">
            {/* Mobile Header for Selector */}
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
              <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-400/10" />
              <div className="absolute -bottom-12 left-12 h-24 w-24 rounded-full bg-emerald-400/10" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black tracking-[0.22em] text-white/45 uppercase">Business intelligence</span>
                  <h2 className="text-[22px] font-black tracking-tight text-left leading-tight">Reports</h2>
                  <p className="text-[11px] text-slate-300 font-medium text-left">Choose a report to inspect live performance.</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                  <BarChart3 className="h-5 w-5 text-emerald-300" />
                </div>
              </div>
            </div>

            {/* Quick Overview Cards for Mobile */}
            <div className="grid grid-cols-2 gap-3 pb-2">
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between min-h-[76px] text-left">
                <span className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider block">Branch Yield</span>
                <span className="text-sm font-black text-slate-800 tracking-tight block mt-1">{currency}{Math.round(totalSalesRevenue).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between min-h-[76px] text-left">
                <span className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider block">Active Stock</span>
                <span className="text-sm font-black text-indigo-650 tracking-tight block mt-1">{products.length} SKUs</span>
              </div>
            </div>

            {/* List of Reports Cards with Icons */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'p&l', label: 'Profit & Loss', icon: BarChart3, desc: 'Gross & net margin statement', colorClass: 'bg-emerald-50 text-emerald-605 border border-emerald-100', reqPerm: 'reportsProfitCogs' },
                { id: 'sales-report', label: 'Sales Report', icon: TrendingUp, desc: 'Transactions & VAT audit', colorClass: 'bg-indigo-50 text-indigo-605 border border-indigo-100', reqPerm: 'reportsSalesExpenses' },
                { id: 'dual-channel', label: 'Dual Channel Report', icon: ShieldAlert, desc: 'Retail vs wholesale pricing', colorClass: 'bg-teal-50 text-teal-605 border border-teal-100', reqPerm: 'reportsSalesExpenses' },
                { id: 'inventory', label: 'Inventory Report', icon: Package, desc: 'Stock & asset valuations', colorClass: 'bg-amber-50 text-amber-605 border border-amber-100', reqPerm: 'reportsSalesExpenses' },
                { id: 'payments', label: 'Payments Report', icon: DollarSign, desc: 'Collections by payment method', colorClass: 'bg-green-50 text-green-605 border border-green-100', reqPerm: 'reportsSalesExpenses' },
                { id: 'product-monitoring', label: 'Product Profitability', icon: Tag, desc: 'Product margin rankings', colorClass: 'bg-rose-50 text-rose-605 border border-rose-100', reqPerm: 'reportsSalesExpenses' },
                { id: 'users', label: 'Partners & Customers', icon: Users, desc: 'Loyalty & staff journal', colorClass: 'bg-blue-50 text-blue-605 border border-blue-100', reqPerm: 'reportsSalesExpenses' },
                { id: 'expenses', label: 'Branch Expenses', icon: MinusCircle, desc: 'Costs & petty cash logs', colorClass: 'bg-red-50 text-red-655 border border-red-100', reqPerm: 'reportsSalesExpenses' },
                { id: 'deliveries', label: 'Fleet & Logistics', icon: Truck, desc: 'Dispatch & rider fees', colorClass: 'bg-violet-50 text-violet-605 border border-violet-100', reqPerm: 'reportsSalesExpenses' },
                { id: 'velocity', label: 'Velocity Report', icon: ArrowUpDown, desc: 'Inventory turnover rates', colorClass: 'bg-orange-50 text-orange-605 border border-orange-100', reqPerm: 'reportsSalesExpenses' }
              ].filter(tab => {
                if (!rolePermissions) return true;
                const permGroup = (rolePermissions as any)[tab.reqPerm];
                return permGroup === undefined || permGroup.read;
              }).map((tab) => {
                const IconComp = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setReportTab(tab.id as any);
                      setMobileView('report');
                    }}
                    className="relative w-full flex min-w-0 flex-col items-start p-3.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm text-left active:scale-[0.97] transition-all cursor-pointer gap-2.5"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tab.colorClass}`}>
                      <IconComp className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 block leading-tight">{tab.label}</span>
                      <span className="text-[10px] block leading-snug text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{tab.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-5 pb-10">
            {/* Header pattern matching other screens */}
            <div className="sticky top-0 z-30 flex items-center justify-between min-h-16 bg-slate-950/95 backdrop-blur-xl px-4 py-2.5 border-b border-white/10 shadow-lg -mx-4 -mt-2 text-white">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setMobileView('menu')}
                  className="w-10 h-10 flex items-center justify-center rounded-[14px] bg-white/10 text-white transition-all cursor-pointer border border-white/10 active:scale-95"
                  aria-label="Back to menu"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-[15px] font-extrabold text-white tracking-tight text-left leading-tight">
                  {reportTab === 'p&l' ? 'Profit & Loss' :
                   reportTab === 'sales-report' ? 'Sales Report' :
                   reportTab === 'dual-channel' ? 'Dual Channel Report' :
                   reportTab === 'inventory' ? 'Inventory Report' :
                   reportTab === 'payments' ? 'Payments Report' :
                   reportTab === 'product-monitoring' ? 'Product Profitability' :
                   reportTab === 'bulk-products' ? 'Bulk Products Report' :
                   reportTab === 'users' ? 'Partners & Customers' :
                   reportTab === 'expenses' ? 'Branch Expenses' :
                   reportTab === 'deliveries' ? 'Fleet Logistics' : 'Velocity Report'}
                </span>
              </div>
              
              {/* Print PDF */}
              <button
                type="button"
                onClick={printActiveReportPdf}
                className="w-10 h-10 flex items-center justify-center rounded-[14px] bg-white/10 text-white border border-white/10 transition-all cursor-pointer active:scale-95"
                title="Export PDF"
              >
                <Printer className="w-[18px] h-[18px]" />
              </button>
            </div>


            {/* Date filter */}
            {/* Side-by-side date inputs with quick presets row - matching other screens */}
            <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
              <div className="flex flex-row gap-2 w-full">
                {/* FROM Input */}
                <div className="flex-1 flex flex-col bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl relative">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 mb-0.5 leading-none text-left">FROM</span>
                  <input
                    type="date"
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="bg-transparent border-none text-slate-800 font-bold outline-none font-sans focus:ring-0 text-sm w-full p-0 cursor-pointer mt-0.5 h-5"
                  />
                </div>

                {/* TO Input */}
                <div className="flex-1 flex flex-col bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl relative">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 mb-0.5 leading-none text-left">TO</span>
                  <input
                    type="date"
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="bg-transparent border-none text-slate-800 font-bold outline-none font-sans focus:ring-0 text-sm w-full p-0 cursor-pointer mt-0.5 h-5"
                  />
                </div>
              </div>

              {/* Quick Preset Pills Row */}
              <div className="flex flex-row items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-nowrap whitespace-nowrap">
                {[
                  { id: 'today', label: 'Today', range: () => { setStartDateStr(getTodayRange()); setEndDateStr(getTodayRange()); } },
                  { id: 'yesterday', label: 'Yesterday', range: () => { setStartDateStr(getYesterdayRange()); setEndDateStr(getYesterdayRange()); } },
                  { id: 'last7', label: 'Last 7 Days', range: () => { setStartDateStr(getLast7DaysRange()); setEndDateStr(getTodayRange()); } },
                  { id: 'all', label: 'All Time', range: () => { setStartDateStr('2020-01-01'); setEndDateStr(getTodayRange()); } }
                ].map(p => {
                  const isActive = checkActivePreset() === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={p.range}
                      className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold tracking-tight transition-all cursor-pointer border min-h-[34px] flex items-center justify-center ${
                        isActive
                          ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ACTIVE REPORT CANVAS */}
            <div className="space-y-5 animate-fade-in">
              {reportTab === 'p&l' && (
                <div className="space-y-5">
                  {/* Summary Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: 'Revenue', value: `${currency}${Math.round(totalSalesRevenue).toLocaleString()}`, color: 'text-emerald-600', dot: 'bg-emerald-500', sub: 'Gross sales' },
                      { label: 'COGS', value: `${currency}${Math.round(totalCOGS).toLocaleString()}`, color: 'text-slate-700 dark:text-slate-200', dot: 'bg-amber-400', sub: 'Cost of goods' },
                      { label: 'Expenses', value: `${currency}${Math.round(totalExpensesCharged).toLocaleString()}`, color: 'text-rose-600', dot: 'bg-rose-500', sub: 'Operating costs' },
                      { label: 'Net Profit', value: `${netProfit < 0 ? '-' : ''}${currency}${Math.abs(Math.round(netProfit)).toLocaleString()}`, color: netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700', dot: netProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500', sub: netProfit >= 0 ? 'Surplus' : 'Deficit', highlight: true },
                    ].map((k, i) => (
                      <div key={i} className={`rounded-2xl p-4 border text-left ${k.highlight ? (netProfit >= 0 ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800') : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'} shadow-sm`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${k.dot} shrink-0`} />
                          <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{k.label}</span>
                        </div>
                        <p className={`text-[17px] font-black leading-none ${k.color} font-mono`}>{k.value}</p>
                        <p className="text-[9px] text-slate-400 mt-1">{k.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Margin trend chart */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-2 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Margin Trend</span>
                      <div className="flex items-center gap-3 text-[9px] text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-emerald-500 inline-block rounded" />Sales</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-purple-500 inline-block rounded" />Profit</span>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 hidden">Consolidated Margin Curve</h4>
                    <div className="w-full overflow-x-auto scrollbar-none">
                      <div className="min-w-[340px] h-[180px]">
                        <ResponsiveContainer width="105%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 357, height: 180 }}>
                          <LineChart data={pAndLGraphData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="salesRevenue" name="Sales" stroke="#10b981" strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="profit" name="Profit" stroke="#a855f7" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* P&L Statement — clean financial ledger style */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] font-black tracking-widest uppercase text-slate-400">Income Statement</span>
                    </div>
                    {[
                      { label: 'Total Sales Revenue', value: totalSalesRevenue, tag: 'CREDIT', tagColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30', valColor: 'text-emerald-600', prefix: '+' },
                      { label: 'Cost of Goods Sold', value: totalCOGS, tag: 'DEBIT', tagColor: 'text-rose-500 bg-rose-50 dark:bg-rose-900/30', valColor: 'text-slate-700 dark:text-slate-200', prefix: '-' },
                      { label: 'Gross Profit', value: grossProfit, tag: 'MARGIN', tagColor: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30', valColor: 'text-indigo-700 dark:text-indigo-300', prefix: '=', divider: true },
                      { label: 'Operating Expenses', value: totalExpensesCharged, tag: 'DEBIT', tagColor: 'text-rose-500 bg-rose-50 dark:bg-rose-900/30', valColor: 'text-slate-700 dark:text-slate-200', prefix: '-' },
                      { label: 'Net Profit / Loss', value: netProfit, tag: netProfit >= 0 ? 'SURPLUS' : 'DEFICIT', tagColor: netProfit >= 0 ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40' : 'text-rose-700 bg-rose-100 dark:bg-rose-900/40', valColor: netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700', prefix: '=', divider: true, bold: true },
                    ].map((row, i) => (
                      <div key={i}>
                        {row.divider && <div className="h-px bg-slate-100 dark:bg-slate-800 mx-4" />}
                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 font-mono w-3 shrink-0">{row.prefix}</span>
                            <div>
                              <p className={`text-xs ${row.bold ? 'font-black' : 'font-semibold'} text-slate-800 dark:text-slate-100`}>{row.label}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${row.tagColor} mt-0.5 inline-block`}>{row.tag}</span>
                            </div>
                          </div>
                          <span className={`text-[15px] font-black font-mono ${row.valColor} shrink-0 ml-2`}>
                            {currency}{Math.abs(Math.round(row.value)).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportTab === 'sales-report' && (
                <div className="space-y-4">
                  {/* Summary Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: 'Transactions', value: `${salesReportMetrics.totalOrders}`, sub: 'tickets issued', color: 'text-indigo-600', dot: 'bg-indigo-500' },
                      { label: 'Revenue', value: `${currency}${Math.round(salesReportMetrics.totalRevenue).toLocaleString()}`, sub: 'gross income', color: 'text-emerald-600', dot: 'bg-emerald-500' },
                      { label: 'Collected', value: `${currency}${Math.round(salesReportMetrics.paidRevenue).toLocaleString()}`, sub: 'paid channel', color: 'text-slate-700 dark:text-slate-100', dot: 'bg-teal-500' },
                      { label: 'Credit Due', value: `${currency}${Math.round(salesReportMetrics.unpaidRevenue).toLocaleString()}`, sub: 'outstanding', color: 'text-rose-600', dot: 'bg-rose-500' },
                    ].map((k, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm text-left">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${k.dot}`} />
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest">{k.label}</span>
                        </div>
                        <p className={`text-[17px] font-black leading-none ${k.color} font-mono`}>{k.value}</p>
                        <p className="text-[9px] text-slate-400 mt-1">{k.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Search Bar for Mobile */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search transactions..."
                      value={salesSearch}
                      onChange={(e) => setSalesSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[44px]"
                    />
                  </div>

                  {/* Transaction card list */}
                  <div className="space-y-2.5 animate-fade-in text-left">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="text-xs font-bold text-slate-800">Audit Journal Rows</h4>
                      <span className="text-[10px] font-mono text-slate-500">{recordsFilteredSales.length} records</span>
                    </div>

                    {recordsFilteredSales.length === 0 ? (
                      <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                        <ShoppingBag className="w-10 h-10 text-slate-355 mb-2" />
                        <h4 className="text-sm font-semibold text-slate-700">No data available</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-[180px]">No sales transactions found in selected period.</p>
                      </div>
                    ) : (
                      recordsFilteredSales.slice(0, 30).map((sale) => (
                        <div key={sale.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden text-left">
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{sale.customerName || 'Walk-In'}</p>
                              <p className="text-[9px] font-mono text-slate-400 mt-0.5">{new Date(sale.timestamp).toLocaleDateString()} · {sale.paymentMethod}</p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-[15px] font-black font-mono text-slate-800 dark:text-slate-100">{currency}{sale.total.toFixed(0)}</p>
                              <p className="text-[9px] text-slate-400">{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-slate-500 truncate">{sale.items.slice(0,3).map(it => `${it.qty}× ${it.productName}`).join(' · ')}{sale.items.length > 3 ? ` +${sale.items.length-3}` : ''}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {reportTab === 'payments' && (
                <div className="space-y-4">
                  {/* Summary Metrics Grid — configured payment channels */}
                  <div className="native-report-kpi-grid grid grid-cols-2 gap-3">
                    {Object.keys(paymentMethodTotals).length > 0 ? (
                      paymentMethodEntries
                        .sort((a, b) => b[1].amount - a[1].amount)
                        .map(([key, { amount, count, label, category }]) => {
                          const isCredit = category === 'Credit' || label.toLowerCase().includes('credit');
                          const isMobile = category === 'telco';
                          const isBank = category === 'bank';
                          const iconColor = isCredit ? 'text-rose-500' : isMobile ? 'text-amber-500' : isBank ? 'text-blue-500' : 'text-emerald-600';
                          const valColor = isCredit ? 'text-rose-600' : isMobile ? 'text-amber-700' : isBank ? 'text-blue-700' : 'text-emerald-600';
                          return (
                            <div key={key} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm text-left">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${isCredit ? 'bg-rose-500' : isMobile ? 'bg-amber-400' : isBank ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest truncate">{label}</span>
                              </div>
                              <p className={`text-[17px] font-black leading-none font-mono ${valColor}`}>{currency}{Math.round(amount).toLocaleString()}</p>
                              <p className="text-[9px] text-slate-400 mt-1">{count} transaction{count !== 1 ? 's' : ''}</p>
                            </div>
                          );
                        })
                    ) : (
                      <>
                        <div className={mobileReportKpiCardClass}>
                          <div className="flex items-center space-x-1.5 text-emerald-600">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Cash</span>
                          </div>
                          <span className="text-sm font-black text-emerald-600 mt-2">{currency}{paymentBreakdown.Cash.toLocaleString()}</span>
                        </div>
                        <div className={mobileReportKpiCardClass}>
                          <div className="flex items-center space-x-1.5 text-indigo-500">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Card & Online</span>
                          </div>
                          <span className="text-sm font-black text-slate-800 mt-2">{currency}{paymentBreakdown.CardAndOnline.toLocaleString()}</span>
                        </div>
                        <div className={mobileReportKpiCardClass}>
                          <div className="flex items-center space-x-1.5 text-amber-500">
                            <Smartphone className="w-4 h-4" />
                            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Mobile Money</span>
                          </div>
                          <span className="text-sm font-black text-slate-800 mt-2">{currency}{paymentBreakdown.MobileMoney.toLocaleString()}</span>
                        </div>
                        <div className={mobileReportKpiCardClass}>
                          <div className="flex items-center space-x-1.5 text-rose-500">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Store Credit</span>
                          </div>
                          <span className="text-sm font-black text-rose-600 mt-2">{currency}{paymentBreakdown.Credit.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Channel weights summary cards */}
                  <div className="space-y-2.5 text-left">
                    <h4 className="text-xs font-semibold text-slate-800 font-sans px-1">Payment Modes Weight Proportions</h4>
                    <div className="space-y-2">
                      {(() => {
                        const totalSum = Object.values(paymentBreakdown).reduce((a, b) => a + b, 0);
                        return Object.entries(paymentBreakdown).map(([channel, amount]) => {
                          const pct = totalSum > 0 ? (amount / totalSum) * 100 : 0;
                          return (
                            <div key={channel} className="bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-xs flex items-center justify-between text-left">
                              <div>
                                <span className="text-sm font-bold text-slate-800 block">
                                  {channel === 'CardAndOnline' ? 'Card & Paystack Gateway' :
                                   channel === 'MobileMoney' ? 'Mobile Money Wallets' :
                                   channel === 'BankTransfer' ? 'Bank Transfer' : channel}
                                </span>
                                <span className="text-xs text-slate-400 block mt-0.5 mt-0.5">Cleared settlement channel</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-sm font-extrabold text-slate-900 block">{currency}{amount.toLocaleString()}</span>
                                <span className="text-[11px] text-emerald-600 font-bold block mt-0.5">{pct.toFixed(1)}% weight</span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {reportTab === 'inventory' && (
                <div className="space-y-4">
                  {/* Summary Metrics Grid */}
                  {(() => {
                    const totalShopVal = products.reduce((acc, curr) => acc + (curr.shopStockQty || 0) * curr.costPrice, 0);
                    const totalStoreVal = products.reduce((acc, curr) => acc + (curr.storeStockQty || 0) * curr.costPrice, 0);
                    const totalAssetVal = products.reduce((acc, curr) => acc + (curr.stockQty || 0) * curr.costPrice, 0);
                    return (
                      <>
                        <div className="native-report-kpi-grid grid grid-cols-2 gap-3">
                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-indigo-500">
                              <Package className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Shop Stock</span>
                            </div>
                            <span className="text-sm font-black text-slate-800 mt-2">{currency}{Math.round(totalShopVal).toLocaleString()}</span>
                          </div>

                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-amber-500">
                              <Archive className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Backroom Store</span>
                            </div>
                            <span className="text-sm font-black text-slate-800 mt-2">{currency}{Math.round(totalStoreVal).toLocaleString()}</span>
                          </div>

                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-blue-500">
                              <Tag className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Catalog SKUs</span>
                            </div>
                            <span className="text-sm font-black text-blue-600 mt-2">{products.length} Products</span>
                          </div>

                          <div className={`${mobileReportToneKpiCardClass} bg-emerald-50 border-emerald-150`}>
                            <div className="flex items-center space-x-1.5 text-emerald-600">
                              <Package className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">Total Assets</span>
                            </div>
                            <span className="text-sm font-black text-emerald-800 mt-2">{currency}{Math.round(totalAssetVal).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* List replacements */}
                        <div className="space-y-3 text-left">
                          <div className="flex justify-between items-end px-1">
                            <div>
                              <h4 className="text-xs font-black text-slate-800 font-sans tracking-tight">Valuations Journal Listings</h4>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Product-level stock value cards</p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-500">{products.length} products</span>
                          </div>

                          <div className="space-y-2">
                            {products.map((p) => {
                              const shopQty = p.shopStockQty ?? 0;
                              const storeQty = p.storeStockQty ?? 0;
                              const totalQty = shopQty + storeQty;
                              const assetVal = totalQty * (p.costPrice || 0);
                              const margin = p.sellingPrice > 0 ? Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100) : 0;
                              const isLow = totalQty <= (p.alertQty || 5) && totalQty > 0;
                              const isOut = totalQty <= 0;
                              return (
                                <div key={p.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                  {/* Product image */}
                                  <div className="w-[60px] h-[60px] shrink-0 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                    {p.image ? (
                                      <CachedImage src={p.image} alt={p.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                                    ) : (
                                      <span className="text-[13px] font-black text-slate-300 dark:text-slate-600">{p.name.slice(0,2).toUpperCase()}</span>
                                    )}
                                  </div>
                                  {/* Info */}
                                  <div className="flex-1 min-w-0 py-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{p.name}</p>
                                      {isOut ? (
                                        <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md shrink-0">OUT</span>
                                      ) : isLow ? (
                                        <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0">LOW</span>
                                      ) : null}
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-0.5">{p.category || 'General'}{p.sku ? ` · ${p.sku}` : ''}</p>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] font-mono">
                                      <span className="text-slate-500">Cost <span className="text-slate-700 dark:text-slate-300 font-bold">{currency}{p.costPrice.toFixed(0)}</span></span>
                                      <span className="text-slate-500">Sell <span className="text-emerald-600 font-bold">{currency}{p.sellingPrice.toFixed(0)}</span></span>
                                      <span className="text-indigo-500 font-bold">{margin}%</span>
                                    </div>
                                    {/* Shop vs Store */}
                                    <div className="flex items-center gap-2 mt-1 text-[9px] font-mono">
                                      <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span className="text-slate-400">Shop <span className="font-bold text-slate-600 dark:text-slate-300">{shopQty}</span></span>
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                                        <span className="text-slate-400">Store <span className="font-bold text-slate-600 dark:text-slate-300">{storeQty}</span></span>
                                      </span>
                                    </div>
                                  </div>
                                  {/* Total + asset value */}
                                  <div className="text-right pr-3.5 shrink-0">
                                    <p className={`text-[15px] font-black font-mono ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-slate-800 dark:text-slate-100'}`}>{totalQty}</p>
                                    <p className="text-[8.5px] text-slate-400 font-mono">{currency}{Math.round(assetVal).toLocaleString()}</p>
                                  </div>
                                </div>
                              );
                            })}
                            {products.length === 0 && (
                              <p className="text-center text-slate-400 py-10 text-sm">No products found</p>
                            )}
                          </div>

                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {reportTab === 'users' && (
                <div className="space-y-4">
                  {(() => {
                    const custMap: Record<string, { count: number; spend: number }> = {};
                    const staffMap: Record<string, { count: number; sales: number }> = {};
                    filteredSales.forEach(s => {
                      const cName = s.customerName || "Walk-In Customer";
                      if (!custMap[cName]) {
                        custMap[cName] = { count: 0, spend: 0 };
                      }
                      custMap[cName].count++;
                      custMap[cName].spend += saleProductRevenue(s);

                      const stF = s.cashierName || "System Operator";
                      if (!staffMap[stF]) {
                        staffMap[stF] = { count: 0, sales: 0 };
                      }
                      staffMap[stF].count++;
                      staffMap[stF].sales += saleProductRevenue(s);
                    });

                    return (
                      <div className="space-y-4 text-left">
                        {/* Summary Metrics Grid */}
                        <div className="native-report-kpi-grid grid grid-cols-2 gap-3">
                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-blue-500">
                              <Users className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Loyal Clients</span>
                            </div>
                            <span className="text-sm font-black text-slate-800 mt-2">{Object.keys(custMap).length} Profiles</span>
                          </div>

                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-emerald-500">
                              <Users className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Active Staff</span>
                            </div>
                            <span className="text-sm font-black text-slate-800 mt-2">{Object.keys(staffMap).length} Operators</span>
                          </div>
                        </div>

                        {/* Customer spend segment */}
                        <div className="space-y-2.5">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono px-1">Customer Spend Ledger</h4>
                          <div className="space-y-2 animate-fade-in">
                            {Object.entries(custMap).map(([name, sum]) => (
                              <div key={name} className="bg-white px-4 py-3 border border-slate-200 rounded-xl shadow-xs text-left flex justify-between items-center">
                                <div>
                                  <span className="text-sm font-bold text-slate-800 block text-left">{name}</span>
                                  <span className="text-xs text-slate-400 block mt-0.5 mt-0.5 text-left">{sum.count} transactions</span>
                                </div>
                                <span className="text-sm font-extrabold text-indigo-650">
                                  {currency}{Math.round(sum.spend).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Staff list */}
                        <div className="space-y-2.5 pt-2">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono px-1">Staff Sales Performance</h4>
                          <div className="space-y-2 animate-fade-in">
                            {Object.entries(staffMap).map(([name, sum]) => (
                              <div key={name} className="bg-white px-4 py-3 border border-slate-200 rounded-xl shadow-xs text-left flex justify-between items-center">
                                <div>
                                  <span className="text-sm font-bold text-slate-800 block text-left">{name}</span>
                                  <span className="text-xs text-slate-400 block mt-0.5 text-left">Approved transactions: {sum.count}</span>
                                </div>
                                <span className="text-sm font-extrabold text-emerald-700">
                                  {currency}{Math.round(sum.sales).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {reportTab === 'expenses' && (
                <div className="space-y-4">
                  {(() => {
                    const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
                    return (
                      <div className="space-y-4 text-left">
                        {/* Summary Metrics Grid */}
                        <div className="native-report-kpi-grid grid grid-cols-2 gap-3">
                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-rose-500">
                              <Receipt className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Expense Logs</span>
                            </div>
                            <span className="text-sm font-black text-rose-600 mt-2">{filteredExpenses.length} Receipts</span>
                          </div>

                          <div className="bg-rose-50 border border-rose-150 p-3 rounded-xl shadow-xs flex flex-col justify-between min-h-[84px] text-left">
                            <div className="flex items-center space-x-1.5 text-rose-600">
                              <DollarSign className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider font-mono">Aggregate Outflow</span>
                            </div>
                            <span className="text-sm font-black text-rose-800 mt-2">{currency}{Math.round(totalSpent).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* List representations */}
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center px-1">
                            <h4 className="text-xs font-semibold text-slate-800">Operating Outflow Logs</h4>
                            <span className="text-[10px] font-mono text-slate-400">{filteredExpenses.length} entries</span>
                          </div>

                          {filteredExpenses.length === 0 ? (
                            <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                              <Receipt className="w-10 h-10 text-slate-355 mb-2" />
                              <h4 className="text-sm font-semibold text-slate-700">No logs found</h4>
                              <p className="text-xs text-slate-400 mt-1 max-w-[180px]">No operating expenses recorded within selected range.</p>
                            </div>
                          ) : (
                            filteredExpenses.slice(0, 30).map((e) => (
                              <div key={e.id} className="bg-white px-4 py-3 border border-slate-200 rounded-xl shadow-xs text-left space-y-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="text-sm font-bold text-slate-800 block">{e.category}</span>
                                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">#{e.id} | {new Date(e.timestamp).toLocaleDateString()}</span>
                                  </div>
                                  <span className="text-sm font-extrabold font-mono text-rose-600">
                                    {currency}{e.amount.toLocaleString(undefined, {minimumFractionDigits: 1})}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 border-t border-slate-100 pt-2 leading-tight">
                                  <strong className="text-slate-700">Debit details:</strong> {e.description}
                                </p>
                                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 pt-1">
                                  <span>Checked by: {e.staffName || 'Admin Operator'}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {reportTab === 'product-monitoring' && (
                <div className="space-y-4">
                  {(() => {
                    const prodPerfMap: Record<string, { id: string; name: string; sku: string; cost: number; price: number; margin: number; sold: number; rev: number; profit: number }> = {};
                    filteredSales.forEach(s => {
                      s.items.forEach(it => {
                        if (!prodPerfMap[it.productId]) {
                          const match = products.find(p => p.id === it.productId);
                          prodPerfMap[it.productId] = {
                            id: it.productId,
                            name: it.productName,
                            sku: match?.sku || '',
                            cost: it.costPriceAtSale ?? match?.costPrice ?? 0,
                            price: it.price,
                            margin: it.price - (it.costPriceAtSale ?? match?.costPrice ?? 0),
                            sold: 0,
                            rev: 0,
                            profit: 0
                          };
                        }
                        prodPerfMap[it.productId].sold += it.qty;
                        prodPerfMap[it.productId].rev += it.qty * it.price;
                        prodPerfMap[it.productId].profit += it.qty * (it.price - prodPerfMap[it.productId].cost);
                      });
                    });
                    const list = Object.values(prodPerfMap).sort((a,b) => b.sold - a.sold);

                    return (
                      <div className="space-y-4 text-left">
                        {/* Dropdown filter */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono text-left">Filter by specific Product:</label>
                          <select
                            value={selectedMonitoredProductId}
                            onChange={(e) => setSelectedMonitoredProductId(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-705 outline-none cursor-pointer"
                          >
                            <option value="all">Compare All Products</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                         {/* Summary Metrics Grid */}
                        {(() => {
                          const isAll = selectedMonitoredProductId === 'all';
                          const matchItems = isAll ? list : list.filter(item => {
                            const pObj = products.find(p => p.id === selectedMonitoredProductId);
                            return item.name === pObj?.name;
                          });

                          const totalUnits = matchItems.reduce((sum, item) => sum + item.sold, 0);
                          const totalRevenue = matchItems.reduce((sum, item) => sum + item.rev, 0);
                          const totalProfit = matchItems.reduce((sum, item) => sum + item.profit, 0);
                          const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

                          return (
                            <>
                              <div className="native-report-kpi-grid grid grid-cols-2 gap-3">
                                <div className={mobileReportKpiCardClass}>
                                  <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest">Units Sold</span>
                        </div>
                        <p className="text-[17px] font-black leading-none text-slate-800 font-mono">{isAll ? `${totalUnits.toLocaleString()} mixed units` : formatProductQuantity(totalUnits, products.find(p => p.id === selectedMonitoredProductId))}</p>
                                </div>

                                <div className={mobileReportKpiCardClass}>
                                  <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest">Gross Income</span>
                        </div>
                        <p className="text-[17px] font-black leading-none text-emerald-600 font-mono">{currency}{Math.round(totalRevenue).toLocaleString()}</p>
                                </div>

                                <div className={mobileReportKpiCardClass}>
                                  <div className="flex items-center space-x-1.5 text-indigo-505">
                                    <Percent className="w-4 h-4" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Average Margin</span>
                                  </div>
                                  <span className="text-sm font-black text-indigo-700 mt-2">{Math.round(avgMargin)}%</span>
                                </div>

                                <div className="bg-emerald-50 border border-emerald-150 p-3 rounded-xl shadow-xs flex flex-col justify-between min-h-[84px] text-left">
                                  <div className="flex items-center space-x-1.5 text-emerald-600">
                                    <TrendingUp className="w-4 h-4" />
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">Net Gross Profit</span>
                                  </div>
                                  <span className="text-sm font-black text-emerald-800 mt-2">{currency}{Math.round(totalProfit).toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Catalog Rankings list */}
                              <div className="space-y-2.5">
                                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 font-sans px-1 text-left">Profitability Rankings Contributions</h4>
                                <div className="space-y-2">
                                  {matchItems.length === 0 ? (
                                    <p className="text-center text-slate-400 italic text-xs py-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">No stats found for product list.</p>
                                  ) : (
                                    matchItems.map((item, idx) => {
                                      const productObj = products.find(p => p.id === item.id) || products.find(p => p.name === item.name);
                                      const thumbSrc = productObj?.image || productObj?.imageBase64 || '';
                                      return (
                                        <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm text-left flex items-center gap-3 pr-4 overflow-hidden animate-fade-in">
                                          {/* Product thumbnail */}
                                          <div className="w-[54px] h-[54px] shrink-0 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            {thumbSrc ? (
                                              <CachedImage
                                                src={thumbSrc}
                                                alt={item.name}
                                                className="w-full h-full object-contain p-1"
                                                referrerPolicy="no-referrer"
                                              />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                                                <span className="text-[11px] font-black text-slate-300 dark:text-slate-600">
                                                  {item.name.slice(0, 2).toUpperCase()}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                          {/* Info */}
                                          <div className="flex-1 min-w-0 py-3">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                              <span className="text-[9px] font-black font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-md">#{idx + 1}</span>
                                              <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 truncate">{item.name}</span>
                                            </div>
                                            <span className="text-[9px] text-slate-400 font-mono">{item.sold} sold · {currency}{item.price.toFixed(0)}/unit</span>
                                          </div>
                                          {/* Profit */}
                                          <div className="text-right shrink-0">
                                            <span className="text-[14px] font-black text-emerald-600 font-mono block">+{currency}{Math.round(item.profit).toLocaleString()}</span>
                                            <span className="text-[9px] text-slate-400">{item.rev > 0 ? Math.round((item.profit/item.rev)*100) : 0}% margin</span>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
              )}

              {reportTab === 'dual-channel' && (
                <div className="space-y-4">
                  {(() => {
                    let retailRevenue = 0;
                    let wholesaleRevenue = 0;
                    let retailCogs = 0;
                    let wholesaleCogs = 0;
                    let retailOrders = 0;
                    let wholesaleOrders = 0;

                    filteredSales.forEach(sale => {
                      const isWholesaleChannel = sale.channel === 'wholesale';
                      if (isWholesaleChannel) {
                        wholesaleOrders++;
                      } else {
                        retailOrders++;
                      }

                      sale.items.forEach(item => {
                        const matchedProduct = products.find(p => p.id === item.productId);
                        if (!matchedProduct) return;

                        const qty = item.qty;
                        const cost = (item.costPriceAtSale ?? (matchedProduct.costPrice || 0));
                        const revenue = qty * item.price;
                        const cogs = qty * cost;

                        if (isWholesaleChannel) {
                          wholesaleRevenue += revenue;
                          wholesaleCogs += cogs;
                        } else {
                          retailRevenue += revenue;
                          retailCogs += cogs;
                        }
                      });
                    });

                    const retailProfit = retailRevenue - retailCogs;
                    const wholesaleProfit = wholesaleRevenue - wholesaleCogs;

                    return (
                      <div className="space-y-4 font-sans text-left">
                        {/* Summary Metrics Grid */}
                        <div className="native-report-kpi-grid grid grid-cols-2 gap-3">
                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-indigo-500">
                              <ShoppingBag className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Retail Sales</span>
                            </div>
                            <span className="text-sm font-black text-slate-820 mt-1">{retailOrders} checkouts</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{currency}{Math.round(retailRevenue).toLocaleString()}</span>
                          </div>

                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-amber-500">
                              <Archive className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-mono">Wholesale Sales</span>
                            </div>
                            <span className="text-sm font-black text-slate-820 mt-1">{wholesaleOrders} checkouts</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{currency}{Math.round(wholesaleRevenue).toLocaleString()}</span>
                          </div>

                          <div className="bg-emerald-50 border border-emerald-150 p-3 rounded-xl shadow-xs flex flex-col justify-between min-h-[84px] text-left">
                            <div className="flex items-center space-x-1.5 text-emerald-600">
                              <TrendingUp className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">Retail Margin</span>
                            </div>
                            <span className="text-sm font-black text-emerald-800 mt-1">{currency}{Math.round(retailProfit).toLocaleString()}</span>
                          </div>

                          <div className="bg-emerald-50 border border-emerald-150 p-3 rounded-xl shadow-xs flex flex-col justify-between min-h-[84px] text-left">
                            <div className="flex items-center space-x-1.5 text-emerald-600">
                              <TrendingUp className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">Wholesale Margin</span>
                            </div>
                            <span className="text-sm font-black text-emerald-800 mt-1">{currency}{Math.round(wholesaleProfit).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Store Catalog product price comparison listing */}
                        <div className="space-y-2.5">
                          <h4 className="text-xs font-semibold text-slate-800 px-1 font-sans text-left">Active Split Wholesale/Retail Profiles</h4>
                          <div className="space-y-2 animate-fade-in">
                            {products.map((p) => (
                              <div key={p.id} className="bg-white px-4 py-3 border border-slate-200 rounded-xl shadow-xs text-left space-y-2">
                                <div className="flex justify-between items-center text-left">
                                  <span className="text-sm font-bold text-slate-800 truncate block max-w-[180px]">{p.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{p.sku || 'N/A'}</span>
                                </div>
                                <div className="border-t border-slate-100 pt-2 grid grid-cols-2 text-[11px] gap-2">
                                  <div className="text-left">
                                    <span className="text-slate-400 block">Retail Price:</span>
                                    <strong className="text-slate-800 font-mono">{currency}{p.sellingPrice.toFixed(1)}</strong>
                                    <span className="block text-emerald-600 font-extrabold text-[10px] mt-0.5">{p.sellInRetail !== false ? '✓ Enabled' : '✖ Disabled'}</span>
                                  </div>
                                  <div className="border-l border-slate-100 pl-3 text-left">
                                    <span className="text-slate-400 block">Wholesale Price:</span>
                                    <strong className="text-slate-800 font-mono">{currency}{(p.wholesalePrice || p.sellingPrice * 0.9).toFixed(1)}</strong>
                                    <span className="block text-emerald-600 font-extrabold text-[10px] mt-0.5">{p.sellInWholesale ? '✓ Enabled' : '✖ Disabled'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {reportTab === 'deliveries' && (
                <div className="space-y-4">
                  {(() => {
                    const validDeliveries = deliveries.filter(d => d.status !== 'Cancelled');
                    const deliveryIncome = validDeliveries.reduce((sum, d) => sum + (Number(d.deliveryCost) || 0), 0);
                    const deliveryExpensesList = expenses.filter(e => e.category === 'Delivery Expense' || e.category === 'Delivery Maintainance');
                    const totalDeliveryExpenses = deliveryExpensesList.reduce((sum, e) => sum + e.amount, 0);
                    const netDeliveryProfit = deliveryIncome - totalDeliveryExpenses;

                    return (
                      <div className="space-y-4 font-sans text-left">
                        {/* Summary Metrics Grid */}
                        <div className="native-report-kpi-grid grid grid-cols-2 gap-3">
                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-slate-500">
                              <Truck className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-405 uppercase tracking-wider font-mono">Fulfillments</span>
                            </div>
                            <span className="text-sm font-black text-slate-800 mt-1">{validDeliveries.length} orders</span>
                          </div>

                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-indigo-500">
                              <DollarSign className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-405 uppercase tracking-wider font-mono">Logistics Rev</span>
                            </div>
                            <span className="text-sm font-black text-slate-800 mt-1">{currency}{deliveryIncome.toLocaleString()}</span>
                          </div>

                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-rose-500">
                              <Receipt className="w-4 h-4" />
                              <span className="text-[10px] font-bold text-slate-405 uppercase tracking-wider font-mono">Fleet Outflow</span>
                            </div>
                            <span className="text-sm font-black text-rose-600 mt-1">{currency}{totalDeliveryExpenses.toLocaleString()}</span>
                          </div>

                          <div className={`${mobileReportToneKpiCardClass} ${netDeliveryProfit >= 0 ? 'bg-emerald-50 border-emerald-150' : 'bg-rose-50 border-rose-150'}`}>
                            <div className="flex items-center space-x-1.5">
                              <TrendingUp className={`w-4 h-4 ${netDeliveryProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
                              <span className={`text-[10px] font-bold uppercase tracking-wider font-mono block ${netDeliveryProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Net value margin</span>
                            </div>
                            <span className={`text-sm font-black mt-1 ${netDeliveryProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                              {netDeliveryProfit >= 0 ? '+' : ''}{currency}{netDeliveryProfit.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* List replacements */}
                        <div className="space-y-2.5 animate-fade-in text-left">
                          <div className="flex justify-between items-center px-1">
                            <h4 className="text-xs font-semibold text-slate-800">Active Logistics List</h4>
                            <span className="text-[10px] font-mono text-slate-400">{validDeliveries.length} entries</span>
                          </div>

                          {validDeliveries.length === 0 ? (
                            <div className="bg-white border border-slate-200 text-center py-10 rounded-xl">
                              <span className="block text-slate-400 text-2xl mb-2">🚚</span>
                              <p className="text-xs text-slate-455 italic">No logistics delivery transactions logged yet.</p>
                            </div>
                          ) : (
                            validDeliveries.slice(0, 30).map((del) => (
                              <div key={del.id} className="bg-white px-4 py-3 border border-slate-200 rounded-xl shadow-xs space-y-2 text-left">
                                <div className="flex justify-between items-start text-left">
                                  <div>
                                    <span className="text-sm font-bold text-slate-800 block truncate max-w-[140px] text-left">{del.customerName}</span>
                                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5 text-left">ID: #{del.id}</span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                                    del.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                                    del.status === 'Dispatched' ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-100 text-slate-800'
                                  }`}>
                                    {del.status}
                                  </span>
                                </div>

                                <div className="border-t border-slate-100 pt-2 grid grid-cols-2 text-[10px] text-slate-500 gap-1.5 leading-none">
                                  <div className="text-left">
                                    <span>Rider/Driver:</span>
                                    <p className="font-bold text-slate-800 mt-1">{del.riderDetails?.name || del.riderId || 'Unassigned'}</p>
                                  </div>
                                  <div className="border-l border-slate-100 pl-3 text-right">
                                    <span>Assigned Fee:</span>
                                    <p className="font-mono font-bold text-indigo-700 mt-1">{currency}{Math.round(del.deliveryCost || 0).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {reportTab === 'velocity' && (() => {
                    const prodSells: Record<string, { name: string; sku: string; barcode: string; cat: string; qty: number }> = {};
                    products.forEach(p => {
                      prodSells[p.id] = { name: p.name, sku: p.sku || '', barcode: p.barcode || '', cat: p.category || '', qty: 0 };
                    });
                    filteredSales.forEach(s => {
                      s.items.forEach(it => {
                        if (prodSells[it.productId]) prodSells[it.productId].qty += it.qty;
                      });
                    });
                    const allSorted = Object.values(prodSells).sort((a, b) => b.qty - a.qty);
                    const mid = Math.ceil(allSorted.length / 2);
                    const fastMovers = allSorted.slice(0, mid);
                    const slowMovers = [...allSorted].slice(mid).sort((a, b) => a.qty - b.qty);
                    const isFastMode = velocitySortOrder === 'desc';
                    const displayList = isFastMode ? fastMovers : slowMovers;
                    const topItem = isFastMode ? fastMovers[0] : slowMovers[0];
                    const totalVelocityUnits = allSorted.reduce((sum, item) => sum + item.qty, 0);

                    return (
                      <div className="space-y-4 text-left">
                        {/* Fast/Slow toggle */}
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1">
                          <button type="button" onClick={() => setVelocitySortOrder('desc')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none ${isFastMode ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 bg-transparent hover:bg-slate-100'}`}>
                            <TrendingUp className="w-3.5 h-3.5" /> Fast Movers
                          </button>
                          <button type="button" onClick={() => setVelocitySortOrder('asc')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none ${!isFastMode ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 bg-transparent hover:bg-slate-100'}`}>
                            <MinusCircle className="w-3.5 h-3.5" /> Slow Movers
                          </button>
                        </div>

                        <div className="native-report-kpi-grid grid grid-cols-2 gap-3">
                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-indigo-500">
                              <Package className="h-4 w-4" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tracked SKUs</span>
                            </div>
                            <span className="mt-2 text-sm font-black text-slate-850 dark:text-white">{allSorted.length} products</span>
                          </div>
                          <div className={mobileReportKpiCardClass}>
                            <div className="flex items-center space-x-1.5 text-emerald-600">
                              <ArrowUpDown className="h-4 w-4" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Units Moved</span>
                            </div>
                            <span className="mt-2 text-sm font-black text-emerald-700">{totalVelocityUnits.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Top card */}
                        <div className={`p-4 rounded-[20px] border shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${isFastMode ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                          <div className={`flex items-center gap-1.5 mb-2 ${isFastMode ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {isFastMode ? <TrendingUp className="w-4 h-4" /> : <MinusCircle className="w-4 h-4" />}
                            <span className="text-[10px] font-black uppercase tracking-wider">{isFastMode ? 'Top Fast Mover' : 'Slowest Mover'}</span>
                          </div>
                          <p className={`text-sm font-black ${isFastMode ? 'text-emerald-900' : 'text-rose-900'}`}>{topItem?.name || 'No data'}</p>
                          <p className={`text-[11px] font-mono mt-1 ${isFastMode ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {topItem?.qty || 0} units sold · {((topItem?.qty || 0) / 30).toFixed(2)}/day
                          </p>
                        </div>

                        {/* Product list */}
                        <div className="space-y-2">
                          <p className="text-[9px] font-black tracking-widest uppercase text-slate-400 px-1">
                            {isFastMode ? '🔥 Fast Moving Products' : '🐢 Slow Moving Products'}
                          </p>
                          {displayList.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                              <p className="text-sm font-semibold">No data available</p>
                              <p className="text-xs mt-1">Record sales to see velocity data</p>
                            </div>
                          ) : displayList.map((item, idx) => {
                            const productObj = products.find(p => p.name === item.name);
                            const thumbSrc = productObj?.image || productObj?.imageBase64 || '';
                            const velocityPerDay = (item.qty / 30).toFixed(2);
                            return (
                              <div key={idx} className={`flex items-center bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden shadow-sm ${isFastMode ? 'border-emerald-100 dark:border-emerald-900/40' : 'border-rose-100 dark:border-rose-900/40'}`}>
                                {/* Left: product image */}
                                <div className="w-[56px] h-[56px] shrink-0 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                  {thumbSrc ? (
                                    <CachedImage src={thumbSrc} alt={item.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-[11px] font-black text-slate-300 dark:text-slate-600">{item.name.slice(0,2).toUpperCase()}</span>
                                  )}
                                </div>
                                {/* Middle: info */}
                                <div className="flex-1 min-w-0 py-3 px-3">
                                  <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                                  <p className="text-[9px] text-slate-400 mt-0.5">{item.cat || 'Uncategorized'}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black font-mono text-slate-700 dark:text-slate-300">{item.qty} units</span>
                                    <span className={`text-[10px] font-bold font-mono ${isFastMode ? 'text-emerald-600' : 'text-rose-500'}`}>{velocityPerDay}/day</span>
                                  </div>
                                </div>
                                {/* Right: rank */}
                                <div className={`w-8 shrink-0 flex items-center justify-center py-4 text-[10px] font-black ${isFastMode ? 'text-emerald-600' : 'text-rose-500'}`}>
                                  {idx + 1}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: CREATE NEW EXPENSE MODAL */}
      {/* ------------------------------------------------------------- */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-rose-600" />
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Record Branch Expense</h4>
              </div>
              <button 
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-705 cursor-pointer transition-colors"
                type="button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLogExpense} className="p-6 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Select Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Debit Amount ({currency})</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  step="0.01"
                  min="0.1"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 px-4 py-2.5 rounded-2xl font-mono text-slate-800 text-sm outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Charges Description / Specs</label>
                <textarea
                  placeholder="Wrote check for..."
                  rows={2}
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 px-3.5 py-2.5 rounded-2xl text-xs text-slate-800 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
                  Receipt Voucher Image
                </label>
                
                {expenseImage ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2 group">
                    <img
                      src={expenseImage}
                      alt="Receipt attached"
                      className="w-full h-32 object-contain rounded-xl bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setExpenseImage('')}
                      className="absolute top-3 right-3 w-6 h-6 bg-slate-900/85 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] transition-colors cursor-pointer border-none shadow-md"
                      title="Remove Image"
                    >
                      ✕
                    </button>
                    <div className="text-center mt-1.5 text-[10px] text-slate-500 font-mono font-bold">
                      Receipt Attached (Compressed)
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => document.getElementById('receipt-upload-input')?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 transition-all text-center cursor-pointer flex flex-col items-center justify-center space-y-1.5 ${
                      dragActive
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <input
                      id="receipt-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImageChange(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <UploadCloud className={`w-6 h-6 ${dragActive ? 'text-rose-600' : 'text-slate-400'}`} />
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-bold text-slate-700">
                        Select Receipt Image
                      </p>
                      <p className="text-[9px] text-slate-500 font-medium">
                        Drag & drop here, or click to browse
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-rose-500/5 rounded-2xl text-[10.5px] text-rose-800 leading-relaxed font-sans border border-rose-100">
                <p className="font-bold uppercase tracking-wider mb-0.5">Physical Audit requirement</p>
                To comply with central GAAP branch logs, an automated visual file voucher reference <span className="font-mono font-bold bg-white text-rose-700 px-1 py-0.2 rounded inline-block">RCPT-SIM-xxxxx</span> will be tied.
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="py-3 bg-white hover:bg-slate-100 border border-slate-220 rounded-xl text-xs font-bold text-slate-600 uppercase tracking-wider font-sans transition-all cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider font-sans transition-all cursor-pointer shadow-md shadow-rose-500/10"
                >
                  Commit ledger
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: VIEW ATTACHED RECEIPT OVERLAY */}
      {/* ------------------------------------------------------------- */}
      {previewReceiptImage && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewReceiptImage(null)}
        >
          <div 
            className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                Receipt Attachment Viewer
              </span>
              <button
                type="button"
                onClick={() => setPreviewReceiptImage(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer border-none"
              >
                ✕
              </button>
            </div>
            
            <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 mt-3 flex items-center justify-center min-h-[220px] max-h-[50vh] overflow-hidden">
              <img
                src={previewReceiptImage}
                alt="Attached receipt voucher"
                className="max-w-full max-h-[45vh] object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setPreviewReceiptImage(null)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider font-sans cursor-pointer transition-all active:scale-95 text-center"
              >
                Close Receipt View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: INSPECT INDIVIDUAL TRANSACTION RECEIPT */}
      {/* ------------------------------------------------------------- */}
      {selectedInspectSale && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedInspectSale(null)}
        >
          <div 
            className="relative bg-white border border-slate-250 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono">Invoice Audit Ledger</h4>
              </div>
              <button 
                onClick={() => setSelectedInspectSale(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer transition-colors text-sm"
                type="button"
              >
                ✕
              </button>
            </div>

            {/* Receipt Thermal Scroll Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(70dvh-56px-env(safe-area-inset-bottom))] bg-slate-50">
              <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-4">
                
                {/* Brand Banner */}
                <div className="text-center pb-3 border-b border-dashed border-slate-200">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight font-sans leading-none">{activeTenant.name}</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-1.5 uppercase tracking-wider">
                    {activeTenant.businessType === 'pharmacy' ? 'Clinical Pharmacy Dispensary' : activeTenant.businessType === 'restaurant' ? 'Hospitality & Diner' : 'General Merchant Office'}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">{activeTenant.city}, West Africa Ops</p>
                </div>

                {/* Metadata details */}
                <div className="space-y-1.5 text-[10.5px] border-b border-dashed border-slate-200 pb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Document ID:</span>
                    <span className="font-mono font-bold text-slate-800 select-all">{selectedInspectSale.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date/Time:</span>
                    <span className="text-slate-800 font-mono">{new Date(selectedInspectSale.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {activeTenant.businessType === 'pharmacy' ? 'Patient:' : 'Customer Name:'}
                    </span>
                    <span className="font-bold text-slate-800">
                      {selectedInspectSale.customerName || (activeTenant.businessType === 'pharmacy' ? 'Walk-In Patient' : 'Walk-In Customer')}
                    </span>
                  </div>
                  {selectedInspectSale.customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone Code:</span>
                      <span className="font-mono font-bold text-slate-600">{selectedInspectSale.customerPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {activeTenant.businessType === 'pharmacy' ? 'Dispensed By:' : 'Prepared By:'}
                    </span>
                    <span className="font-bold text-slate-800">{selectedInspectSale.cashierName || 'Primary Staff Member'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Mode:</span>
                    <span className="font-extrabold uppercase text-emerald-700">{selectedInspectSale.paymentMethod}</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2 border-b border-dashed border-slate-200 pb-3">
                  <div className="grid grid-cols-12 font-bold text-[10.5px] text-slate-400 uppercase tracking-wider">
                    <span className="col-span-7">Specified Item</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-3 text-right">Amount</span>
                  </div>
                  {selectedInspectSale.items.map((item, index) => {
                    const discountRate = item.discount || 0;
                    const netUnit = item.price * (1 - discountRate / 100);
                    return (
                      <div key={index} className="grid grid-cols-12 text-[10.5px] font-sans gap-y-0.5 text-slate-800">
                        <span className="col-span-7 leading-tight font-medium">
                          {item.productName}
                          {discountRate > 0 && (
                            <span className="block text-[9px] text-rose-500 font-bold">-{discountRate}% promo discount</span>
                          )}
                        </span>
                        <span className="col-span-2 text-center font-bold text-slate-600">{formatSaleItemQuantity(item, products.find(product => product.id === item.productId))}</span>
                        <span className="col-span-3 text-right font-mono font-semibold">
                          {currency}{Math.round(netUnit * item.qty).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="space-y-1.5 text-right font-bold text-xs">
                  <div className="flex justify-between text-slate-500 font-normal">
                    <span>Subtotal Price</span>
                    <span className="font-mono">{currency}{Math.round(selectedInspectSale.total - (selectedInspectSale.tax || 0)).toLocaleString()}</span>
                  </div>
                  {selectedInspectSale.tax > 0 && (
                    <div className="flex justify-between text-slate-500 font-normal">
                      <span>Statutory VAT ({activeTenant.taxRate * 100}%)</span>
                      <span className="font-mono">{currency}{Math.round(selectedInspectSale.tax).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm border-t border-slate-200 pt-2 text-slate-900 font-black">
                    <span>PAID TOTAL</span>
                    <span className="font-mono text-emerald-800 text-sm">{currency}{Math.round(selectedInspectSale.total).toLocaleString()}</span>
                  </div>
                </div>

                {/* TRA VFD control if VAT was registered */}
                {selectedInspectSale.vfdControlNo && (
                  <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-3 space-y-1 text-[9.5px] leading-relaxed text-slate-700 text-left">
                    <p className="font-bold text-[10px] text-emerald-800 uppercase tracking-widest text-center border-b border-dashed border-emerald-250 pb-1 mb-1.5 font-sans">
                      TRA VFD FISCAL RECEIPT
                    </p>
                    <div className="flex justify-between font-mono">
                      <span>VFD Serial No:</span>
                      <span className="font-bold text-slate-800">TZ-VFD-REG-847294B</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>TRA Control No:</span>
                      <span className="font-bold text-emerald-950">{selectedInspectSale.vfdControlNo}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>Receipt PIN:</span>
                      <span className="font-black text-rose-800 shrink-0 uppercase select-all">{selectedInspectSale.vfdSignature || 'VERIFIED'}</span>
                    </div>
                    <p className="text-[8px] text-emerald-600 text-center italic mt-1 font-sans">
                      ✓ Registered with Tanzania Revenue Authority Gateway VFD Server.
                    </p>
                  </div>
                )}

                {/* Footer Notes */}
                <div className="text-center text-[9px] text-slate-400 border-t border-dashed border-slate-200 pt-3 leading-relaxed">
                  <p>Thank you for shopping with us!</p>
                  <p className="font-mono font-bold">Powered by: jasper.africa</p>
                </div>

              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  alert("Opening Jasper Thermal Printer: Simulating direct 50mm POS thermal receipt print.");
                }}
                className="py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase hover:bg-slate-800 transition-all text-center cursor-pointer active:scale-95 shadow-sm"
              >
                Print Ticket
              </button>
              <button
                type="button"
                className="py-2.5 bg-white border border-slate-250 text-slate-705 rounded-xl text-xs font-bold uppercase hover:bg-slate-50 transition-all text-center cursor-pointer"
                onClick={() => setSelectedInspectSale(null)}
              >
                Close Audit
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PRINT-ONLY A4 SYSTEM PDF AUDIT STATEMENT */}
      {/* ------------------------------------------------------------- */}
      <div id="reports-a4-pdf-template" className="hidden print:block printable-area bg-white text-black p-8 max-w-4xl mx-auto font-sans leading-relaxed text-[10px] normal-case">
        {/* Document Header */}
        <div className="border-b-2 border-slate-905 pb-4 mb-5 flex justify-between items-start">
          <div>
            <span className="text-[8px] uppercase tracking-wider font-mono font-bold bg-slate-905 text-white px-2 py-0.5 rounded">
              Official Branch Accounts Report File
            </span>
            <h1 className="text-xl font-bold font-sans mt-1.5 text-slate-900 uppercase">
              {activeTenant.name} Audit Ledger
            </h1>
            <p className="text-[9.5px] text-slate-505 font-medium font-sans mt-0.5">
              Location: {activeTenant.city} | Branch ID: {activeTenant.id} | Base Currency: {currency}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-bold block text-slate-800">A4 AUDIT STATEMENT</span>
            <span className="text-[9px] text-slate-505 font-mono block mt-1">Date: {new Date().toLocaleString()}</span>
            <span className="text-[9px] text-slate-505 font-mono block mt-0.5">Author ID: {userName}</span>
            <span className="text-[9px] text-slate-505 font-mono block mt-0.5">Scope Period: {startDateStr} — {endDateStr}</span>
          </div>
        </div>

        {/* Dynamic content wrapper based on active reportTab */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold uppercase font-mono tracking-wider border-b pb-1.5 border-slate-200">
            Active Statement Segment: {reportTab.replace('-', ' ').toUpperCase()}
          </h2>

          {/* TAB: P&L SUMMARY */}
          {reportTab === 'p&l' && (
            <div className="space-y-4">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                    <th className="p-2">Financial Statement Line Item</th>
                    <th className="p-2 text-right">Value ({currency})</th>
                    <th className="p-2 text-right">Proportion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 font-medium">total sales</td>
                    <td className="p-2 text-right font-mono font-bold">{currency}{Math.round(totalSalesRevenue).toLocaleString()}</td>
                    <td className="p-2 text-right">100.0%</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">cost of goods sold</td>
                    <td className="p-2 text-right font-mono text-rose-700">({currency}{Math.round(totalCOGS).toLocaleString()})</td>
                    <td className="p-2 text-right text-rose-700">-{totalSalesRevenue > 0 ? ((totalCOGS / totalSalesRevenue) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                  <tr className="bg-emerald-50">
                    <td className="p-2 font-bold text-emerald-950">Gross profit</td>
                    <td className="p-2 text-right font-mono font-black text-emerald-950">{currency}{Math.round(grossProfit).toLocaleString()}</td>
                    <td className="p-2 text-right font-bold text-emerald-950">{totalSalesRevenue > 0 ? ((grossProfit / totalSalesRevenue) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">total expenses</td>
                    <td className="p-2 text-right font-mono text-rose-705">({currency}{Math.round(totalExpensesCharged).toLocaleString()})</td>
                    <td className="p-2 text-right text-rose-705">-{totalSalesRevenue > 0 ? ((totalExpensesCharged / totalSalesRevenue) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                  <tr className={`font-bold ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-950' : 'bg-rose-50 text-rose-950'}`}>
                    <td className="p-2 text-[11px]">net profit</td>
                    <td className="p-2 text-right font-mono font-black text-[11px]">{netProfit < 0 ? '-' : ''}{currency}{Math.abs(Math.round(netProfit)).toLocaleString()}</td>
                    <td className="p-2 text-right text-[11px]">{totalSalesRevenue > 0 ? ((netProfit / totalSalesRevenue) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide mb-2">Expenses Allocation Index</h3>
                <div className="grid grid-cols-2 gap-4">
                  {expensesBreakdown.map(cat => {
                    const pct = totalExpensesCharged > 0 ? (cat.value / totalExpensesCharged) * 100 : 0;
                    return (
                      <div key={cat.name} className="flex justify-between border-b pb-1">
                        <span className="text-slate-600">{cat.name}</span>
                        <span className="font-mono font-bold">{currency}{cat.value.toLocaleString()} ({Math.round(pct)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: SALES REPORT */}
          {reportTab === 'sales-report' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[8px] text-slate-400 block font-mono uppercase">Sales count</span>
                  <span className="font-bold text-xs">{salesReportMetrics.totalOrders} Tickets</span>
                </div>
                <div>
                  <span className="text-[8px] text-slate-400 block font-mono uppercase">Revenue gen.</span>
                  <span className="font-bold text-xs text-emerald-800">{currency}{Math.round(salesReportMetrics.totalRevenue).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[8px] text-emerald-600 block font-mono uppercase">Paid revenue</span>
                  <span className="font-bold text-xs text-slate-700">{currency}{Math.round(salesReportMetrics.paidRevenue).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[8px] text-amber-600 block font-mono uppercase">Unpaid credit</span>
                  <span className="font-bold text-xs text-amber-700">{currency}{Math.round(salesReportMetrics.unpaidRevenue).toLocaleString()}</span>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <span className="text-[8px] text-indigo-600 block font-mono uppercase">Profit generated</span>
                  <span className="font-bold text-xs text-indigo-700">{currency}{Math.round(salesReportMetrics.totalProfit).toLocaleString()}</span>
                </div>
              </div>

              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300 text-[9px]">
                    <th className="p-1.5">Ref ID</th>
                    <th className="p-1.5">Date</th>
                    <th className="p-1.5">Customer Name</th>
                    <th className="p-1.5">Items Sold</th>
                    <th className="p-1.5 text-center">Channel</th>
                    <th className="p-1.5 text-right">Tax</th>
                    <th className="p-1.5 text-right font-black">Gross Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recordsFilteredSales.map(sale => (
                    <tr key={sale.id}>
                      <td className="p-1.5 font-mono font-bold text-indigo-900">{sale.id}</td>
                      <td className="p-1.5 whitespace-nowrap font-mono text-[9px]">{new Date(sale.timestamp).toLocaleDateString()}</td>
                      <td className="p-1.5 font-bold">{sale.customerName || 'Walk-In Customer'}</td>
                      <td className="p-1.5 truncate max-w-[200px]">{sale.items.map(it => `${it.qty}x ${it.productName}`).join(', ')}</td>
                      <td className="p-1.5 text-center font-mono uppercase text-[9px]">{sale.paymentMethod}</td>
                      <td className="p-1.5 text-right font-mono">{currency}{sale.tax.toFixed(1)}</td>
                      <td className="p-1.5 text-right font-mono font-bold">{currency}{sale.total.toFixed(1)}</td>
                    </tr>
                  ))}
                  {recordsFilteredSales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400 italic">No sales transactions logged within range timescale.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: PAYMENTS */}
          {reportTab === 'payments' && (
            <div className="space-y-4">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                    <th className="p-2">Payment Mode Channel</th>
                    <th className="p-2 text-right">Aggregate Settled ({currency})</th>
                    <th className="p-2 text-right">Proportion Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.entries(paymentBreakdown).map(([channel, amount]) => {
                    const totalSum = Object.values(paymentBreakdown).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={channel}>
                        <td className="p-2 font-bold">
                          {channel === 'CardAndOnline' ? 'Card & Online' :
                           channel === 'MobileMoney' ? 'Mobile Money' :
                           channel === 'BankTransfer' ? 'Bank Transfer' : channel}
                        </td>
                        <td className="p-2 text-right font-mono">{currency}{amount.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono font-black">{totalSum > 0 ? ((amount / totalSum) * 100).toFixed(1) : '0.0'}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: INVENTORY */}
          {reportTab === 'inventory' && (
            <div className="space-y-2">
              {products.map(p => {
                const stockQty = p.shopStockQty ?? p.stockQty ?? 0;
                const assetVal = stockQty * (p.costPrice || 0);
                const margin = p.sellingPrice > 0 ? Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100) : 0;
                const isLow = stockQty <= (p.alertQty || 5) && stockQty > 0;
                const isOut = stockQty <= 0;
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    {/* Product image */}
                    <div className="w-[60px] h-[60px] shrink-0 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                      {p.image ? (
                        <CachedImage src={p.image} alt={p.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-[13px] font-black text-slate-300 dark:text-slate-600">{p.name.slice(0,2).toUpperCase()}</span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{p.name}</p>
                        {isOut ? (
                          <span className="text-[9px] font-black text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded-md shrink-0">OUT</span>
                        ) : isLow ? (
                          <span className="text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md shrink-0">LOW</span>
                        ) : null}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-0.5">{p.category || 'General'}{p.sku ? ` · ${p.sku}` : ''}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono">
                        <span className="text-slate-500">Cost <span className="text-slate-700 dark:text-slate-300 font-bold">{currency}{p.costPrice.toFixed(0)}</span></span>
                        <span className="text-slate-500">Sell <span className="text-emerald-600 font-bold">{currency}{p.sellingPrice.toFixed(0)}</span></span>
                        <span className="text-indigo-500 font-bold">{margin}%</span>
                      </div>
                      {/* Shop vs Store breakdown */}
                      <div className="flex items-center gap-2 mt-1 text-[9px] font-mono">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          <span className="text-slate-400">Shop <span className="font-bold text-slate-600 dark:text-slate-300">{p.shopStockQty ?? 0}</span></span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                          <span className="text-slate-400">Store <span className="font-bold text-slate-600 dark:text-slate-300">{p.storeStockQty ?? 0}</span></span>
                        </span>
                      </div>
                    </div>
                    {/* Stock + value */}
                    <div className="text-right pr-3.5 shrink-0">
                      <p className={`text-[15px] font-black font-mono ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-slate-800 dark:text-slate-100'}`}>{stockQty}</p>
                      <p className="text-[8.5px] text-slate-400 font-mono">{currency}{Math.round(assetVal).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
              {products.length === 0 && (
                <p className="text-center text-slate-400 py-10 text-sm">No products found</p>
              )}
            </div>
          )}


          {/* TAB: USERS */}
          {reportTab === 'users' && (() => {
            const custMap: Record<string, { count: number; spend: number }> = {};
            const staffMap: Record<string, { count: number; sales: number }> = {};
            filteredSales.forEach(s => {
              const cName = s.customerName || "Walk-In Customer";
              if (!custMap[cName]) {
                custMap[cName] = { count: 0, spend: 0 };
              }
              custMap[cName].count++;
              custMap[cName].spend += saleProductRevenue(s);

              const stF = s.cashierName || "System Operator";
              if (!staffMap[stF]) {
                staffMap[stF] = { count: 0, sales: 0 };
              }
              staffMap[stF].count++;
              staffMap[stF].sales += saleProductRevenue(s);
            });

            return (
              <div className="space-y-4">
                <h3 className="font-bold text-xs uppercase border-b pb-1">Primary Customer Loyalty Segment</h3>
                <table className="w-full text-left font-sans text-[9px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-300">
                      <th className="p-1.5">Registered Customer</th>
                      <th className="p-1.5 text-right">Transactions Count</th>
                      <th className="p-1.5 text-right">Accrued Spend Sum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(custMap).map(([name, sum]) => (
                      <tr key={name}>
                        <td className="p-1.5 font-bold">{name}</td>
                        <td className="p-1.5 text-right font-mono">{sum.count} orders</td>
                        <td className="p-1.5 text-right font-mono font-black text-indigo-900">{currency}{Math.round(sum.spend).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3 className="font-bold text-xs uppercase border-b pb-1 mt-4">Branch Staff Performance Ledger</h3>
                <table className="w-full text-left font-sans text-[9px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-300">
                      <th className="p-1.5">Staff Code Name</th>
                      <th className="p-1.5 text-right">Approved Orders Ticket Volume</th>
                      <th className="p-1.5 text-right">Gross Receipts Checked-In</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(staffMap).map(([name, sum]) => (
                      <tr key={name}>
                        <td className="p-1.5 font-bold">{name}</td>
                        <td className="p-1.5 text-right font-mono">{sum.count} sales</td>
                        <td className="p-1.5 text-right font-mono font-black text-emerald-805">{currency}{Math.round(sum.sales).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* TAB: EXPENSES */}
          {reportTab === 'expenses' && (
            <div className="space-y-4">
              <table className="w-full text-left font-sans text-[9.5px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                    <th className="p-2">Expense ID</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Amount Price</th>
                    <th className="p-2">staff log ID</th>
                    <th className="p-2">Logged Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredExpenses.map(e => (
                    <tr key={e.id}>
                      <td className="p-2 font-mono text-rose-800 font-bold">{e.id}</td>
                      <td className="p-2 font-semibold text-slate-800">{e.category}</td>
                      <td className="p-2">{e.description}</td>
                      <td className="p-2 text-right font-mono font-bold text-rose-705">{currency}{e.amount.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                      <td className="p-2">{e.staffName || 'Admin'}</td>
                      <td className="p-2 font-mono">{new Date(e.timestamp).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 italic">No expenses found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: PRODUCT PERFORMANCE / MONITORING */}
          {reportTab === 'product-monitoring' && (() => {
            const prodPerfMap: Record<string, { name: string; sku: string; cost: number; price: number; margin: number; sold: number; rev: number; profit: number }> = {};
            filteredSales.forEach(s => {
              s.items.forEach(it => {
                if (!prodPerfMap[it.productId]) {
                  const match = products.find(p => p.id === it.productId);
                  prodPerfMap[it.productId] = {
                    name: it.productName,
                    sku: match?.sku || '',
                    cost: it.costPriceAtSale ?? match?.costPrice ?? 0,
                    price: it.price,
                    margin: it.price - (it.costPriceAtSale ?? match?.costPrice ?? 0),
                    sold: 0,
                    rev: 0,
                    profit: 0
                  };
                }
                prodPerfMap[it.productId].sold += it.qty;
                prodPerfMap[it.productId].rev += it.qty * it.price;
                prodPerfMap[it.productId].profit += it.qty * (it.price - prodPerfMap[it.productId].cost);
              });
            });
            const list = Object.values(prodPerfMap).sort((a,b) => b.sold - a.sold);

            return (
              <div className="space-y-4">
                <table className="w-full text-left font-sans text-[9px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-300">
                      <th className="p-1.5">Rank</th>
                      <th className="p-1.5">Product Name</th>
                      <th className="p-1.5">Product SKU</th>
                      <th className="p-1.5 text-right">Cost Price</th>
                      <th className="p-1.5 text-right">Selling Price</th>
                      <th className="p-1.5 text-right">Units Sold</th>
                      <th className="p-1.5 text-right">Money Earned</th>
                      <th className="p-1.5 text-right">Profit Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((item, idx) => (
                      <tr key={item.sku + idx}>
                        <td className="p-1.5 font-mono font-bold">{idx + 1}</td>
                        <td className="p-1.5 font-bold">{item.name}</td>
                        <td className="p-1.5 font-mono text-[8px]">{item.sku || 'N/A'}</td>
                        <td className="p-1.5 text-right font-mono">{currency}{item.cost.toFixed(1)}</td>
                        <td className="p-1.5 text-right font-mono">{currency}{item.price.toFixed(1)}</td>
                        <td className="p-1.5 text-right font-mono font-black">{formatProductQuantity(item.sold, products.find(p => p.sku === item.sku || p.name === item.name))}</td>
                        <td className="p-1.5 text-right font-mono">{currency}{Math.round(item.rev).toLocaleString()}</td>
                        <td className="p-1.5 text-right font-mono font-bold text-emerald-900">{currency}{Math.round(item.profit).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* TAB: DUAL CHANNEL */}
          {reportTab === 'dual-channel' && (
            <div className="space-y-4">
              <table className="w-full text-left font-sans text-[9px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                    <th className="p-1.5">Product name</th>
                    <th className="p-1.5">SKU Code</th>
                    <th className="p-1.5 text-right">Unit cost</th>
                    <th className="p-1.5 text-right">Retail Price</th>
                    <th className="p-1.5 text-right">Wholesale Price</th>
                    <th className="p-1.5 text-right">Wholesale Min Limit</th>
                    <th className="p-1.5 text-center">Retail Status</th>
                    <th className="p-1.5 text-center">Wholesale Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => (
                    <tr key={p.id}>
                      <td className="p-1.5 font-bold">{p.name}</td>
                      <td className="p-1.5 font-mono text-[8px]">{p.sku || 'N/A'}</td>
                      <td className="p-1.5 text-right font-mono">{currency}{p.costPrice.toFixed(1)}</td>
                      <td className="p-1.5 text-right font-mono">{currency}{p.sellingPrice.toFixed(1)}</td>
                      <td className="p-1.5 text-right font-mono">{currency}{(p.wholesalePrice || p.sellingPrice * 0.9).toFixed(1)}</td>
                      <td className="p-1.5 text-right font-mono">{formatProductQuantity(p.minWholesaleQty || 10, p)}</td>
                      <td className="p-1.5 text-center">{p.sellInRetail !== false ? '✅ Active' : '❌ Disabled'}</td>
                      <td className="p-1.5 text-center">{p.sellInWholesale ? '✅ Active' : '❌ Disabled'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* DELIVERY REPORT */}
          {reportTab === 'deliveries' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-500" />
                  Fleet & Logistics Delivery Analytics
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Delivery revenue and routes.
                </p>
              </div>

              {(() => {
                const validDeliveries = deliveries.filter(d => d.status !== 'Cancelled');
                const deliveryIncome = validDeliveries.reduce((sum, d) => sum + (Number(d.deliveryCost) || 0), 0);
                
                // Expenses analysis
                const deliveryExpensesList = expenses.filter(e => e.category === 'Delivery Expense' || e.category === 'Delivery Maintainance');
                const totalDeliveryExpenses = deliveryExpensesList.reduce((sum, e) => sum + e.amount, 0);
                const netDeliveryProfit = deliveryIncome - totalDeliveryExpenses;

                // Location analysis
                const locations: Record<string, number> = {};
                validDeliveries.forEach(d => {
                  let loc = 'Unspecified';
                  if (d.notes && d.notes.trim().length > 0) {
                    loc = d.notes.split('\n')[0].substring(0, 30); // Extract first line or part of it
                  } else if (d.riderDetails?.deliveryAddress) {
                    loc = d.riderDetails.deliveryAddress.split('\n')[0].substring(0, 30);
                  }
                  locations[loc] = (locations[loc] || 0) + 1;
                });
                
                const topLocations = Object.entries(locations)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10); // Top 10 locations

                return (
                  <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="mobile-tablet-kpi-grid gap-3 sm:gap-4" style={{ ['--desktop-kpi-columns' as any]: 'repeat(4, minmax(0, 1fr))' }}>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                        <span className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider mb-2">Total Deliveries</span>
                        <span className="text-2xl font-black text-slate-800">{validDeliveries.length}</span>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                        <span className="block text-[10px] font-mono font-bold uppercase text-indigo-600 tracking-wider mb-2">Total Delivery Revenue</span>
                        <span className="text-2xl font-black font-mono text-indigo-900">{currency}{deliveryIncome.toLocaleString()}</span>
                      </div>
                      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0">
                        <span className="block text-[10px] font-mono font-bold uppercase text-rose-600 tracking-wider mb-2">Fleet Expenses</span>
                        <span className="text-2xl font-black font-mono text-rose-900">{currency}{totalDeliveryExpenses.toLocaleString()}</span>
                      </div>
                      <div className={`rounded-2xl p-4 text-center border shadow-[0_8px_24px_rgba(15,23,42,0.045)] min-w-0 ${netDeliveryProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <span className={`block text-[10px] font-mono font-bold uppercase tracking-wider mb-2 ${netDeliveryProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Net Value Generated</span>
                        <span className={`text-2xl font-black font-mono ${netDeliveryProfit >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                          {netDeliveryProfit >= 0 ? '+' : ''}{currency}{netDeliveryProfit.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Income by Payment Method */}
                      <div className="bg-white border text-left border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col md:col-span-2">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                          <h4 className="font-bold text-xs text-slate-800 tracking-tight uppercase">Delivery Revenue by Payment Method</h4>
                        </div>
                        <div className="p-4 flex gap-4 overflow-x-auto">
                          {(() => {
                            const incomeByMethod: Record<string, number> = {};
                            validDeliveries.forEach(d => {
                              const method = d.deliveryPaymentMethod || 'Unspecified';
                              incomeByMethod[method] = (incomeByMethod[method] || 0) + (d.fee || d.deliveryCost || 0);
                            });
                            
                            const sortedMethods = Object.entries(incomeByMethod)
                              .filter(([_, amount]) => amount > 0)
                              .sort(([_, a], [__, b]) => b - a);
                              
                            if (sortedMethods.length === 0) {
                              return <p className="text-center text-slate-400 italic text-xs py-4 w-full">No delivery revenue.</p>;
                            }

                            return sortedMethods.map(([method, amount], idx) => (
                              <div key={idx} className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center min-w-[140px] shrink-0">
                                <span className="block text-[9px] font-mono font-bold uppercase text-indigo-600 tracking-wider mb-2 truncate" title={method}>{method}</span>
                                <span className="text-lg font-black font-mono text-indigo-900">{currency}{amount.toLocaleString()}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Top Locations Graph & List */}
                      <div className="bg-white border text-left border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                          <h4 className="font-bold text-xs text-slate-800 tracking-tight uppercase">Delivery Locations Overview</h4>
                        </div>
                        <div className="p-4 flex flex-col">
                          {topLocations.length === 0 ? (
                            <p className="text-center text-slate-400 italic text-xs py-10">No delivery locations.</p>
                          ) : (
                            <>
                              <div className="h-48 w-full mb-4">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 640, height: 192 }}>
                                  <PieChart>
                                    <Pie
                                      data={topLocations.map(([name, value]) => ({ name, value }))}
                                      dataKey="value"
                                      nameKey="name"
                                      cx="50%"
                                      cy="50%"
                                      outerRadius={65}
                                      innerRadius={35}
                                      paddingAngle={2}
                                      label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                                        const RADIAN = Math.PI / 180;
                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                        const percent = (value / validDeliveries.length) * 100;
                                        return (
                                          <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight="bold">
                                            {percent.toFixed(0)}%
                                          </text>
                                        );
                                      }}
                                    >
                                      {topLocations.map((entry, index) => {
                                        const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
                                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                                      })}
                                    </Pie>
                                    <Tooltip wrapperClassName="text-xs font-mono font-bold uppercase rounded-xl border border-slate-200" />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Fleet Expenses Breakdown Graph */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col text-left">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                          <h4 className="font-bold text-xs text-slate-800 tracking-tight uppercase">Expenses Breakdown</h4>
                        </div>
                        <div className="p-4 flex-grow">
                          {(() => {
                            const expenseGroups: Record<string, number> = {};
                            deliveryExpensesList.forEach(e => {
                              // Group similar expenses (e.g., fuel, oil, maitenance)
                              const desc = e.description.toLowerCase();
                              let group = 'Other';
                              if (desc.includes('oil')) group = 'Oil & Lubricants';
                              else if (desc.includes('fuel') || desc.includes('petrol') || desc.includes('gas')) group = 'Fuel';
                              else if (desc.includes('service') || desc.includes('repair') || desc.includes('maintainance')) group = 'Maintenance';
                              else if (desc.includes('salary') || desc.includes('wage')) group = 'Wages';
                              
                              expenseGroups[group] = (expenseGroups[group] || 0) + e.amount;
                            });
                            const groupedExpenses = Object.entries(expenseGroups).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

                            if (groupedExpenses.length === 0) {
                              return <p className="text-center text-slate-400 italic text-xs py-10">No fleet expenses logged yet.</p>;
                            }

                            return (
                              <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 640, height: 192 }}>
                                  <BarChart data={groupedExpenses} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} />
                                    <XAxis type="number" fontSize={10} tickFormatter={(val) => `${currency}${val}`} />
                                    <YAxis type="category" dataKey="name" fontSize={10} width={80} />
                                    <Tooltip 
                                      cursor={{fill: '#f1f5f9'}}
                                      formatter={(value: number) => [`${currency}${value.toLocaleString()}`, 'Cost']}
                                      wrapperClassName="text-xs font-mono font-bold uppercase rounded-xl shadow-xs"
                                    />
                                    <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Deliveries Detailed Listing */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <h4 className="font-bold text-xs text-slate-800 tracking-tight uppercase">Recent Deliveries Details</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                              <th className="p-3">Ref ID</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Customer</th>
                              <th className="p-3">Cost Assigned</th>
                              <th className="p-3">Rider/Driver</th>
                              <th className="p-3">Payment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {validDeliveries.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center p-6 text-slate-500 italic">No delivery data.</td>
                              </tr>
                            ) : (
                              validDeliveries.slice(0, 15).map(del => (
                                <tr key={del.id} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-mono font-bold text-slate-600 truncate max-w-[100px]">{del.id}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      del.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                                      del.status === 'Dispatched' ? 'bg-amber-100 text-amber-800' :
                                      'bg-slate-100 text-slate-800'
                                    }`}>
                                      {del.status}
                                    </span>
                                  </td>
                                  <td className="p-3 font-medium text-slate-700">{del.customerName}</td>
                                  <td className="p-3 font-mono font-bold text-indigo-700">{currency}{Math.round(del.deliveryCost || 0).toLocaleString()}</td>
                                  <td className="p-3 text-slate-600">{del.riderDetails?.name || del.riderId || 'Unassigned'}</td>
                                  <td className="p-3 text-[10px] uppercase font-bold text-slate-500">{del.deliveryPaymentMethod || 'Unspecified'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>

        {/* Dynamic Signature Block */}
        <div className="hidden print:block mt-12 pt-8 border-t border-dashed border-slate-300">
          <div className="grid grid-cols-3 gap-6 text-center text-[9px] text-slate-600 font-mono">
            <div className="border-t border-slate-300 pt-3">
              <p className="font-bold uppercase">Prepared By</p>
              <p className="mt-1 font-semibold">{userName}</p>
              <p className="text-slate-400 mt-0.5">System Operator</p>
            </div>
            <div className="border-t border-slate-300 pt-3">
              <p className="font-bold uppercase">Authorized By</p>
              <p className="mt-1 font-semibold text-slate-400">________________________</p>
              <p className="text-slate-400 mt-0.5 font-sans">Branch Manager</p>
            </div>
            <div className="border-t border-slate-300 pt-3">
              <p className="font-bold uppercase">Fiscal Verifier Code</p>
              <p className="mt-1 font-bold text-slate-800">JASPER-TZ-VFD-CERTIFIED</p>
              <p className="text-slate-400 mt-0.5 font-sans italic">✓ Tra Digital Integration Key</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
