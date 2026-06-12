import React, { useState, useEffect } from 'react';
import { TrendingUp, FileText, Search, AlertCircle, BarChart3, Package, Globe, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function SaaSHardwareSales() {
  const [sales, setSales] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'payment' | 'affiliates' | 'distribution'>('overview');

  useEffect(() => {
    const rawSales = localStorage.getItem('saas_hw_sales');
    if (rawSales) {
      setSales(JSON.parse(rawSales));
    }
    const rawSubs = localStorage.getItem('jasper_system_roles');
    if (rawSubs) {
      setSubscribers(JSON.parse(rawSubs));
    } else {
      setSubscribers([
        { name: 'Dr. John Okoth', licenseLevel: 'Premium', region: 'Dar es Salaam' },
        { name: 'Mikumi Resort', licenseLevel: 'Enterprise', region: 'Morogoro' },
        { name: 'Sarah Jasper', licenseLevel: 'Pro', region: 'Arusha' }
      ]);
    }
  }, []);

  const filteredSales = sales.filter(s => 
    s.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.receiptNo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  let totalRevenue = 0;
  let singleCount = 0;
  let singleRevenue = 0;
  let setCount = 0;
  let setRevenue = 0;
  
  const paymentMethods: Record<string, number> = { 'Cash': 0, 'Card': 0, 'Mobile': 0, 'Bank': 0, 'Credit': 0 };
  
  let affiliateCreditQty = 0;
  let affiliateCreditOwed = 0;
  let affiliateTotalSales = 0;
  
  let affiliatePaidTotal = 0;
  let affiliatePaidQty = 0;
  let affiliatePaidSets = 0;
  let affiliatePaidSetsValue = 0;
  let affiliatePaidSingles = 0;
  let affiliatePaidSinglesValue = 0;
  let affiliateUnpaidSets = 0;
  let affiliateUnpaidSetsValue = 0;
  let affiliateUnpaidSingles = 0;
  let affiliateUnpaidSinglesValue = 0;
  
  const packageCounts: Record<string, number> = {};
  const regionCounts: Record<string, number> = {};
  const itemTracking: Record<string, { totalSold: number, toSubscribers: number, toAffiliates: number, toWalkIn: number }> = {};

  filteredSales.forEach(sale => {
    totalRevenue += sale.total;
    
    const payMethod = sale.paymentMethod || 'Cash';
    paymentMethods[payMethod] = (paymentMethods[payMethod] || 0) + sale.total;

    if (sale.isAffiliate) {
      affiliateTotalSales += sale.total;
      if (payMethod === 'Credit') {
        affiliateCreditOwed += sale.total;
        sale.items.forEach((item: any) => {
          affiliateCreditQty += item.qty;
          const isSet = item.category === 'Bundle' || (item.name || '').toLowerCase().includes('set');
          if (isSet) {
            affiliateUnpaidSets += item.qty;
            affiliateUnpaidSetsValue += (item.qty * item.price);
          } else {
            affiliateUnpaidSingles += item.qty;
            affiliateUnpaidSinglesValue += (item.qty * item.price);
          }
        });
      } else {
        affiliatePaidTotal += sale.total;
        sale.items.forEach((item: any) => {
          affiliatePaidQty += item.qty;
          const isSet = item.category === 'Bundle' || (item.name || '').toLowerCase().includes('set');
          if (isSet) {
            affiliatePaidSets += item.qty;
            affiliatePaidSetsValue += (item.qty * item.price);
          } else {
            affiliatePaidSingles += item.qty;
            affiliatePaidSinglesValue += (item.qty * item.price);
          }
        });
      }
    }

    const sub = subscribers.find(s => s.name === sale.customerName);
    const pkg = sub?.licenseLevel || 'Standard';
    const rgnOptions = ['Dar es Salaam', 'Arusha', 'Mwanza', 'Dodoma', 'Mbeya', 'Zanzibar'];
    const fallbackRgn = rgnOptions[(sale.customerName?.length || 0) % rgnOptions.length];
    const rgn = sub?.region || fallbackRgn;

    sale.items.forEach((item: any) => {
      if (item.category === 'Bundle' || (item.name || '').toLowerCase().includes('set')) {
        setCount += item.qty;
        setRevenue += item.price * item.qty;
      } else {
        singleCount += item.qty;
        singleRevenue += item.price * item.qty;
      }

      packageCounts[pkg] = (packageCounts[pkg] || 0) + item.qty;
      regionCounts[rgn] = (regionCounts[rgn] || 0) + item.qty;

      // Tracking item destination
      if (!itemTracking[item.name]) {
        itemTracking[item.name] = { totalSold: 0, toSubscribers: 0, toAffiliates: 0, toWalkIn: 0 };
      }
      itemTracking[item.name].totalSold += item.qty;
      if (sale.isAffiliate) itemTracking[item.name].toAffiliates += item.qty;
      else if (sale.isSubscriber) itemTracking[item.name].toSubscribers += item.qty;
      else itemTracking[item.name].toWalkIn += item.qty;
    });
  });

  const topPackage = Object.entries(packageCounts).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];
  const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

  const pieData = [
    { name: 'Single Devices', value: singleCount },
    { name: 'Sets/Bundles', value: setCount }
  ].filter(d => d.value > 0);

  const paymentData = Object.entries(paymentMethods)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0);

  const regionData = Object.entries(regionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#2dd4bf'];

  const TABS = [
    { id: 'overview', name: 'Overview' },
    { id: 'payment', name: 'Payment Method Report' },
    { id: 'affiliates', name: 'Super Affiliate Analytics' },
    { id: 'distribution', name: 'Hardware Distribution' },
  ] as const;

  return (
    <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Hardware Sales Analytics</h3>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">View sales history, regional data, and hardware distribution.</p>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-0 overflow-x-auto">
        {TABS.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-[10px] font-bold uppercase whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500' : 'text-slate-500 hover:text-white border-transparent'}`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top 4 Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Total Revenue</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">{totalRevenue.toLocaleString()} TZS</span>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-indigo-400 block mb-1 flex items-center gap-1"><Package className="w-3 h-3" /> Top Subscriber Pkg</span>
              <span className="text-lg font-bold text-indigo-300">{topPackage[0]} <span className="text-xs text-indigo-400/50">({topPackage[1]} units)</span></span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-emerald-400 block mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Top Region</span>
              <span className="text-lg font-bold text-emerald-300">{topRegion[0]} <span className="text-xs text-emerald-400/50">({topRegion[1]} units)</span></span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-amber-500 block mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Due from Affiliates</span>
              <span className="text-lg font-bold text-amber-400 font-mono">{affiliateCreditOwed.toLocaleString()} TZS</span>
              <span className="text-[9px] text-amber-500 block mt-1">{affiliateCreditQty} units on credit</span>
            </div>
          </div>

          {/* Analytics Charts */}
          {sales.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                <h4 className="text-[10px] uppercase font-mono text-slate-400 mb-4 text-center">Single vs Bundle Sales</h4>
                <div className="h-40 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} dataKey="value" stroke="none">
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '10px' }} itemStyle={{ color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center space-x-4 mt-2">
                  <div className="text-center">
                    <span className="text-[9px] text-slate-500 block">Single Devices</span>
                    <span className="text-xs font-bold text-[#818cf8]">{singleCount} units</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-slate-500 block">Bundles/Sets</span>
                    <span className="text-xs font-bold text-[#34d399]">{setCount} units</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl col-span-1 lg:col-span-2">
                <h4 className="text-[10px] uppercase font-mono text-slate-400 mb-4 text-center">Top Devices by Region (Units)</h4>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                      <RechartsTooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '10px' }} />
                      <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* Raw Data Log */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 mt-4">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search by customer or receipt..."
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl py-2 pl-9 pr-4 focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-[10px] text-slate-500 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Receipt</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Payment Info</th>
                  <th className="p-3">Items</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredSales.map((sale, i) => (
                  <tr key={i} className="hover:bg-slate-900/40">
                    <td className="p-3 text-slate-400">{new Date(sale.date).toLocaleDateString()}</td>
                    <td className="p-3 text-indigo-400">{sale.receiptNo}</td>
                    <td className="p-3 text-white font-sans">{sale.customerName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase ${sale.isAffiliate ? 'bg-amber-500/10 text-amber-400' : sale.isSubscriber ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-300'}`}>
                        {sale.isAffiliate ? 'Affiliate' : sale.isSubscriber ? 'Subscriber' : 'Walk-in'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase ${sale.paymentMethod === 'Credit' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-300'}`}>
                          {sale.paymentMethod || 'Cash'}
                        </span>
                        {sale.traReceipt && <span className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">EFD</span>}
                      </div>
                    </td>
                    <td className="p-3 text-slate-300">{sale.items.map((it: any) => `${it.qty}x ${it.name}`).join(', ')}</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">{sale.total.toLocaleString()}</td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">No hardware sales on record.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payment' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl">
            <h4 className="text-xs uppercase font-mono text-white mb-6 font-bold">Revenue by Payment Method</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {['Cash', 'Card', 'Mobile', 'Bank', 'Credit'].map(method => (
                <div key={method} className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">{method}</span>
                  <span className={`text-lg font-bold font-mono ${method === 'Credit' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {(paymentMethods[method] || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                  <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <RechartsTooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '12px' }} formatter={(value: number) => value.toLocaleString() + ' TZS'} />
                  <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'affiliates' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Total Hardware Sold</span>
              <span className="text-xl font-bold text-white font-mono">{affiliateTotalSales.toLocaleString()} TZS</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-emerald-500 block mb-1">Total Overall Paid</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">{affiliatePaidTotal.toLocaleString()} TZS</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-amber-500 block mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Total Overall Unpaid</span>
              <span className="text-xl font-bold text-amber-400 font-mono">{affiliateCreditOwed.toLocaleString()} TZS</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Devices Lent out</span>
              <span className="text-xl font-bold text-indigo-400 font-mono">{affiliateCreditQty} units</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
              <h4 className="text-xs uppercase font-mono text-emerald-400 font-bold mb-4 border-b border-emerald-500/20 pb-2">Paid Hardware Breakdown</h4>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Sets/Bundles Paid</span>
                  <div className="text-right">
                    <span className="text-white font-bold block">{affiliatePaidSets} sets</span>
                    <span className="text-slate-500 text-[10px]">Value: {affiliatePaidSetsValue.toLocaleString()} TZS</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Single Units Paid</span>
                  <div className="text-right">
                    <span className="text-white font-bold block">{affiliatePaidSingles} items</span>
                    <span className="text-slate-500 text-[10px]">Value: {affiliatePaidSinglesValue.toLocaleString()} TZS</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
              <h4 className="text-xs uppercase font-mono text-amber-400 font-bold mb-4 border-b border-amber-500/20 pb-2">Unpaid (Due) Hardware Breakdown</h4>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Sets/Bundles Due</span>
                  <div className="text-right">
                    <span className="text-white font-bold block">{affiliateUnpaidSets} sets</span>
                    <span className="text-amber-500/70 text-[10px]">Value: {affiliateUnpaidSetsValue.toLocaleString()} TZS</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Single Units Due</span>
                  <div className="text-right">
                    <span className="text-white font-bold block">{affiliateUnpaidSingles} items</span>
                    <span className="text-amber-500/70 text-[10px]">Value: {affiliateUnpaidSinglesValue.toLocaleString()} TZS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto bg-slate-950 border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-[10px] text-slate-500 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Super Affiliate</th>
                  <th className="p-3">Payment Info</th>
                  <th className="p-3">Items Sent to Location</th>
                  <th className="p-3 text-right">Value (TZS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {sales.filter(s => s.isAffiliate).map((sale, i) => (
                  <tr key={i} className="hover:bg-slate-900/40">
                    <td className="p-3 text-slate-400">{new Date(sale.date).toLocaleDateString()}</td>
                    <td className="p-3 text-amber-400 font-bold">{sale.customerName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase ${sale.paymentMethod === 'Credit' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-300'}`}>
                        {sale.paymentMethod || 'Cash'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{sale.items.map((it: any) => `${it.qty}x ${it.name}`).join(', ')}</td>
                    <td className="p-3 text-right text-white font-bold">{sale.total.toLocaleString()}</td>
                  </tr>
                ))}
                {sales.filter(s => s.isAffiliate).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">No hardware shipments to Affiliates yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'distribution' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl">
            <h4 className="text-xs uppercase font-mono text-white mb-4 font-bold">Hardware Dispersion by Device</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-[10px] text-slate-500 uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Device Name</th>
                    <th className="p-3 text-center">Total Distributed</th>
                    <th className="p-3 text-center text-emerald-400">To Subscribers</th>
                    <th className="p-3 text-center text-amber-400">To Affiliates</th>
                    <th className="p-3 text-center text-slate-400">To Walk-ins</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {Object.entries(itemTracking).map(([name, stats], i) => (
                    <tr key={name} className="hover:bg-slate-900/40">
                      <td className="p-3 text-white font-sans font-bold">{name}</td>
                      <td className="p-3 text-center font-bold text-indigo-400">{stats.totalSold}</td>
                      <td className="p-3 text-center text-emerald-400">{stats.toSubscribers}</td>
                      <td className="p-3 text-center text-amber-400">{stats.toAffiliates}</td>
                      <td className="p-3 text-center text-slate-400">{stats.toWalkIn}</td>
                    </tr>
                  ))}
                  {Object.keys(itemTracking).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">No hardware items distributed yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
