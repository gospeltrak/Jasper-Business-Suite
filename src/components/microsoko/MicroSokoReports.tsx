import React, { useState, useMemo } from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { BarChart3, TrendingUp, DollarSign, Calendar, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { hasDemoData } from './microSokoDemoData';

export const MicroSokoReports: React.FC = () => {
  const ctx = useMicroSoko();
  const { sales, expenses, deliveries, items } = ctx;
  const [activeTab, setActiveTab] = useState('sales');

  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDeliveryCostBusiness = deliveries.filter(d=>d.paidBy === 'business').reduce((sum, d) => sum + d.cost, 0);

  // Precise profit calculation
  let totalCogs = 0;
  sales.forEach(s => {
    s.items.forEach(si => {
      let itemCogs = 0;
      if (si._batchesUsed && si._batchesUsed.length > 0) {
         si._batchesUsed.forEach(bu => {
            itemCogs += (bu.qty * (bu.costPerUnit || 0));
         });
      } else {
         const item = items.find(i => i.id === si.itemId);
         const cost = item ? item.averageCost : 0;
         itemCogs += (si.qty * cost);
      }
      totalCogs += itemCogs;
    });
  });

  const netProfit = totalSales - totalCogs - totalExpenses - totalDeliveryCostBusiness;

  // Chart Data Processing
  const chartData = useMemo(() => {
    const dataMap: Record<string, any> = {};

    // Group Sales
    sales.forEach(s => {
      const d = s.date.split('T')[0];
      if(!dataMap[d]) dataMap[d] = { date: d, Sales: 0, Expenses: 0, Production: 0, Delivery: 0, Purchases: 0 };
      dataMap[d].Sales += s.total;
    });

    // Group Expenses
    expenses.forEach(e => {
      const d = e.date.split('T')[0];
      if(!dataMap[d]) dataMap[d] = { date: d, Sales: 0, Expenses: 0, Production: 0, Delivery: 0, Purchases: 0 };
      dataMap[d].Expenses += e.amount;
    });

    // Group Deliveries
    deliveries.forEach(del => {
      const d = del.date.split('T')[0];
      if(!dataMap[d]) dataMap[d] = { date: d, Sales: 0, Expenses: 0, Production: 0, Delivery: 0, Purchases: 0 };
      if (del.paidBy === 'business') {
        dataMap[d].Delivery += del.cost;
        dataMap[d].Expenses += del.cost;
      }
    });

    // Group Purchases and Production
    items.forEach(item => {
      item.batches.forEach(b => {
        const d = b.date.split('T')[0];
        if(!dataMap[d]) dataMap[d] = { date: d, Sales: 0, Expenses: 0, Production: 0, Delivery: 0, Purchases: 0 };
        const totalCost = b.costPerUnit * b.quantityCreated;
        if (b.source === 'purchase') {
          dataMap[d].Purchases += totalCost;
        } else if (b.source === 'production') {
          dataMap[d].Production += totalCost;
        }
      });
    });

    // Calculate daily profit
    sales.forEach(s => {
      const d = s.date.split('T')[0];
      let dailyCogs = 0;
      s.items.forEach(si => {
        if (si._batchesUsed && si._batchesUsed.length > 0) {
          si._batchesUsed.forEach(bu => dailyCogs += (bu.qty * (bu.costPerUnit || 0)));
        } else {
          const item = items.find(i => i.id === si.itemId);
          dailyCogs += (si.qty * (item ? item.averageCost : 0));
        }
      });
      if(dataMap[d]) {
        dataMap[d].Profit = (dataMap[d].Sales || 0) - dailyCogs - (dataMap[d].Expenses || 0);
      }
    });

    // Ensure all days have Profit field
    Object.keys(dataMap).forEach(k => {
      if (dataMap[k].Profit === undefined) dataMap[k].Profit = 0;
    });

    return Object.values(dataMap).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, expenses, deliveries, items]);

  const isEmpty = sales.length === 0 && expenses.length === 0 && items.length === 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-lg">
          <p className="font-bold text-slate-800 mb-2">{new Date(label).toLocaleDateString()}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center space-x-4 mb-1">
              <span className="text-sm font-semibold" style={{ color: entry.color }}>{entry.name}:</span>
              <span className="text-sm font-mono font-bold text-slate-700">TZS {entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Business Reports</h2>
          <p className="text-slate-500">Analyze your performance and true profit.</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-12 text-center">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">No data yet</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Add sales, expenses, or load demo data in Settings to see your business reports and charts here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Sales</p>
              <p className="text-2xl font-black text-emerald-600">TZS {totalSales.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cost of Goods</p>
              <p className="text-2xl font-black text-amber-600">TZS {Math.round(totalCogs).toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Expenses</p>
              <p className="text-2xl font-black text-rose-600">TZS {(totalExpenses + totalDeliveryCostBusiness).toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Net Profit</p>
              <p className="text-2xl font-black text-indigo-600">TZS {Math.round(netProfit).toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 mb-6">
             <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-indigo-500" /> Primary Business Metrics</h3>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                      stroke="#94a3b8" 
                      fontSize={12} 
                      tickMargin={10} 
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={12} 
                      tickFormatter={(val) => `TZS ${val >= 1000 ? (val/1000)+'k' : val}`} 
                      tickMargin={10}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="Sales" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Profit" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 mb-6">
             <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><DollarSign className="w-5 h-5 mr-2 text-amber-500" /> Operational Costs</h3>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                      stroke="#94a3b8" 
                      fontSize={12} 
                      tickMargin={10} 
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={12} 
                      tickFormatter={(val) => `TZS ${val >= 1000 ? (val/1000)+'k' : val}`} 
                      tickMargin={10}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="Purchases" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Production" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Delivery" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-200 overflow-x-auto">
              <button onClick={()=>setActiveTab('sales')} className={`px-6 py-4 font-bold text-sm text-center whitespace-nowrap outline-none flex-1 lg:flex-none ${activeTab==='sales' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}>Sales List</button>
              <button onClick={()=>setActiveTab('expenses')} className={`px-6 py-4 font-bold text-sm text-center whitespace-nowrap outline-none flex-1 lg:flex-none ${activeTab==='expenses' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}>Expenses List</button>
              <button onClick={()=>setActiveTab('production')} className={`px-6 py-4 font-bold text-sm text-center whitespace-nowrap outline-none flex-1 lg:flex-none ${activeTab==='production' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}>Production Performance</button>
            </div>

            <div className="p-0">
              {activeTab === 'sales' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr><th className="p-4">Date</th><th className="p-4">Items</th><th className="p-4 text-right">Total Sold</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sales.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(s => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-4 font-semibold text-slate-700">{new Date(s.date).toLocaleString()}</td>
                          <td className="p-4 text-slate-600">{s.items.map(i=>`${i.name} (x${i.qty})`).join(', ')}</td>
                          <td className="p-4 font-mono font-bold text-emerald-600 text-right">TZS {s.total.toLocaleString()}</td>
                        </tr>
                      ))}
                      {sales.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-400">No sales data.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {activeTab === 'expenses' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr><th className="p-4">Date</th><th className="p-4">Item/Activity</th><th className="p-4 text-right">Amount</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="p-4 font-semibold text-slate-700">{new Date(e.date).toLocaleDateString()}</td>
                          <td className="p-4 text-slate-600 font-semibold">{e.name} <span className="text-xs font-normal bg-slate-100 text-slate-500 px-2 py-0.5 rounded ml-2">{e.category}</span></td>
                          <td className="p-4 font-mono font-bold text-rose-600 text-right">TZS {e.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      {deliveries.filter(d=>d.paidBy === 'business').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(d => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="p-4 font-semibold text-slate-700">{new Date(d.date).toLocaleDateString()}</td>
                          <td className="p-4 text-slate-600 font-semibold">Delivery <span className="text-xs font-normal bg-slate-100 text-slate-500 px-2 py-0.5 rounded ml-2">{d.type}</span></td>
                          <td className="p-4 font-mono font-bold text-rose-600 text-right">TZS {d.cost.toLocaleString()}</td>
                        </tr>
                      ))}
                      {expenses.length === 0 && deliveries.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-400">No expenses data.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {activeTab === 'production' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Product</th>
                        <th className="p-4">Actual Output</th>
                        <th className="p-4">Expected Output</th>
                        <th className="p-4 text-center">Yield Efficiency</th>
                        <th className="p-4 text-right">Cost Per Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.flatMap(i => i.batches.filter(b => b.source === 'production').map(b => ({...b, itemName: i.name})))
                        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(b => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="p-4 font-semibold text-slate-700">{new Date(b.date).toLocaleDateString()}</td>
                          <td className="p-4 text-slate-600 font-bold">{b.itemName}</td>
                          <td className="p-4 font-semibold">{b.actualOutput || b.quantityCreated}</td>
                          <td className="p-4 text-slate-500">{b.expectedOutput || '-'}</td>
                          <td className="p-4 text-center">
                            {b.efficiency !== undefined ? (
                              <span className={`px-2 py-1 rounded-lg text-xs font-bold ${b.efficiency < 100 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {b.efficiency}%
                              </span>
                            ) : '-'}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-800 text-right">TZS {b.costPerUnit.toLocaleString()}</td>
                        </tr>
                      ))}
                      {items.flatMap(i => i.batches.filter(b => b.source === 'production')).length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No production batches recorded.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
