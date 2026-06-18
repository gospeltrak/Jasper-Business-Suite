import React from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { Wallet, TrendingUp, Package, AlertTriangle, Play, Truck, CheckCircle, Factory, Coins, Activity, Settings, Database, Info } from 'lucide-react';
import { hasDemoData, loadDemoData, clearDemoData } from './microSokoDemoData';

export const MicroSokoAdminDashboard: React.FC<{ onSwitchToSettings?: () => void }> = ({ onSwitchToSettings }) => {
  const ctx = useMicroSoko();
  const { sales, expenses, items, deliveries } = ctx;

  const today = new Date().toISOString().split('T')[0];

  const todaySales = sales.filter(s => s.date.startsWith(today)).reduce((sum, s) => sum + s.total, 0);
  const todayExpenses = expenses.filter(e => e.date.startsWith(today)).reduce((sum, e) => sum + e.amount, 0);
  const todayDeliveries = deliveries.filter(d => d.date.startsWith(today) && d.paidBy === 'business').reduce((sum, d) => sum + d.cost, 0);
  
  const stockValue = items.reduce((sum, item) => sum + (item.stock * item.averageCost), 0);
  const lowStockCount = items.filter(i => i.stock <= i.lowStockAlert).length;
  const activeBatchesCount = items.reduce((sum, item) => sum + item.batches.filter(b => b.status === 'active').length, 0);

  const isDemoLoaded = hasDemoData(ctx);

  const handleLoadDemo = () => {
    loadDemoData(ctx);
  };

  const handleClearDemo = () => {
    clearDemoData(ctx);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Admin Fleet & Dashboard</h2>
          <p className="text-slate-500">Overview of your MicroSoko business.</p>
        </div>
        {isDemoLoaded && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl flex items-center shadow-sm">
            <Info className="w-5 h-5 mr-2 text-amber-500" />
            <span className="text-sm font-semibold">You are viewing demo data.</span>
            <button onClick={handleClearDemo} className="ml-4 text-xs font-bold underline hover:text-amber-900">Clear Demo</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-emerald-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-bold text-xs uppercase tracking-wider">Sales Today</span>
          </div>
          <span className="text-2xl font-black text-slate-800">TZS {todaySales.toLocaleString()}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-indigo-600 mb-2">
            <Wallet className="w-5 h-5" />
            <span className="font-bold text-xs uppercase tracking-wider">Expenses Today</span>
          </div>
          <span className="text-2xl font-black text-slate-800">TZS {todayExpenses.toLocaleString()}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-rose-500 mb-2">
            <Truck className="w-5 h-5" />
            <span className="font-bold text-xs uppercase tracking-wider">Delivery Cost</span>
          </div>
          <span className="text-2xl font-black text-slate-800">TZS {todayDeliveries.toLocaleString()}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-amber-500 mb-2">
            <Coins className="w-5 h-5" />
            <span className="font-bold text-xs uppercase tracking-wider">Stock Value</span>
          </div>
          <span className="text-2xl font-black text-slate-800">TZS {Math.round(stockValue).toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-emerald-500"/> Quick Setup Checklist</h3>
          <ul className="space-y-3 text-sm text-slate-600 mb-4">
            <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-slate-300"/> Add your custom units (e.g. Ndoo, Gunia)</li>
            <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-slate-300"/> Configure your payment methods</li>
            <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-slate-300"/> Add items (Raw Materials, Products, Packaging)</li>
            <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-slate-300"/> Set up unit conversions</li>
          </ul>
          {onSwitchToSettings && (
            <button 
              onClick={onSwitchToSettings}
              className="w-full bg-slate-900 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center hover:bg-slate-800 transition-colors"
            >
              <Settings className="w-4 h-4 mr-2" />
              Complete your setup
            </button>
          )}
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center"><Activity className="w-5 h-5 mr-2 text-slate-500"/> System Status</h3>
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
            <span className="text-sm font-semibold text-slate-600 flex items-center"><Package className="w-4 h-4 mr-2"/> Total Items</span>
            <span className="font-black text-slate-800">{items.length}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
            <span className="text-sm font-semibold text-slate-600 flex items-center"><AlertTriangle className="w-4 h-4 mr-2 text-amber-500"/> Low Stock Items</span>
            <span className="font-black text-amber-600">{lowStockCount}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
            <span className="text-sm font-semibold text-slate-600 flex items-center"><Factory className="w-4 h-4 mr-2 text-indigo-500"/> Active Batches</span>
            <span className="font-black text-indigo-600">{activeBatchesCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
