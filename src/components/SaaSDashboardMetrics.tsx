import React, { useEffect, useMemo, useState } from 'react';
import { Users, DollarSign, Activity, Receipt, PieChart as PieChartIcon, BarChart2, TrendingUp, TrendingDown, Share2, Wallet, Banknote, Landmark } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { buildSuperAdminMetrics, loadSuperAdminOverview, SuperAdminMetrics } from '../utils/superAdminData';

export default function SaaSDashboardMetrics() {
  const [metrics, setMetrics] = useState<SuperAdminMetrics | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    loadSuperAdminOverview()
      .then((overview) => {
        if (!alive) return;
        setMetrics(buildSuperAdminMetrics(overview));
        setLoadError('');
      })
      .catch((error: any) => {
        if (!alive) return;
        setLoadError(error?.message || 'Unable to load Super Admin metrics.');
        setMetrics(buildSuperAdminMetrics({
          tenants: [],
          users: [],
          workspaces: [],
          sessions: [],
          affiliates: [],
          referrals: [],
          sourceTracking: [],
          commissions: [],
          payouts: [],
          auditLogs: []
        }));
      });
    return () => { alive = false; };
  }, []);

  const chartKeys = useMemo(() => {
    const keys = new Set<string>();
    (metrics?.monthlyUsersByPackage || []).forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key !== 'name') keys.add(key);
      });
    });
    return Array.from(keys);
  }, [metrics]);

  const monthlyUsersByPackage = metrics?.monthlyUsersByPackage || [];
  const packageDistribution = metrics?.packageDistribution || [];
  const organicVsAffiliate = metrics?.organicVsAffiliate || [];
  const colors = ['#34d399', '#60a5fa', '#f87171', '#f59e0b', '#a78bfa', '#22d3ee'];

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-200">
          {loadError}
        </div>
      )}

      {/* Top Value Cards */}
      <div className="mobile-tablet-kpi-grid gap-4" style={{ ['--desktop-kpi-columns' as any]: 'repeat(5, minmax(0, 1fr))' }}>
        {/* Subscribers Count */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Subscribers</span>
            <div className="text-lg font-bold text-white leading-tight">{metrics?.subscribersCount || 0} Users</div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Total Revenue</span>
            <div className="text-lg font-bold text-white leading-tight">TZS {(metrics?.totalIncome || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Total Affiliate Shares */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Total Affiliates Shares</span>
            <div className="text-lg font-bold text-white leading-tight">TZS {(metrics?.affiliatePayouts || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Total Expenses</span>
            <div className="text-lg font-bold text-white leading-tight">TZS {(metrics?.expenses || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Balance Remaining */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Net Balance</span>
            <div className="text-lg font-bold text-white leading-tight">TZS {(metrics?.balance || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Graphs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GRAPH 1: Bar graph: monthly users by package */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <h3 className="text-xs font-mono font-black text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            <span>Monthly Users by Package</span>
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyUsersByPackage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                {chartKeys.map((key, index) => (
                  <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 2: Cycle graph: most subscribed packages */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <h3 className="text-xs font-mono font-black text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
            <PieChartIcon className="w-4 h-4 text-indigo-400" />
            <span>Package Subscribe Ratio</span>
          </h3>
          <div className="h-[250px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={packageDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {packageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || colors[index % colors.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 3: Line graph: organic subscribers vs promo-code subscribers */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl lg:col-span-2">
          <h3 className="text-xs font-mono font-black text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Organic vs Sub-Affiliate Subscriber Growth</span>
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={organicVsAffiliate} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="Organic" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }} />
                <Line type="monotone" dataKey="Affiliate" name="Sub-Affiliate" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
