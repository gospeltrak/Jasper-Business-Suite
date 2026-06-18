import React, { useState } from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { Truck, Package, Calculator, CheckCircle } from 'lucide-react';

export const SourcingScreen: React.FC = () => {
  const { items, units, paymentMethods, updateItem } = useMicroSoko();
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [transportCost, setTransportCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !qty || !buyingPrice) return;
    
    const prod = items.find(i => i.id === itemId);
    if (!prod) return;

    const nQty = Number(qty);
    const nCost = Number(buyingPrice);
    const nTransport = Number(transportCost) || 0;

    const trueLandedCost = nCost + nTransport;
    const costPerUnit = trueLandedCost / nQty;

    const newBatch = {
      id: Math.random().toString(36).substr(2, 9),
      itemId: prod.id,
      source: 'purchase' as const,
      batchNumber: 'SRC-' + new Date().getTime().toString().substr(-6),
      date: new Date().toISOString(),
      costPerUnit,
      quantityCreated: nQty,
      quantityRemaining: nQty,
      suggestedSellingPrice: costPerUnit * 1.5, // 50% margin default
      status: 'active' as const
    };

    const newBatches = [...prod.batches, newBatch];
    const totalRemaining = newBatches.filter(b=>b.status==='active').reduce((s, b)=>s + b.quantityRemaining, 0);
    const totalValue = newBatches.filter(b=>b.status==='active').reduce((s, b)=>s + (b.quantityRemaining * b.costPerUnit), 0);
    
    const updatedProd = {
      ...prod,
      batches: newBatches,
      stock: prod.stock + nQty,
      latestCost: costPerUnit,
      averageCost: totalRemaining > 0 ? (totalValue / totalRemaining) : costPerUnit
    };

    updateItem(updatedProd);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    
    setQty(''); setBuyingPrice(''); setTransportCost(''); setSupplier('');
  };

  const trueCost = (Number(buyingPrice) || 0) + (Number(transportCost) || 0);
  const unitCost = Number(qty) > 0 ? (trueCost / Number(qty)) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Sourcing Materials</h2>
        <p className="text-slate-500">Record new purchases and calculate true landed cost.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          {success && (
            <div className="mb-4 p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" /> Source added, stock updated, batch created.
            </div>
          )}
          <form onSubmit={handleSource} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                 <label className="block font-bold text-xs text-slate-500 mb-1">Item Bought</label>
                 <select required value={itemId} onChange={e=>setItemId(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50">
                   <option value="">Select...</option>
                   {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                 </select>
              </div>
              
              <div>
                 <label className="block font-bold text-xs text-slate-500 mb-1">Quantity</label>
                 <input required type="number" min="0.01" step="0.01" value={qty} onChange={e=>setQty(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50" />
              </div>

              <div>
                 <label className="block font-bold text-xs text-slate-500 mb-1">Buying Price (TZS)</label>
                 <input required type="number" min="0" value={buyingPrice} onChange={e=>setBuyingPrice(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50" />
              </div>

              <div>
                 <label className="block font-bold text-xs text-slate-500 mb-1">Transport Cost (TZS)</label>
                 <input type="number" min="0" value={transportCost} onChange={e=>setTransportCost(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50" />
              </div>

              <div>
                 <label className="block font-bold text-xs text-slate-500 mb-1">Supplier (Optional)</label>
                 <input type="text" value={supplier} onChange={e=>setSupplier(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50" />
              </div>
            </div>

            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl font-bold">Add Stock & Create Batch</button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl">
             <h3 className="font-bold text-indigo-900 flex items-center mb-3"><Calculator className="w-4 h-4 mr-2"/> Landed Cost Calculator</h3>
             <div className="space-y-2 text-sm">
               <div className="flex justify-between">
                 <span className="text-indigo-600">Base Cost:</span>
                 <span className="font-bold text-indigo-900">TZS {Number(buyingPrice||0).toLocaleString()}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-indigo-600">Transport:</span>
                 <span className="font-bold text-indigo-900">TZS {Number(transportCost||0).toLocaleString()}</span>
               </div>
               <div className="border-t border-indigo-200 pt-2 flex justify-between">
                 <span className="font-bold text-indigo-800">True Landed Cost:</span>
                 <span className="font-black text-indigo-900">TZS {trueCost.toLocaleString()}</span>
               </div>
               {Number(qty) > 0 && (
                 <div className="flex justify-between mt-2 pt-2 border-t border-indigo-200">
                   <span className="text-indigo-600">Cost Per Unit:</span>
                   <span className="font-black text-emerald-700">TZS {Math.round(unitCost).toLocaleString()}</span>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
