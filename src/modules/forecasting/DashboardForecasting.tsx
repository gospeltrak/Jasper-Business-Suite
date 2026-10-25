import React, { useState } from 'react';
import { Product, Sale, Tenant } from '../../types';
import { getSecureDataBridgeClient } from '../../shared/dataBridge/secureDataBridge';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Truck, ExternalLink, ArrowUpRight, ArrowDownRight, Lightbulb } from "lucide-react";

interface ForecastItem {
  sku: string;
  productName: string;
  projectedDemand30Days: number;
  recommendedReorderQty: number;
  confidenceScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  marketReasoning: string;
}

interface ProjectionItem {
  sales: number;
  expenses: number;
  purchases: number;
  profit: number;
  reasoning: string;
}

interface NicheCatalogSuggestion {
  name: string;
  niche: string;
  demandVolume: string;
  rationale: string;
  infoLink: string;
}

interface ForecastingResponse {
  forecasts: ForecastItem[];
  generalInsights: {
    seasonalityNotes: string;
    procurementTips: string;
  };
  projections?: {
    oneMonth: ProjectionItem;
    threeMonths: ProjectionItem;
    oneYear: ProjectionItem;
  };
  bestSellers?: {
    productName: string;
    qtySold: number;
    growthRatePercent: number;
    trendRating: string;
  }[];
  trendingProducts?: {
    productName: string;
    category: string;
    currentMarketTrendScore: number;
    reason: string;
  }[];
  newCatalogSuggestions?: NicheCatalogSuggestion[];
}

interface DashboardForecastingProps {
  activeTenant: Tenant;
  products: Product[];
  sales: Sale[];
  expenses?: any[];
  systemSettings?: any;
  onUpdateStocks: (updatedProducts: Product[]) => void;
}

