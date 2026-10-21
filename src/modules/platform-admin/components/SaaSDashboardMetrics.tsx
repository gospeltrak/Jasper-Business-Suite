import React, { useEffect, useMemo, useState } from 'react';
import { Users, DollarSign, Activity, Receipt, PieChart as PieChartIcon, BarChart2, TrendingUp, Share2, Landmark, Smartphone, Store, UserCog, Handshake } from 'lucide-react';
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
          onlineSessions: [],
          affiliates: [],
          affiliatePartners: [],
          referredCustomers: [],
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
      <div className="mobile-tablet-kpi-grid gap-3 sm:gap-4" style={{ ['--desktop-kpi-columns' as any]: 'repeat(5, minmax(0, 1fr))' }}>
        <KpiCard icon={Users} iconColor="blue" label="Subscribers" value={`${metrics?.subscribersCount || 0}`} />
        <KpiCard icon={DollarSign} iconColor="emerald" label="Total Revenue" value={`TZS ${(metrics?.totalIncome || 0).toLocaleString()}`} />
        <KpiCard icon={Share2} iconColor="amber" label="Affiliate Shares" value={`TZS ${(metrics?.affiliatePayouts || 0).toLocaleString()}`} />
        <KpiCard icon={Receipt} iconColor="rose" label="Total Expenses" value={`TZS ${(metrics?.expenses || 0).toLocaleString()}`} />
        <KpiCard icon={Landmark} iconColor="indigo" label="Net Balance" value={`TZS ${(metrics?.balance || 0).toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <LiveMetric icon={Activity} label="Online accounts" value={metrics?.activeSessions || 0} />
        <LiveMetric icon={Smartphone} label="Online devices" value={metrics?.onlineDevices || 0} />
        <LiveMetric icon={Store} label="Businesses online" value={metrics?.onlineBusinesses || 0} />
        <LiveMetric icon={Users} label="Tenant admins" value={metrics?.onlineTenantAdmins || 0} />
        <LiveMetric icon={UserCog} label="Tenant staff" value={metrics?.onlineTenantStaff || 0} />
        <LiveMetric icon={Share2} label="Affiliates online" value={metrics?.onlineAffiliates || 0} />
        <LiveMetric icon={Handshake} label="Partners online" value={metrics?.onlinePartners || 0} />
      </div>

      <p className="text-[11px] text-slate-500">
        Devices online: {metrics?.onlineDeviceTypes.Desktop || 0} desktop · {metrics?.onlineDeviceTypes.Tablet || 0} tablet · {metrics?.onlineDeviceTypes.Phone || 0} phone
      </p>

      {/* Graphs Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">

        {/* GRAPH 1: Bar graph: monthly users by package */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-4 shadow-sm shadow-black/20 sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
            <BarChart2 className="h-4 w-4 text-emerald-400" />
            <span>Monthly Users by Package</span>
          </h3>
          <div className="h-[220px] w-full sm:h-[250px]">
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
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-4 shadow-sm shadow-black/20 sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
            <PieChartIcon className="h-4 w-4 text-indigo-400" />
            <span>Package Subscribe Ratio</span>
          </h3>
          <div className="flex h-[220px] w-full items-center justify-center sm:h-[250px]">
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
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-4 shadow-sm shadow-black/20 sm:p-5 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <span>Organic vs Sub-Affiliate Subscriber Growth</span>
          </h3>
          <div className="h-[220px] w-full sm:h-[250px]">
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

const KPI_ICON_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-400',
  rose: 'bg-rose-500/10 text-rose-400',
  indigo: 'bg-indigo-500/10 text-indigo-400',
};

function KpiCard({ icon: Icon, iconColor, label, value }: { icon: React.ElementType; iconColor: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-800/80 bg-slate-900 p-4 shadow-sm shadow-black/20">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${KPI_ICON_COLORS[iconColor]}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="break-words text-sm font-bold leading-tight text-white sm:text-base">{value}</p>
      </div>
    </div>
  );
}

function LiveMetric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-3.5 shadow-sm shadow-black/20">
      <Icon className="mb-2 h-4 w-4 text-emerald-400" />
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-white sm:text-lg">{value.toLocaleString()}</p>
    </div>
  );
}
