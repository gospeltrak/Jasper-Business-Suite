import React, { useState } from 'react';
import { MicroSokoProvider } from './MicroSokoContext';
import { FastPOS } from './FastPOS';
import { ProductionBatchWizard } from './ProductionBatchWizard';
import { PerformanceDashboard } from './PerformanceDashboard';
import { SourcingScreen } from './SourcingScreen';
import { MicroSokoInventory } from './MicroSokoInventory';
import { MicroSokoAdminDashboard } from './MicroSokoAdminDashboard';
import { MicroSokoExpenses } from './MicroSokoExpenses';
import { MicroSokoDelivery } from './MicroSokoDelivery';
import { MicroSokoReports } from './MicroSokoReports';
import { MicroSokoSettings } from './MicroSokoSettings';
import { Store, Factory, Activity, Calculator, LayoutDashboard, LogOut, Package, Receipt, Truck, BarChart3, Settings } from 'lucide-react';

export const MicroSokoDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('admin');

  return (
    <MicroSokoProvider>
      <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-[#05080e] overflow-hidden font-sans">
        {/* Sidebar / Bottom Nav on mobile */}
        <div className="order-last md:order-first w-full md:w-64 bg-slate-900 border-t md:border-t-0 md:border-r border-slate-800 flex flex-row md:flex-col items-center md:items-stretch text-white z-50">
          <div className="hidden md:flex h-16 items-center justify-center md:justify-start px-6 border-b border-slate-800">
            <Store className="w-8 h-8 text-emerald-400" />
            <span className="ml-3 font-black text-xl tracking-tight">MicroSoko</span>
          </div>
          <div className="flex-1 w-full flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto md:py-6 md:space-y-2 md:px-3 hide-scrollbar">
            {[
              { id: 'admin', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'pos', icon: Store, label: 'Fast POS' },
              { id: 'sourcing', icon: Calculator, label: 'Purchases' },
              { id: 'batch', icon: Factory, label: 'Batch Wizard' },
              { id: 'inventory', icon: Package, label: 'Inventory List' },
              { id: 'performance', icon: Activity, label: 'Performance' },
              { id: 'expenses', icon: Receipt, label: 'Expenses' },
              { id: 'delivery', icon: Truck, label: 'Delivery' },
              { id: 'reports', icon: BarChart3, label: 'Reports' },
              { id: 'settings', icon: Settings, label: 'Settings' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 md:w-full flex md:flex-row flex-col items-center justify-center md:justify-start p-3 md:rounded-xl transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <tab.icon className="w-5 h-5 md:w-6 md:h-6 shrink-0" />
                <span className="text-[10px] md:text-sm mt-1 md:mt-0 md:ml-3 font-bold truncate">{tab.label}</span>
              </button>
            ))}
            <button onClick={onLogout} className="flex-shrink-0 md:w-full flex md:flex-row flex-col items-center justify-center md:justify-start p-3 text-slate-400 hover:text-rose-400 hover:bg-slate-800 md:rounded-xl transition-colors md:hidden">
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-1 font-bold truncate">Sign Out</span>
            </button>
          </div>
          <div className="hidden md:block p-4 border-t border-slate-800">
            <button onClick={onLogout} className="w-full flex items-center justify-start p-3 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors">
              <LogOut className="w-6 h-6 shrink-0" />
              <span className="ml-3 font-bold truncate">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {activeTab === 'pos' && <FastPOS />}
          {activeTab === 'batch' && <ProductionBatchWizard />}
          {activeTab === 'sourcing' && <SourcingScreen />}
          {activeTab === 'performance' && <PerformanceDashboard />}
          {activeTab === 'admin' && <MicroSokoAdminDashboard onSwitchToSettings={() => setActiveTab('settings')} />}
          {activeTab === 'inventory' && <MicroSokoInventory />}
          {activeTab === 'expenses' && <MicroSokoExpenses />}
          {activeTab === 'delivery' && <MicroSokoDelivery />}
          {activeTab === 'reports' && <MicroSokoReports />}
          {activeTab === 'settings' && <MicroSokoSettings />}
        </div>
      </div>
    </MicroSokoProvider>
  );
};

