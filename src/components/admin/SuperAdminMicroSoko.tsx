import React from 'react';
import { LayoutDashboard, Users, CreditCard, Activity, ArrowUpRight, Search, Filter } from 'lucide-react';

const mockTenants = [
  { id: 'tn_1', name: 'Mama Lishe Kariakoo', plan: 'soko_mwezi_monthly', income: 10000, agent: 'Tunde Jasper', health: 'excellent' },
  { id: 'tn_2', name: 'Baraka Millers', plan: 'soko_wiki_weekly', income: 12000, agent: 'Sarah N.', health: 'warning' },
  { id: 'tn_3', name: 'Salum Chips', plan: 'soko_siku_daily', income: 7500, agent: 'Unknown', health: 'stable' },
  { id: 'tn_4', name: 'Upendo Bakery Mbeya', plan: 'soko_mwezi_monthly', income: 30000, agent: 'Tunde Jasper', health: 'excellent' },
];

export const SuperAdminMicroSoko: React.FC = () => {
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'stable': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'warning': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'critical': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getPlanName = (plan: string) => {
    if (plan.includes('mwezi')) return 'Monthly';
    if (plan.includes('wiki')) return 'Weekly';
    return 'Daily';
  };

  return (
    <div className="min-h-screen bg-[#05080e] text-slate-300 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 mb-2">
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-bold tracking-wider uppercase text-xs">Jasper Core Admin</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">MicroSoko Fleet Monitoring</h1>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Active MRR</p>
              <p className="text-2xl font-black text-emerald-400 font-mono">2,450,000 <span className="text-sm">TZS</span></p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0b111e] p-6 rounded-xl border border-slate-800">
            <Users className="w-6 h-6 text-slate-500 mb-4" />
            <p className="text-sm text-slate-500 font-medium mb-1">Total Active Tenants</p>
            <p className="text-3xl font-black text-white">1,248</p>
          </div>
          <div className="bg-[#0b111e] p-6 rounded-xl border border-slate-800">
            <Activity className="w-6 h-6 text-emerald-500 mb-4" />
            <p className="text-sm text-slate-500 font-medium mb-1">Avg 7-Day Usage Health</p>
            <p className="text-3xl font-black text-white">94% <span className="text-sm text-emerald-500 font-bold ml-2">↑ +2%</span></p>
          </div>
          <div className="bg-[#0b111e] p-6 rounded-xl border border-slate-800">
            <CreditCard className="w-6 h-6 text-indigo-500 mb-4" />
            <p className="text-sm text-slate-500 font-medium mb-1">Monthly Conversion Rate</p>
            <p className="text-3xl font-black text-white">41%</p>
          </div>
          <div className="bg-[#0b111e] p-6 rounded-xl border border-slate-800">
            <ArrowUpRight className="w-6 h-6 text-amber-500 mb-4" />
            <p className="text-sm text-slate-500 font-medium mb-1">Affiliate Generated Signups</p>
            <p className="text-3xl font-black text-white">890</p>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-[#0b111e] rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white">Live Fleet Roster</h2>
            <div className="flex gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Search className="w-4 h-4" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search tenants..." 
                  className="pl-9 pr-4 py-2 bg-[#05080e] border border-slate-800 rounded-lg text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none w-full md:w-64"
                />
              </div>
              <button className="px-3 py-2 bg-[#05080e] border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-2">
                <Filter className="w-4 h-4" /> <span className="text-sm font-medium">Filter</span>
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#080d16] text-slate-400 uppercase text-xs tracking-wider border-b border-slate-800">
                  <th className="px-6 py-4 font-semibold">Tenant Domain</th>
                  <th className="px-6 py-4 font-semibold">Active Plan</th>
                  <th className="px-6 py-4 font-semibold text-right">LTV Generated</th>
                  <th className="px-6 py-4 font-semibold">Health Index</th>
                  <th className="px-6 py-4 font-semibold">Affiliate Agent</th>
                  <th className="px-6 py-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {mockTenants.map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{t.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded">
                        {getPlanName(t.plan)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-mono font-bold text-white">{t.income.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">TZS</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded border text-xs font-bold uppercase tracking-wider ${getHealthColor(t.health)}`}>
                        {t.health}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-300 font-medium">
                        {t.agent === 'Unknown' ? <span className="text-slate-600 italic">Organic/None</span> : t.agent}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors">
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-slate-800 bg-[#080d16] flex justify-between items-center text-sm text-slate-500">
            <span>Showing 4 of 1,248</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 hover:text-white transition-colors disabled:opacity-50" disabled>Yield</button>
              <button className="px-3 py-1 hover:text-white transition-colors">Next</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
