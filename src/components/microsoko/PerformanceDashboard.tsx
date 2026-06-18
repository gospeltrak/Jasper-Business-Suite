import React from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle } from 'lucide-react';

export const PerformanceDashboard: React.FC = () => {
  const { sales, expenses, deliveries, items } = useMicroSoko();

  const totalSales = sales.reduce((s, c) => s + c.total, 0);
  const totalExpenses = expenses.reduce((s, c) => s + c.amount, 0);
  
  let totalCogs = 0;
  sales.forEach(s => {
    s.items.forEach(si => {
      let itemCogs = 0;
      if (si._batchesUsed && si._batchesUsed.length > 0) {
         si._batchesUsed.forEach((bu: any) => {
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

  const netProfit = totalSales - totalCogs - totalExpenses;
  const isHealthy = netProfit > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Performance & Health</h2>
        <p className="text-slate-500">Simple business health diagnostics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center text-center space-y-2 ${isHealthy ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
             {isHealthy ? <CheckCircle className="w-12 h-12 text-emerald-500" /> : <AlertTriangle className="w-12 h-12 text-rose-500" />}
             <h3 className="text-xl font-black text-slate-800">
                {isHealthy ? 'Biashara inakwenda vizuri' : 'Kuna changamoto ya faida'}
             </h3>
             <p className="text-slate-600">
                {isHealthy ? 'Mauzo yanazidi gharama. Faida inaonekana.' : 'Gharama au manunuzi yanazidi mauzo kwa sasa.'}
             </p>
         </div>
         
         <div className="space-y-4">
            <div className="bg-white p-5 border border-slate-200 rounded-2xl flex items-center">
               <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mr-4">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
               </div>
               <div className="flex-1">
                  <h4 className="font-bold text-slate-800">Mauzo (Sales)</h4>
                  <div className="text-xs text-slate-400">Total gross sales collected</div>
               </div>
               <div className="font-black text-emerald-700">TZS {totalSales.toLocaleString()}</div>
            </div>
            
            <div className="bg-white p-5 border border-slate-200 rounded-2xl flex items-center">
               <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mr-4">
                  <TrendingDown className="w-5 h-5 text-rose-600" />
               </div>
               <div className="flex-1">
                  <h4 className="font-bold text-slate-800">Gharama za Kuendesha</h4>
                  <div className="text-xs text-slate-400">Expenses & Deliveries</div>
               </div>
               <div className="font-black text-rose-700">TZS {totalExpenses.toLocaleString()}</div>
            </div>

            <div className="bg-white p-5 border border-slate-200 rounded-2xl flex items-center">
               <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mr-4">
                  <Activity className="w-5 h-5 text-indigo-600" />
               </div>
               <div className="flex-1">
                  <h4 className="font-bold text-slate-800">Mtaji kwenye mzigo</h4>
                  <div className="text-xs text-slate-400">Value of stock (COGS sold)</div>
               </div>
               <div className="font-black text-indigo-700">TZS {Math.round(totalCogs).toLocaleString()}</div>
            </div>
         </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Tahadhari na Ushauri</h3>
          <ul className="space-y-3">
             {items.filter(i=>i.stock <= i.lowStockAlert && i.showOnPos).map(i => (
                 <li key={i.id} className="flex items-center text-sm text-slate-700">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mr-2" /> Bidhaa ya <strong>&nbsp;{i.name}&nbsp;</strong> inakaribia kuisha. Sourcing inahitajika.
                 </li>
             ))}
             {items.flatMap(i => i.batches).filter(b => b.source === 'production' && b.efficiency !== undefined && b.efficiency < 100).map(b => (
                 <li key={b.id} className="flex items-center text-sm text-rose-700">
                    <AlertTriangle className="w-4 h-4 text-rose-500 mr-2" /> Tarehe {new Date(b.date).toLocaleDateString()}, uzalishaji ulikuwa na ufanisi mdogo ({b.efficiency}%). Matarajio: {b.expectedOutput}, Uzalishaji: {b.actualOutput}.
                 </li>
             ))}
             {netProfit < 0 && (
                 <li className="flex items-center text-sm text-rose-700">
                    <TrendingDown className="w-4 h-4 mr-2" /> Faida imeshuka. Ebu kagua matumizi yako kwenye Expenses.
                 </li>
             )}
             {items.filter(i=>i.stock <= i.lowStockAlert).length === 0 && netProfit > 0 && items.flatMap(i => i.batches).filter(b => b.source === 'production' && b.efficiency !== undefined && b.efficiency < 100).length === 0 && (
                 <li className="flex items-center text-sm text-emerald-700">
                    <CheckCircle className="w-4 h-4 mr-2" /> Mfumo unasoma vizuri. Hongera kwa kusimamia vizuri!
                 </li>
             )}
          </ul>
      </div>
    </div>
  );
};