export default function DashboardForecasting({ 
  activeTenant, 
  products, 
  sales,
  expenses = [],
  systemSettings,
  onUpdateStocks
}: DashboardForecastingProps) {
  const currency = activeTenant.currency;

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 text-white p-3 py-2.5 rounded-xl shadow-xl space-y-1.5 text-left text-[11px] font-sans">
          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
            <span>Projection Milestones</span>
            <span className="text-[9.5px] text-slate-400 font-mono italic">{label}</span>
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, i: number) => (
              <div key={i} className="flex items-center justify-between space-x-6">
                <span className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: entry.stroke || entry.fill }} />
                  <span className="text-slate-400 capitalize">{entry.name}:</span>
                </span>
                <span className="font-mono font-bold" style={{ color: entry.stroke || entry.fill }}>
                  {currency} {Number(entry.value).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [forecastData, setForecastData] = useState<ForecastingResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  
  // Projection Timelines Tab State
  const [projectionTab, setProjectionTab] = useState<'1Month' | '3Months' | '1Year'>('1Month');

  // Track success states of local simulation restocks
  const [restockedSkus, setRestockedSkus] = useState<Record<string, boolean>>({});

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const simulateLoading = async (runActualFetch: () => Promise<void>) => {
    setLoading(true);
    setErrorMsg(null);
    setLoadingStep(0);

    const steps = [
      'Extracting active item registries...',
      'Mapping historical cash register ledgers...',
      'Compiling transaction velocities...',
      'Injecting regional market telemetry...',
      'Lucy is generating report...'
    ];

    const timer = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1000);

    try {
      await runActualFetch();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An unknown error occurred during forecasting generation.');
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const fetchGeneratorForecast = async () => {
    const client = await getSecureDataBridgeClient();
    const { data: sessionData } = await client.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Your secure session has expired. Sign in again.');
    }

    const response = await fetch(`/api/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        products: products,
        salesHistory: sales,
        tenant: activeTenant
      })
    });

    if (!response.ok) {
      const errRes = await response.json().catch(() => ({}));
      throw new Error(errRes.message || `Forecast could not be generated. Please try again.`);
    }

    const data: ForecastingResponse = await response.json();
    setForecastData(data);
    setRestockedSkus({}); // clear on new analysis
  };

  const handleGenerateClick = () => {
    simulateLoading(fetchGeneratorForecast);
  };

  const filteredForecasts = forecastData?.forecasts.filter(item => {
    const origProduct = products.find(p => p.sku === item.sku);
    const category = origProduct?.category || '';

    const matchesSearch = String(item.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(item.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
    const matchesRisk = riskFilter === 'All' || item.riskLevel === riskFilter;

    return matchesSearch && matchesCategory && matchesRisk;
  }) || [];

  const handleSimulateRestock = (sku: string, qty: number) => {
    const prodIndex = products.findIndex(p => p.sku === sku);
    if (prodIndex > -1) {
      const updated = [...products];
      updated[prodIndex] = {
        ...updated[prodIndex],
        stockQty: updated[prodIndex].stockQty + qty,
        storeStockQty: updated[prodIndex].storeStockQty + qty
      };
      
      onUpdateStocks(updated);
      setRestockedSkus(prev => ({
        ...prev,
        [sku]: true
      }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="forecasting-view-root">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            
            <span className="bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider">LUCY FORECASTING INSIGHTS</span>
            <h2 className="text-xl font-bold tracking-tight text-slate-800">Advanced Business Projections & Catalog Trends</h2>
          </div>
          <p className="text-xs text-slate-450 leading-relaxed font-sans">
            Lucy analyzes historical transactions ledger, category curves, and cash-flow reserves to project 1-month, 3-month, and annual forecasting.
          </p>
        </div>

        <button
          onClick={handleGenerateClick}
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-white font-sans text-xs px-4 py-2.5 rounded-xl flex items-center justify-center space-x-2 border-none cursor-pointer transition-all active:scale-95 disabled:opacity-50 select-none shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
          <span>{forecastData ? 'Re-Analyze System Projections' : 'Run Lucy Projections'}</span>
        </button>
      </div>

      {/* ERROR CORNER */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-xs text-red-800 shadow-sm">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Generative Pipeline Refused Connection</p>
            <p className="text-[11px] leading-relaxed text-red-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* BEFORE STATE: STANDBY PROMPT */}
      {!forecastData && !loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-800">Lucy Diagnostics Standby</h4>
            <p className="text-xs text-slate-450 font-sans leading-relaxed">
              No predictive modeling has been compiled yet. Click the button below to generate full sales demand, expenses projections, best sellers suggestions, and industry expansions for the active <b>{activeTenant.name}</b> branch in <b>{activeTenant.city} ({activeTenant.businessType})</b>.
            </p>
          </div>
          <button
            onClick={handleGenerateClick}
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-xl border-none cursor-pointer shadow transition-all active:scale-95"
          >
            
            <span>Generate Projections with Lucy</span>
          </button>
        </div>
      )}

      {/* ACTIVE LOADING SHIELD */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto space-y-6">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping" />
            <div className="relative w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-850">
              
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-800 font-sans">Compiling Generative Projections...</p>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-1000 ease-out"
                style={{ width: `${((loadingStep + 1) / 5) * 100}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-emerald-600 font-bold uppercase tracking-wider animate-pulse">
              {[
                'Extracting active item registries...',
                'Mapping historical cash register ledgers...',
                'Compiling transaction velocities...',
                'Injecting regional market telemetry...',
                'Lucy is generating report...'
              ][loadingStep]}
            </p>
          </div>
        </div>
      )}

      {/* ACTIVE PLAN AND PROJECTIONS DASHBOARD */}
      {forecastData && !loading && (
        <div className="grid grid-cols-1 gap-6">
          
          {/* LEFT: RESULTS FEED & GRIDS */}
          <div className="space-y-6">

            {/* EXPANDED timeline projections panel */}
            {forecastData.projections && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Timeline Cashflow Forecasts</h3>
                      <p className="text-[11px] text-slate-450">Sales, expenses, profit</p>
                    </div>
                  </div>

                  {/* 1M/3M/1Yr tabs selectors */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setProjectionTab('1Month')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                        projectionTab === '1Month' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1 Month
                    </button>
                    <button
                      onClick={() => setProjectionTab('3Months')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                        projectionTab === '3Months' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      3 Months
                    </button>
                    <button
                      onClick={() => setProjectionTab('1Year')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                        projectionTab === '1Year' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1 Year
                    </button>
                  </div>
                </div>

                {/* PROJECTION STAT MODULES */}
                {(() => {
                  const activeProjKey = projectionTab === '1Month' ? 'oneMonth' : projectionTab === '3Months' ? 'threeMonths' : 'oneYear';
                  const data = forecastData.projections?.[activeProjKey];
                  if (!data) return null;

                  return (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        
                        {/* Box 1: Expected Sales */}
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl relative overflow-hidden group">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Expected Sales</span>
                            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                          </div>
                          <p className="text-lg font-black text-slate-800 mt-2">
                            {currency} {data.sales.toLocaleString()}
                          </p>
                          <div className="absolute bottom-0 inset-x-0 h-[2px] bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                        </div>

                        {/* Box 2: Expenses */}
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl relative overflow-hidden group">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Expenses</span>
                            <ArrowDownRight className="w-4 h-4 text-rose-500" />
                          </div>
                          <p className="text-lg font-black text-slate-800 mt-2">
                            {currency} {data.expenses.toLocaleString()}
                          </p>
                          <div className="absolute bottom-0 inset-x-0 h-[2px] bg-rose-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                        </div>

                        {/* Box 3: Wholesale Purchases */}
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl relative overflow-hidden group">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Wholesale Purchases</span>
                            <Truck className="w-4 h-4 text-indigo-500" />
                          </div>
                          <p className="text-lg font-black text-slate-800 mt-2">
                            {currency} {data.purchases.toLocaleString()}
                          </p>
                          <div className="absolute bottom-0 inset-x-0 h-[2px] bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                        </div>

                        {/* Box 4: Net Profit */}
                        <div className="bg-slate-900 text-white p-4 rounded-2xl relative overflow-hidden shadow-xs">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 font-bold">Net Profit</span>
                            
                          </div>
                          <p className="text-lg font-black text-white mt-2">
                            {currency} {data.profit.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Line Chart Projections Section */}
                      {forecastData.projections && (
                        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4 text-left">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Interactive Forecast Trajectory</h4>
                              <p className="text-[10.5px] text-slate-500 font-sans leading-relaxed">Forecast chart</p>
                            </div>
                            <div className="flex items-center space-x-1.5 self-start sm:self-auto mt-1 sm:mt-0">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Interactive Curve</span>
                            </div>
                          </div>

                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 900, height: 320 }}>
                              <LineChart
                                data={[
                                  {
                                    name: '1 Month',
                                    Sales: forecastData.projections.oneMonth?.sales || 0,
                                    Expenses: forecastData.projections.oneMonth?.expenses || 0,
                                    Purchases: forecastData.projections.oneMonth?.purchases || 0,
                                    Profit: forecastData.projections.oneMonth?.profit || 0,
                                  },
                                  {
                                    name: '3 Months',
                                    Sales: forecastData.projections.threeMonths?.sales || 0,
                                    Expenses: forecastData.projections.threeMonths?.expenses || 0,
                                    Purchases: forecastData.projections.threeMonths?.purchases || 0,
                                    Profit: forecastData.projections.threeMonths?.profit || 0,
                                  },
                                  {
                                    name: '1 Year',
                                    Sales: forecastData.projections.oneYear?.sales || 0,
                                    Expenses: forecastData.projections.oneYear?.expenses || 0,
                                    Purchases: forecastData.projections.oneYear?.purchases || 0,
                                    Profit: forecastData.projections.oneYear?.profit || 0,
                                  }
                                ]}
                                margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis 
                                  dataKey="name" 
                                  stroke="#64748b" 
                                  fontSize={10.5}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis 
                                  stroke="#64748b" 
                                  fontSize={10.5}
                                  tickLine={false}
                                  axisLine={false}
                                  tickFormatter={(v) => `${currency} ${v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                                />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend 
                                  verticalAlign="top" 
                                  height={36} 
                                  iconType="circle"
                                  iconSize={7}
                                  wrapperStyle={{ fontSize: '10.5px', paddingBottom: '10.5px' }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="Sales" 
                                  name="Expected Sales" 
                                  stroke="#10b981" 
                                  strokeWidth={3} 
                                  activeDot={{ r: 6 }} 
                                  dot={{ r: 4, stroke: '#10b981', strokeWidth: 1, fill: '#fff' }} 
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="Expenses" 
                                  name="Expenses" 
                                  stroke="#f43f5e" 
                                  strokeWidth={2.5} 
                                  strokeDasharray="4 4" 
                                  dot={{ r: 3, stroke: '#f43f5e', strokeWidth: 1, fill: '#fff' }} 
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="Purchases" 
                                  name="Wholesale Purchases" 
                                  stroke="#6366f1" 
                                  strokeWidth={2.5} 
                                  strokeDasharray="4 4" 
                                  dot={{ r: 3, stroke: '#6366f1', strokeWidth: 1, fill: '#fff' }} 
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="Profit" 
                                  name="Net Profit" 
                                  stroke="#f59e0b" 
                                  strokeWidth={3} 
                                  activeDot={{ r: 6 }} 
                                  dot={{ r: 4, stroke: '#f59e0b', strokeWidth: 1, fill: '#fff' }} 
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Timeline Reasoning Summary */}
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-150 rounded-xl leading-relaxed font-sans p-4 relative text-left">
                        <span className="absolute top-1.5 right-2 text-[9px] font-mono text-emerald-600 font-bold uppercase border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 rounded">Analysis Details</span>
                        <b className="text-slate-800 font-bold block mb-1 font-sans text-xs">Timeline Projections Reasoning:</b>
                        {data.reasoning}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ROW: BEST SELLERS & TRENDING PRODUCTS ANALYSIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box A: Store Best Sellers suggestions */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg">
                    
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Best Sell Catalyst (Increase Stock)</h4>
                </div>
                <p className="text-[11px] text-slate-455 font-sans leading-relaxed">
                  Based on sales transaction density, increase replenishment batches of these top performers to avoid stockouts.
                </p>

                <div className="divide-y divide-slate-100">
                  {forecastData.bestSellers?.map((bs, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[9px] bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded">Rank #{idx+1}</span>
                        <h5 className="text-xs font-bold text-slate-800">{bs.productName}</h5>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono font-black text-slate-700">{bs.qtySold} sold</p>
                        <p className="text-[10px] text-emerald-600 font-sans font-bold flex items-center justify-end">
                          +{bs.growthRatePercent}% Velocity
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box B: Trending Consumer Habits suggestions */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Trending Local Demand Curves</h4>
                </div>
                <p className="text-[11px] text-slate-455 font-sans leading-relaxed">
                  These items currently exhibit rising customer counts during this season's purchasing triggers.
                </p>

                <div className="divide-y divide-slate-100">
                  {forecastData.trendingProducts?.map((tp, idx) => (
                    <div key={idx} className="py-2.5 flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-slate-800">{tp.productName}</h5>
                        <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 rounded-full font-bold">
                          {tp.currentMarketTrendScore}% Score
                        </span>
                      </div>
                      <p className="text-[10.5px] font-sans leading-relaxed text-slate-500 italic">
                        {tp.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* SECTION: NEW CATALOG SUGGESTIONS WITH INFO LINKS */}
            {forecastData.newCatalogSuggestions && forecastData.newCatalogSuggestions.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Niche Industry Expansion Recommendations</h3>
                    <p className="text-[11px] text-slate-450">Smart catalog additions tuned specifically to your '{activeTenant.businessType}' business sector</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {forecastData.newCatalogSuggestions.map((suggestion, idx) => (
                    <div key={idx} className="bg-slate-50/50 border border-slate-150 hover:bg-slate-50 p-4 rounded-2xl flex flex-col justify-between transition-colors space-y-3">
                      <div className="space-y-1.5 text-left">
                        <div className="flex items-start justify-between">
                          <span className="bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase">
                            {suggestion.niche}
                          </span>
                          <span className="text-[9.5px] font-sans font-bold text-slate-400">
                            {suggestion.demandVolume}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-800 leading-snug">{suggestion.name}</h4>
                        <p className="text-[11px] text-slate-600 font-sans leading-relaxed">{suggestion.rationale}</p>
                      </div>

                      {/* Wikipedia or regulatory links */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 italic">Global Analytics Match</span>
                        <a 
                          href={suggestion.infoLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition"
                        >
                          <span>Supplier & Market Info</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FILTERS & MAIN RECOMMENDED STOCK ORDERS LIST */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Auto-Drafted Inventory Replenishment</h3>
                  <p className="text-[11px] text-slate-450">Suggested stock changes</p>
                </div>
                
                {/* Search Term */}
                <input
                  type="text"
                  placeholder="Filter name or codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 border border-slate-250 px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white text-slate-800 font-sans"
                />
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-center">In Shop</th>
                      <th className="p-3 text-center">Predicted 30D</th>
                      <th className="p-3 text-center text-emerald-800">Drafted Reorder</th>
                      <th className="p-3 text-center">Risk</th>
                      <th className="p-3 text-center">Trust Index</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                    {filteredForecasts.map((item, idx) => {
                      const matchingProd = products.find(p => p.sku === item.sku);
                      const currentStock = matchingProd ? matchingProd.stockQty : 0;
                      const hasAlert = currentStock <= (matchingProd?.alertQty || 0);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-all text-slate-700">
                          
                          <td className="p-3 max-w-[180px]">
                            <p className="font-bold text-slate-800 leading-tight truncate">{item.productName}</p>
                            <span className="text-[9.5px] text-slate-400 font-mono">{item.sku}</span>
                          </td>

                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              hasAlert 
                                ? 'bg-red-50 text-red-700 border border-red-100' 
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {currentStock} units
                            </span>
                          </td>

                          <td className="p-3 text-center font-mono font-bold text-slate-800">
                            {item.projectedDemand30Days} units
                          </td>

                          <td className="p-3 text-center">
                            {item.recommendedReorderQty > 0 ? (
                              <span className="font-mono font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-150 px-2 py-0.5 rounded">
                                +{item.recommendedReorderQty}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10.5px]">Sufficient</span>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold font-sans ${
                              item.riskLevel === 'High'
                                ? 'bg-red-50 text-red-700 border border-red-100'
                                : item.riskLevel === 'Medium'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {item.riskLevel}
                            </span>
                          </td>

                          <td className="p-3 text-center font-mono font-bold text-slate-500">
                            {Math.round(item.confidenceScore * 100)}%
                          </td>

                          <td className="p-3 text-center">
                            {item.recommendedReorderQty > 0 ? (
                              restockedSkus[item.sku] ? (
                                <span className="inline-flex items-center space-x-1 text-emerald-600 text-[10px] font-bold py-1">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Added</span>
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSimulateRestock(item.sku, item.recommendedReorderQty)}
                                  className="bg-slate-900 text-white hover:bg-slate-800 px-2 py-1 rounded-lg text-[9.5px] font-bold font-sans cursor-pointer transition-colors"
                                >
                                  Bulk Reorder
                                </button>
                              )
                            ) : (
                              <span className="text-slate-400 italic text-[9.5px]">Optimal Buffer</span>
                            )}
                          </td>

                        </tr>
                      );
                    })}
                    {filteredForecasts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400 font-sans">
                          No forecasting recommendations match your search keyword.
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

    </div>
  );
}

