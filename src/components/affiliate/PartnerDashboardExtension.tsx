import React, { useMemo } from 'react';
import { Network, Wallet, Link as LinkIcon, Download, Sparkles, TrendingUp, Users } from 'lucide-react';

const agentReferrals = [
  { id: '1', shopName: 'Mwajuma Bites', plan: 'Monthly', status: 'Active', mrrContributed: 10000, lastPayment: '2026-06-16' },
  { id: '2', shopName: 'Kijitonyama Barbers', plan: 'Weekly', status: 'Active', mrrContributed: 12000, lastPayment: '2026-06-15' },
  { id: '3', shopName: 'Sinza Millers', plan: 'Monthly', status: 'Active', mrrContributed: 10000, lastPayment: '2026-06-12' },
  { id: '4', shopName: 'Wauza Chips Ilala', plan: 'Daily', status: 'Inactive', mrrContributed: 0, lastPayment: '2026-06-05' },
];

export const PartnerDashboardExtension: React.FC = () => {
  const COMMISSION_RATE = 0.15; // 15% Net Commission

  const metrics = useMemo(() => {
    let activeNodes = 0;
    let totalMRR = 0;
    agentReferrals.forEach(ref => {
      if (ref.status === 'Active') {
        activeNodes++;
        totalMRR += ref.mrrContributed;
      }
    });
    const monthlyCommissionBase = totalMRR * COMMISSION_RATE;
    return { activeNodes, totalMRR, monthlyCommissionBase };
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
      
      {/* Header Profile Area */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-white dark:bg-[#0b111e] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-6">
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center border-2 border-indigo-200 dark:border-indigo-800">
             <Network className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">Field Agent Partner</h1>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">ID: AGT-990-2XZ • 15% Master Rate</p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <LinkIcon className="w-4 h-4 mr-2" /> Share Link
          </button>
          <button className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] transition-all active:scale-95">
            <Wallet className="w-4 h-4 mr-2" /> Payout Menu
          </button>
        </div>
      </div>

      {/* Main Income Tracking Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Sparkles className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <p className="text-indigo-100 font-bold tracking-wider text-sm mb-2 uppercase">Projected Monthly Yield (15%)</p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black font-mono tracking-tight">{metrics.monthlyCommissionBase.toLocaleString()}</span>
              <span className="text-lg font-bold text-indigo-200">TZS</span>
            </div>
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/20 inline-flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="w-4 h-4 text-emerald-300" /> +4,500 pending release
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-905 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hidden md:flex">
          <div>
             <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Total MRR Generated</p>
             <div className="flex items-baseline gap-2">
               <span className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{metrics.totalMRR.toLocaleString()}</span>
               <span className="text-sm font-bold text-slate-500">TZS/mo</span>
             </div>
          </div>
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">View aggregate volume details →</p>
        </div>

        <div className="bg-white dark:bg-slate-905 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
             <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Active Fleet Nodes</p>
             <div className="flex items-baseline gap-2">
               <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">{metrics.activeNodes}</span>
               <span className="text-sm font-bold text-slate-500">Merchants</span>
             </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-4">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(metrics.activeNodes / agentReferrals.length) * 100}%` }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">{(metrics.activeNodes / agentReferrals.length) * 100}% of network is active</p>
        </div>

      </div>

      {/* Fleet Roster */}
      <div className="bg-white dark:bg-slate-905 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#0c121d]">
          <h2 className="font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" /> Referred Merchant Fleet
          </h2>
          <button className="text-sm font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center">
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white dark:bg-slate-905 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4">Shop Details</th>
                <th className="px-6 py-4">Current Plan</th>
                <th className="px-6 py-4">Network Status</th>
                <th className="px-6 py-4 text-right">Contributed MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {agentReferrals.map((ref) => (
                <tr key={ref.id} className="hover:bg-slate-50 dark:hover:bg-[#111a2a] transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 dark:text-white">{ref.shopName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Joined via Ref ID {ref.id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700">
                      {ref.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {ref.status === 'Active' ? (
                      <span className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-bold text-rose-600 dark:text-rose-400">
                        <span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span> Offline
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold">
                    <span className="text-slate-900 dark:text-white">{ref.mrrContributed.toLocaleString()}</span>
                    <span className="text-xs text-slate-500 ml-1">TZS</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Empty State / Add more prompt */}
        <div className="bg-slate-50 dark:bg-slate-900/30 p-4 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Expand your fleet. Share your link with more merchants.</p>
        </div>
      </div>
      
    </div>
  );
};
