import React, { useState } from 'react';
import { Users, DollarSign, Activity, Receipt, PieChart as PieChartIcon, BarChart2, TrendingUp, TrendingDown, Share2, Wallet, Banknote, Landmark } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';

export default function SaaSDashboardMetrics() {
  const [metrics] = useState({
    subscribersCount: 145,
    totalIncome: 15400000,
    affiliatePayoutPercent: 21.5,
    expenses: 3200000,
    balance: 12200000
  });

  const generateMockGraphData = () => {
    // 1. Bar graph: monthly users by package
    const monthlyUsersByPackage = [
      { name: 'Jan', 'Starter Plan': 20, 'Premium Plan': 10, 'Enterprise Plan': 2 },
      { name: 'Feb', 'Starter Plan': 25, 'Premium Plan': 12, 'Enterprise Plan': 3 },
      { name: 'Mar', 'Starter Plan': 35, 'Premium Plan': 20, 'Enterprise Plan': 5 },
      { name: 'Apr', 'Starter Plan': 40, 'Premium Plan': 28, 'Enterprise Plan': 7 },
      { name: 'May', 'Starter Plan': 55, 'Premium Plan': 35, 'Enterprise Plan': 10 },
      { name: 'Jun', 'Starter Plan': 60, 'Premium Plan': 40, 'Enterprise Plan': 12 },
    ];

    // 2. Cycle graph (Pie Chart): most subscribed packages
    const packageDistribution = [
      { name: 'Starter Plan', value: 85, color: '#34d399' },
      { name: 'Premium Plan', value: 45, color: '#60a5fa' },
      { name: 'Enterprise Plan', value: 15, color: '#f87171' },
    ];

    // 3. Line graph: organic subscribers vs affiliate subscribers
    const organicVsAffiliate = [
      { name: 'Jan', 'Organic': 15, 'Affiliate': 5 },
      { name: 'Feb', 'Organic': 20, 'Affiliate': 10 },
      { name: 'Mar', 'Organic': 25, 'Affiliate': 18 },
      { name: 'Apr', 'Organic': 28, 'Affiliate': 30 },
      { name: 'May', 'Organic': 35, 'Affiliate': 45 },
      { name: 'Jun', 'Organic': 40, 'Affiliate': 55 },
    ];

    return { monthlyUsersByPackage, packageDistribution, organicVsAffiliate };
  };

  const { monthlyUsersByPackage, packageDistribution, organicVsAffiliate } = generateMockGraphData();

  return (
    <div className="space-y-6">
      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Subscribers Count */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Subscribers</span>
            <div className="text-lg font-bold text-white leading-tight">{metrics.subscribersCount} Users</div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Total Revenue</span>
            <div className="text-lg font-bold text-white leading-tight">TZS {metrics.totalIncome.toLocaleString()}</div>
          </div>
        </div>

        {/* Total Affiliate Shares */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Total Affiliates Shares</span>
            <div className="text-lg font-bold text-white leading-tight">TZS {(metrics.totalIncome * (metrics.affiliatePayoutPercent / 100)).toLocaleString()}</div>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Total Expenses</span>
            <div className="text-lg font-bold text-white leading-tight">TZS {metrics.expenses.toLocaleString()}</div>
          </div>
        </div>

        {/* Balance Remaining */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-4 lg:col-span-1 md:col-span-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Net Balance</span>
            <div className="text-lg font-bold text-white leading-tight">TZS {(metrics.totalIncome - (metrics.totalIncome * 0.20) - metrics.expenses).toLocaleString()}</div>
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
                <Bar dataKey="Starter Plan" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Premium Plan" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Enterprise Plan" fill="#f87171" radius={[4, 4, 0, 0]} />
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
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 3: Line graph: organic subscribers vs affiliate subscribers */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl lg:col-span-2">
          <h3 className="text-xs font-mono font-black text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Organic vs Affiliate Subscriber Growth</span>
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
                <Line type="monotone" dataKey="Affiliate" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
