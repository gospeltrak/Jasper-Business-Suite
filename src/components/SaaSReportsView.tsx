import React, { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Package,
  ShoppingCart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
  Legend,
} from "recharts";
import { Tenant } from "../types";
import { loadPlatformRecord } from "../utils/superAdminPlatformRecords";
import { loadSuperAdminOverview } from "../utils/superAdminData";
import { printPdfFromElement } from "../utils/pdfShare";
import { isEarnedCommissionStatus, isSettledPaymentStatus } from "../utils/financialStatus";

interface ExpenseRecord {
  id: string;
  title: string;
  category: "Commissions" | "Operational" | "Salaries";
  amount: number;
  date: string;
  recipient: string;
}

interface AffiliateAccount {
  id: string;
  name: string;
  revenueDate: number;
  totalEarnings?: number;
  revenueGenerated?: number;
  isSuper?: boolean;
  parentSuperId?: string;
}

const moneyValue = (value: unknown) => Number(value || 0);

export default function SaaSReportsView() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateAccount[]>([]);
  const [hardwareSales, setHardwareSales] = useState<any[]>([]);
  const [hardwareInventory, setHardwareInventory] = useState<any[]>([]);
  const [subscriptionRevenue, setSubscriptionRevenue] = useState(0);
  const [printReady, setPrintReady] = useState(false);
  const [timeframeMode, setTimeframeMode] = useState<"monthly" | "weekly">("monthly");

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadSuperAdminOverview(),
      loadPlatformRecord<ExpenseRecord[]>("platform_expenses", "global", []),
      loadPlatformRecord<any[]>("hardware_sales", "global", []),
      loadPlatformRecord<any[]>("hardware_inventory", "global", []),
    ]).then(([overview, platformExpenses, hwSales, hwInventory]) => {
      if (!alive) return;
      setTenants((overview.tenants || []) as Tenant[]);
      setExpenses(Array.isArray(platformExpenses) ? platformExpenses : []);
      setHardwareSales(Array.isArray(hwSales) ? hwSales : []);
      setHardwareInventory(Array.isArray(hwInventory) ? hwInventory : []);
      const paidSubscriptionRevenue = (overview.referredCustomers || [])
        .filter((row: any) => isSettledPaymentStatus(row.payment_status || row.status))
        .reduce((sum: number, row: any) => sum + moneyValue(row.amount_paid || row.amount), 0);
      const paidTrackedRevenue = (overview.sourceTracking || [])
        .filter((row: any) => isSettledPaymentStatus(row.payment_status || row.status))
        .reduce((sum: number, row: any) => sum + moneyValue(row.revenue_generated || row.amount_paid || row.amount), 0);
      setSubscriptionRevenue(paidSubscriptionRevenue || paidTrackedRevenue);
      setAffiliates((overview.affiliates || []).map((affiliate: any) => {
        const commissions = (overview.commissions || []).filter((row: any) => (
          row.affiliate_id === affiliate.id
          && (isEarnedCommissionStatus(row.commission_status) || isEarnedCommissionStatus(row.status))
        ));
        return {
          id: affiliate.id,
          name: affiliate.display_name,
          revenueDate: commissions.reduce((sum: number, row: any) => sum + Number(row.gross_revenue || 0), 0),
          revenueGenerated: commissions.reduce((sum: number, row: any) => sum + Number(row.gross_revenue || 0), 0),
          totalEarnings: commissions.reduce((sum: number, row: any) => sum + Number(row.net_payout || row.amount || 0), 0),
          isSuper: false
        };
      }));
    }).catch(() => {
      if (!alive) return;
      setTenants([]);
      setExpenses([]);
      setAffiliates([]);
      setHardwareSales([]);
      setHardwareInventory([]);
      setSubscriptionRevenue(0);
    });
    return () => { alive = false; };
  }, []);

  // -- FINANCE INTEGRATION LOGIC --
  // A. Subscription Fee revenues
  const calculateSubscriptionRevenues = () => subscriptionRevenue;

  const subscriptionTotal = calculateSubscriptionRevenues();

  // B. Affiliate Conversion Sales
  const calculateAffiliateRevenues = () => {
    return affiliates.reduce(
      (sum, aff) => sum + (aff.revenueGenerated || 0),
      0,
    );
  };
  const affiliateConversionSales = calculateAffiliateRevenues();

  // HW Revenues
  const hardwareRevenues = hardwareSales.reduce(
    (sum, sale) => sum + (sale.total || 0),
    0,
  );

  // C. Gross SaaS Income
  const grossIncome =
    subscriptionTotal + affiliateConversionSales + hardwareRevenues;

  // D. Affiliate Commission Deductions
  const organicAffsRevenue = affiliates
    .filter((a) => !a.isSuper && !a.parentSuperId)
    .reduce((sum, a) => sum + (a.revenueGenerated || 0), 0);
  const organicCommissions = organicAffsRevenue * 0.15; // 15% for organic

  const superAffsRevenue = affiliates
    .filter((a) => a.isSuper || a.parentSuperId)
    .reduce((sum, a) => sum + (a.revenueGenerated || 0), 0);
  const superCommissions = superAffsRevenue * 0.2; // 20% for super network (15% affiliate + 5% super)

  const calculatedCommissions = organicCommissions + superCommissions;

  // D. Expense Breakdown categories
  const salaryExpenses = expenses
    .filter((e) => e.category === "Salaries")
    .reduce((sum, e) => sum + e.amount, 0);
  const operationalExpensesGroup = expenses
    .filter((e) => e.category === "Operational")
    .reduce((sum, e) => sum + e.amount, 0);

  // E. Hardware Cost of Goods (est. 65% of sale price for wholesale fulfillment)
  const hardwareCostOfGoods = hardwareRevenues * 0.65;
  const hardwareNetProfit = hardwareRevenues - hardwareCostOfGoods;

  const totalSaaSExpenses =
    calculatedCommissions +
    salaryExpenses +
    operationalExpensesGroup +
    hardwareCostOfGoods;

  // F. Net Operating Profit
  const netProfitOrLoss = grossIncome - totalSaaSExpenses;
  const isLoss = netProfitOrLoss < 0;

  // Estimated TRA tax allocation (assuming 5% provisional reserving audit from gross conversions)
  const estimatedWithholdingReserve = affiliateConversionSales * 0.05;

  // HW Inventory Value
  const totalHardwareStockValue = hardwareInventory.reduce(
    (sum, item) => sum + item.stock * item.price,
    0,
  );
  const totalHardwareItems = hardwareInventory.reduce(
    (sum, item) => sum + item.stock,
    0,
  );

  // Data for Charts
  let incomeData = [
    { name: "Subscriptions", value: subscriptionTotal, color: "#6366f1" },
    { name: "Affiliates", value: affiliateConversionSales, color: "#10b981" },
    { name: "Hardware", value: hardwareRevenues, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  if (incomeData.every((entry) => entry.value <= 0)) {
    incomeData = [{ name: "No Revenue", value: 1, color: "#334155" }];
  }

  let expenseData = [
    { name: "Comm (Organic 15%)", value: organicCommissions, color: "#f43f5e" },
    { name: "Comm (Super 20%)", value: superCommissions, color: "#ec4899" },
    { name: "Salaries", value: salaryExpenses, color: "#14b8a6" },
    { name: "Operational", value: operationalExpensesGroup, color: "#8b5cf6" },
    { name: "Hardware COGS", value: hardwareCostOfGoods, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  if (expenseData.length === 0) {
    expenseData = [{ name: "No Expenses", value: 1, color: "#334155" }];
  }

  const hwInventoryChartData = hardwareInventory.map((item) => ({
    name: item.name.substring(0, 15) + (item.name.length > 15 ? "..." : ""),
    stock: item.stock,
    value: item.stock * item.price,
  }));

  const retailCount = tenants.filter(
    (t) => t.businessType === "retail" || t.businessType === undefined,
  ).length;
  const pharmacyCount = tenants.filter(
    (t) => t.businessType === "pharmacy",
  ).length;
  let nicheData = [
    { name: "Retail / Wholesale", value: retailCount, color: "#3b82f6" },
    { name: "Pharmacy Meds", value: pharmacyCount, color: "#10b981" },
  ].filter((d) => d.value > 0);

  if (nicheData.length === 0) {
    nicheData = [{ name: "No Subscribers", value: 1, color: "#334155" }];
  }

  const monthlyTrendsData = [
    { period: "Jan", retail: 3, pharmacy: 0 },
    { period: "Feb", retail: 7, pharmacy: 1 },
    { period: "Mar", retail: 11, pharmacy: 3 },
    { period: "Apr", retail: 17, pharmacy: 6 },
    { period: "May", retail: 27, pharmacy: 12 },
    { period: "Jun", retail: retailCount, pharmacy: pharmacyCount },
  ];

  const weeklyTrendsData = [
    { period: "W1 May", retail: 4, pharmacy: 2 },
    { period: "W2 May", retail: 6, pharmacy: 3 },
    { period: "W3 May", retail: 7, pharmacy: 3 },
    { period: "W4 May", retail: 10, pharmacy: 4 },
    { period: "W1 Jun", retail: Math.floor(retailCount * 0.2), pharmacy: Math.floor(pharmacyCount * 0.3) },
  ];

  const trendsData = timeframeMode === "monthly" ? monthlyTrendsData : weeklyTrendsData;

  return (
    <div id="saas-financial-audit-pdf-template" className={`space-y-5 sm:space-y-6 text-left font-sans animate-fade-in`}>
      {/* Printable page trigger header */}
      <div className="flex justify-between items-start sm:items-center bg-slate-900/95 border border-slate-800 p-4 sm:p-5 rounded-3xl flex-col sm:flex-row gap-4 shadow-[0_16px_40px_rgba(2,6,23,0.22)] print:hidden">
        <div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
            Orvix Business Reports
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
            Audit platform P&L ratios, subscription revenue margins, hardware
            ledgers, and network cost breakdowns.
          </p>
        </div>
        <button
          type="button"
          onClick={() => printPdfFromElement({
            elementId: "saas-financial-audit-pdf-template",
            fileName: `jasper-saas-financial-audit-${timeframeMode}.pdf`,
            format: "a4"
          })}
          className="w-full sm:w-auto justify-center px-4 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-2xl font-bold font-mono text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span>Export Financial Audit Sheet</span>
        </button>
      </div>

      {/* CORE CARDS */}
      <div className="mobile-tablet-kpi-grid gap-3 sm:gap-4" style={{ ['--desktop-kpi-columns' as any]: 'repeat(4, minmax(0, 1fr))' }}>
        {/* Gross Income Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between min-w-0 shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs font-mono uppercase tracking-wider gap-2">
              <span>Gross Income</span>
              <span className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400">
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white font-mono mt-2 leading-tight break-words">
              TSh {grossIncome.toLocaleString()}
            </h3>
          </div>
          <div className="border-t border-slate-850 pt-2 mt-3 text-[10px] text-slate-400 flex flex-col gap-1 font-mono">
            <span className="flex justify-between items-center">
              <span>Subs</span>
              <span className="text-white">
                {subscriptionTotal.toLocaleString()}
              </span>
            </span>
            <span className="flex justify-between items-center">
              <span>HW</span>
              <span className="text-white">
                {hardwareRevenues.toLocaleString()}
              </span>
            </span>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between min-w-0 shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs font-mono uppercase tracking-wider gap-2">
              <span>Gross Expenses</span>
              <span className="p-1 bg-rose-500/10 rounded-lg text-rose-400">
                <ArrowDownRight className="w-3 h-3" />
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-rose-400 font-mono mt-2 leading-tight break-words">
              TSh {totalSaaSExpenses.toLocaleString()}
            </h3>
          </div>
          <div className="border-t border-slate-850 pt-2 mt-3 text-[10px] text-slate-400 flex flex-col gap-1 font-mono">
            <span className="flex justify-between items-center">
              <span>Wages</span>
              <span className="text-white">
                {salaryExpenses.toLocaleString()}
              </span>
            </span>
            <span className="flex justify-between items-center">
              <span>Comms</span>
              <span className="text-white">
                {calculatedCommissions.toLocaleString()}
              </span>
            </span>
          </div>
        </div>

        {/* Net Profit Card */}
        <div
          className={`p-4 sm:p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between border min-w-0 shadow-[0_14px_34px_rgba(2,6,23,0.14)] ${
            isLoss
              ? "bg-rose-500/5 border-rose-500/20"
              : "bg-emerald-500/5 border-emerald-500/20"
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs font-mono uppercase tracking-wider gap-2">
              <span>Net Profit</span>
              <span
                className={`p-1 rounded-lg ${isLoss ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}
              >
                {isLoss ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <TrendingUp className="w-3 h-3" />
                )}
              </span>
            </div>
            <h3
              className={`text-lg sm:text-xl font-black font-mono mt-2 leading-tight break-words ${isLoss ? "text-rose-400" : "text-emerald-400"}`}
            >
              TSh {netProfitOrLoss.toLocaleString()}
            </h3>
          </div>
          <div className="border-t border-slate-850/60 pt-2 mt-3 text-[10px] text-slate-400 flex justify-between items-center font-mono">
            <span>Margin Rate:</span>
            <span
              className={
                isLoss
                  ? "text-rose-400 font-bold"
                  : "text-emerald-400 font-bold"
              }
            >
              {grossIncome > 0
                ? ((netProfitOrLoss / grossIncome) * 100).toFixed(1)
                : 0}
              % Net
            </span>
          </div>
        </div>

        {/* HW Inventory Value Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between min-w-0 shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs font-mono uppercase tracking-wider gap-2">
              <span>HW Stock Value</span>
              <span className="p-1 bg-amber-500/10 rounded-lg text-amber-400">
                <Layers className="w-3 h-3" />
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-amber-400 font-mono mt-2 leading-tight break-words">
              TSh {totalHardwareStockValue.toLocaleString()}
            </h3>
          </div>
          <div className="border-t border-slate-850 pt-2 mt-3 text-[10px] text-slate-400 flex justify-between items-center font-mono">
            <span>Total Units:</span>
            <span className="text-amber-400 font-bold font-mono">
              {totalHardwareItems.toLocaleString()} items
            </span>
          </div>
        </div>
      </div>

      {/* VISUAL CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income Distribution Chart */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6">
          <h3 className="text-xs uppercase font-mono tracking-widest text-slate-300 font-bold mb-4">
            Revenue Streams
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={incomeData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {incomeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number) => `TSh ${value.toLocaleString()}`}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#1e293b",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses Distribution Chart */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6">
          <h3 className="text-xs uppercase font-mono tracking-widest text-slate-300 font-bold mb-4">
            Expense Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number) => `TSh ${value.toLocaleString()}`}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#1e293b",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Industry Niche Distribution Chart */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6">
          <h3 className="text-xs uppercase font-mono tracking-widest text-slate-300 font-bold mb-4">
            Subscriber Niche
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={nicheData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {nicheData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number) => `${value} subscribers`}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#1e293b",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TRENDS CHART */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6 border-b border-slate-850 pb-4 flex-col sm:flex-row gap-4">
          <div>
            <h3 className="text-sm uppercase font-sans tracking-widest text-slate-300 font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Niche Sign-Up Trends
            </h3>
            <p className="text-xs text-slate-400 font-light mt-1">
              Time-series tracking of subscriber growth by industry.
            </p>
          </div>
          <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setTimeframeMode("weekly")}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                timeframeMode === "weekly"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setTimeframeMode("monthly")}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                timeframeMode === "monthly"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="period" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#1e293b",
                  borderRadius: "8px",
                  color: "#e2e8f0"
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
              <Line type="monotone" name="Retail / Wholesale" dataKey="retail" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 6 }} />
              <Line type="monotone" name="Pharmacy" dataKey="pharmacy" stroke="#10b981" strokeWidth={2} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AFFILIATES PERFORMANCES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
        <div className="bg-slate-900 border border-indigo-500/20 shadow-lg shadow-indigo-500/5 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="mb-4">
            <div className="flex items-center space-x-2 text-indigo-400 font-bold uppercase text-xs tracking-widest font-mono">
              <span>🌱 Organic Affiliates Overview</span>
            </div>
          </div>
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">
                Subscribers from organic affiliates:
              </span>
              <span className="text-white font-bold">
                {affiliates
                  .filter((a: any) => !a.isSuper && !a.parentSuperId)
                  .reduce(
                    (sum: number, a: any) =>
                      sum +
                      (a.conversionsPromo || 0) +
                      (a.conversionsLink || 0),
                    0,
                  )}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Total Value Generated:</span>
              <span className="text-emerald-400 font-bold">
                TSh {organicAffsRevenue.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Total Commissions Paid:</span>
              <span className="text-emerald-400 font-bold">
                TSh{" "}
                {affiliates
                  .filter((a: any) => !a.isSuper && !a.parentSuperId)
                  .reduce(
                    (sum: number, a: any) => sum + (a.totalEarnings || 0),
                    0,
                  )
                  .toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-teal-500/20 shadow-lg shadow-teal-500/5 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 top-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="mb-4">
            <div className="flex items-center space-x-2 text-teal-400 font-bold uppercase text-xs tracking-widest font-mono">
              <span>👑 Super Recruiters Overview</span>
            </div>
          </div>
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">
                Subscribers directly from super affiliates:
              </span>
              <span className="text-white font-bold">
                {affiliates
                  .filter((a: any) => a.isSuper)
                  .reduce(
                    (sum: number, a: any) =>
                      sum +
                      (a.conversionsPromo || 0) +
                      (a.conversionsLink || 0),
                    0,
                  )}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">
                Subscribers from their sub-affiliates:
              </span>
              <span className="text-white font-bold">
                {affiliates
                  .filter((a: any) => !a.isSuper && a.parentSuperId)
                  .reduce(
                    (sum: number, a: any) =>
                      sum +
                      (a.conversionsPromo || 0) +
                      (a.conversionsLink || 0),
                    0,
                  )}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Total Value Generated:</span>
              <span className="text-emerald-400 font-bold">
                TSh {superAffsRevenue.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Total Commissions Paid:</span>
              <span className="text-emerald-400 font-bold">
                TSh{" "}
                {affiliates
                  .filter((a: any) => a.isSuper)
                  .reduce(
                    (sum: number, a: any) =>
                      sum + (a.revenueGenerated || 0) * 0.2,
                    0,
                  )
                  .toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* HARDWARE INVENTORY VISUAL CHARTS */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6 border-b border-slate-850 pb-4">
          <div>
            <h3 className="text-sm uppercase font-sans tracking-widest text-amber-500 font-bold flex items-center gap-2">
              <Package className="w-5 h-5" /> Hardware Inventory Levels
            </h3>
            <p className="text-xs text-slate-400 font-light mt-1">
              Current stock levels per sku against their respective values.
            </p>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={hwInventoryChartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip
                cursor={{ fill: "#1e293b" }}
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#1e293b",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [
                  name === "stock"
                    ? `${value} Items`
                    : `TSh ${value.toLocaleString()}`,
                  name === "stock" ? "Stock Level" : "Total Asset Value",
                ]}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar
                dataKey="stock"
                name="Stock Items"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PROFIT AND LOSS DETAILED REPORT LIST */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden mt-6">
        <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
            Detailed P&L Ledger
          </h3>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">
            ISO-9001 audit ready
          </span>
        </div>
        <div className="p-6 space-y-2 font-mono text-xs">
          <div className="flex justify-between items-center py-2.5 border-b border-slate-850 text-slate-400">
            <span>Platform Subscription Revenue</span>
            <span className="text-white">
              + TSh {subscriptionTotal.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-2.5 border-b border-slate-850 text-slate-400">
            <span>Affiliate Conversions Revenue generated</span>
            <span className="text-white">
              + TSh {affiliateConversionSales.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-2.5 border-b border-slate-850 text-amber-500/70">
            <span>Enterprise Hardware Sales Revenue</span>
            <span className="text-amber-400">
              + TSh {hardwareRevenues.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 border-b border-slate-850 text-white font-bold text-sm bg-slate-900 px-3 rounded-lg mt-2">
            <span>GROSS INCOME ACCOUNTS</span>
            <span className="text-emerald-400">
              TSh {grossIncome.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-2.5 border-b border-slate-850 text-slate-400 font-light italic mt-4">
            <span className="flex flex-col">
              <span>Less: Organic Affiliate Payouts (15%)</span>
              <span className="text-[9px] text-slate-500 font-sans">
                15% of TSh {organicAffsRevenue.toLocaleString()} conversion
                revenue
              </span>
            </span>
            <span className="text-rose-400">
              - TSh {organicCommissions.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-2.5 border-b border-slate-850 text-slate-400 font-light italic">
            <span className="flex flex-col">
              <span>Less: Super Recruiter Payouts (20%)</span>
              <span className="text-[9px] text-slate-500 font-sans">
                20% of TSh {superAffsRevenue.toLocaleString()} conversion
                revenue
              </span>
            </span>
            <span className="text-rose-400">
              - TSh {superCommissions.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-2.5 border-b border-slate-850 text-slate-400 font-light italic">
            <span className="flex flex-col">
              <span>Less: Hardware Cost of Goods Sold (COGS)</span>
              <span className="text-[9px] text-amber-500/70 font-sans">
                Est. Net Profit on HW: TSh {hardwareNetProfit.toLocaleString()}
              </span>
            </span>
            <span className="text-rose-400">
              - TSh {hardwareCostOfGoods.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-2.5 border-b border-slate-850 text-slate-400 font-light italic">
            <span>Less: Hired Company Staff Salaries</span>
            <span className="text-rose-400">
              - TSh {salaryExpenses.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-2.5 border-b border-slate-850 text-slate-400 font-light italic">
            <span>Less: Operational Assets expenditures</span>
            <span className="text-rose-400">
              - TSh {operationalExpensesGroup.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 border-b border-slate-850 text-white font-bold text-sm bg-slate-900 px-3 rounded-lg mt-2">
            <span>TOTAL OPERATING EXPENSES & DEDUCTIONS</span>
            <span className="text-rose-400">
              TSh {totalSaaSExpenses.toLocaleString()}
            </span>
          </div>

          <div
            className={`flex justify-between items-center py-4 text-base font-extrabold px-4 rounded-xl mt-6 ${
              isLoss
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            }`}
          >
            <span>NET OPERATING SURPLUS</span>
            <span>TSh {netProfitOrLoss.toLocaleString()}</span>
          </div>

          {/* TRA Provision alert */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl mt-6 text-[11px] text-slate-400 leading-normal flex items-start gap-3 font-sans font-light">
            <span className="text-emerald-400 text-lg">💡</span>
            <p>
              <strong>TRA Withholding Tax Provision Note:</strong> Estimated
              future Tanzania Revenue Authority (TRA) provisional withholding
              tax reserves representing 5% of total affiliate conversion
              commissions equals{" "}
              <strong>
                TSh {estimatedWithholdingReserve.toLocaleString()}
              </strong>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
