import React, { useState } from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { Factory, Plus, Trash2, CheckCircle, Calculator } from 'lucide-react';

export const ProductionBatchWizard: React.FC = () => {
  const { items, updateItem } = useMicroSoko();
  
  const [producedItemId, setProducedItemId] = useState('');
  const [qtyProduced, setQtyProduced] = useState('');
  
  const [rawMaterials, setRawMaterials] = useState<{itemId: string, qty: string}[]>([{itemId: '', qty: ''}]);
  const [packagingCost, setPackagingCost] = useState('');
  const [otherCost, setOtherCost] = useState('');
  
  const [byProductValue, setByProductValue] = useState('');
  
  const [success, setSuccess] = useState(false);
  const [suggestedPrice, setSuggestedPrice] = useState<number|null>(null);
  const [finalPrice, setFinalPrice] = useState('');
  
  const [step, setStep] = useState(1);

  let rawMaterialsCost = 0;
  rawMaterials.forEach(rm => {
    if(rm.itemId && rm.qty) {
       const item = items.find(i=>i.id === rm.itemId);
       if(item) rawMaterialsCost += (item.averageCost * Number(rm.qty));
    }
  });
  
  const grossCost = rawMaterialsCost + (Number(packagingCost)||0) + (Number(otherCost)||0);
  const netCost = grossCost - (Number(byProductValue)||0);
  const costPerUnit = Number(qtyProduced) > 0 ? (netCost / Number(qtyProduced)) : 0;

  const handleCalculate = () => {
      const prod = items.find(i=>i.id===producedItemId);
      if(prod && prod.batches.length > 0) {
          const prevCost = prod.batches[prod.batches.length-1].costPerUnit;
          const prevMargin = (prod.sellingPrice - prevCost) / prevCost;
          const sugPrice = costPerUnit + (costPerUnit * prevMargin);
          setSuggestedPrice(sugPrice);
      } else {
          setSuggestedPrice(costPerUnit * 1.5);
      }
      setStep(2);
  };

  const handleFinish = () => {
      const prod = items.find(i=>i.id===producedItemId);
      if(!prod) return;

      const newBatch = {
        id: Math.random().toString(36).substr(2, 9),
        itemId: prod.id,
        source: 'production' as const,
        batchNumber: 'PRD-' + new Date().getTime().toString().substr(-6),
        date: new Date().toISOString(),
        costPerUnit,
        quantityCreated: Number(qtyProduced),
        quantityRemaining: Number(qtyProduced),
        suggestedSellingPrice: suggestedPrice || costPerUnit,
        finalSellingPrice: Number(finalPrice) || suggestedPrice || costPerUnit,
        status: 'active' as const
      };

      const newBatches = [...prod.batches, newBatch];
      
      const updatedProd = {
         ...prod,
         batches: newBatches,
         stock: prod.stock + Number(qtyProduced),
         latestCost: costPerUnit,
         sellingPrice: Number(finalPrice) || prod.sellingPrice
      };
      
      // We should also deduct raw material stocks but keeping simple for now
      
      updateItem(updatedProd);
      setSuccess(true);
      setTimeout(()=>setSuccess(false), 3000);
      
      setStep(1);
      setProducedItemId(''); setQtyProduced(''); setRawMaterials([{itemId:'',qty:''}]);
      setPackagingCost(''); setOtherCost(''); setByProductValue(''); setFinalPrice('');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Batch Wizard</h2>
        <p className="text-slate-500">Transform items and calculate true production cost.</p>
      </div>
      
      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" /> Production recorded, stock generated, batch saved!
        </div>
      )}

      {step === 1 && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="md:col-span-2 space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                   <h3 className="font-bold text-slate-800 mb-4">1. Unazalisha nini?</h3>
                   <div className="flex space-x-4">
                      <div className="flex-1">
                         <label className="block text-xs font-bold text-slate-500 mb-1">Finished Product</label>
                         <select value={producedItemId} onChange={e=>setProducedItemId(e.target.value)} className="w-full border p-2 rounded-lg">
                             <option value="">Select...</option>
                             {items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                         </select>
                      </div>
                      <div className="w-1/3">
                         <label className="block text-xs font-bold text-slate-500 mb-1">Qty Produced</label>
                         <input type="number" value={qtyProduced} onChange={e=>setQtyProduced(e.target.value)} className="w-full border p-2 rounded-lg" />
                      </div>
                   </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                   <h3 className="font-bold text-slate-800 mb-4">2. Malighafi zilizotumika</h3>
                   {rawMaterials.map((rm, idx) => (
                      <div key={idx} className="flex space-x-2 mb-2">
                         <select value={rm.itemId} onChange={e=>{const n = [...rawMaterials]; n[idx].itemId = e.target.value; setRawMaterials(n);}} className="flex-1 border p-2 rounded-lg">
                            <option value="">Select Material...</option>
                            {items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                         </select>
                         <input type="number" placeholder="Qty" value={rm.qty} onChange={e=>{const n = [...rawMaterials]; n[idx].qty = e.target.value; setRawMaterials(n);}} className="w-24 border p-2 rounded-lg" />
                         <button onClick={()=>{const n = rawMaterials.filter((_, i)=>i!==idx); setRawMaterials(n)}} className="p-2 bg-rose-50 text-rose-500 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </div>
                   ))}
                   <button onClick={()=>setRawMaterials([...rawMaterials, {itemId:'',qty:''}])} className="text-sm font-bold text-indigo-600 mt-2">+ Add Material</button>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                   <h3 className="font-bold text-slate-800 mb-4">3. Gharama Nyingine & By-products</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1">Packaging Cost</label>
                         <input type="number" value={packagingCost} onChange={e=>setPackagingCost(e.target.value)} className="w-full border p-2 rounded-lg" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1">Other Production Cost</label>
                         <input type="number" value={otherCost} onChange={e=>setOtherCost(e.target.value)} className="w-full border p-2 rounded-lg" />
                      </div>
                      <div className="col-span-2">
                         <label className="block text-xs font-bold text-emerald-600 mb-1">Value of By-products (Reduces cost)</label>
                         <input type="number" value={byProductValue} onChange={e=>setByProductValue(e.target.value)} className="w-full border p-2 rounded-lg border-emerald-200 bg-emerald-50" />
                      </div>
                   </div>
                </div>
                
                <button disabled={!producedItemId || !qtyProduced} onClick={handleCalculate} className="w-full p-4 bg-indigo-600 text-white font-bold rounded-2xl disabled:opacity-50">Piga Hesabu ya Kubeji</button>
             </div>
             
             <div className="bg-slate-100 p-6 rounded-2xl">
               <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Calculator className="w-5 h-5 mr-2"/> Live Costing</h3>
               <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Raw Materials:</span> <span className="font-bold">TZS {rawMaterialsCost.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Packaging/Other:</span> <span className="font-bold">TZS {(Number(packagingCost)+Number(otherCost)).toLocaleString()}</span></div>
                  <div className="flex justify-between text-emerald-600"><span>By-product Offset:</span> <span className="font-bold">- TZS {Number(byProductValue).toLocaleString()}</span></div>
                  <div className="border-t border-slate-300 pt-2 flex justify-between font-bold text-slate-900"><span>Net Production Cost:</span> <span>TZS {netCost.toLocaleString()}</span></div>
                  {Number(qtyProduced) > 0 && <div className="flex justify-between font-black text-indigo-700 mt-2"><span>Cost Per Unit:</span> <span>TZS {costPerUnit.toLocaleString()}</span></div>}
               </div>
             </div>
         </div>
      )}

      {step === 2 && (
         <div className="bg-white p-8 rounded-2xl border border-slate-200 max-w-xl mx-auto space-y-6">
             <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Factory className="w-8 h-8" />
                </div>
                <h3 className="font-black text-2xl text-slate-800">Smart Pricing</h3>
                <p className="text-slate-500 mt-2">Bei ya gharama kwa unit: <strong className="text-slate-800">TZS {costPerUnit.toLocaleString()}</strong></p>
             </div>

             <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">Suggested Selling Price</label>
                <div className="text-3xl font-black text-indigo-600">TZS {Math.round(suggestedPrice||0).toLocaleString()}</div>
             </div>

             <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Weka bei yako ya kuuza (Hiari)</label>
                <input type="number" value={finalPrice} onChange={e=>setFinalPrice(e.target.value)} placeholder={Math.round(suggestedPrice||0).toString()} className="w-full p-4 border-2 border-slate-200 rounded-xl font-black text-xl outline-none focus:border-emerald-500" />
             </div>

             <div className="flex space-x-4">
                <button onClick={()=>setStep(1)} className="w-1/3 p-4 bg-slate-100 text-slate-600 font-bold rounded-xl">Back</button>
                <button onClick={handleFinish} className="w-2/3 p-4 bg-emerald-600 text-white font-bold rounded-xl">Save Batch</button>
             </div>
         </div>
      )}
    </div>
  );
};
