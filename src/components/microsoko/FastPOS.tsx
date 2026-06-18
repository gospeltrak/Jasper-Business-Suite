import React, { useState } from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { ShoppingCart, CheckCircle, CreditCard, Trash2 } from 'lucide-react';
import { MsSaleItem } from './MicroSokoTypes';

export const FastPOS: React.FC = () => {
  const { items, paymentMethods, addSale, updateItem } = useMicroSoko();
  const posItems = items.filter(i => i.showOnPos);

  const [cart, setCart] = useState<MsSaleItem[]>([]);
  const [success, setSuccess] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState('');

  const handleAddToCart = (itemId: string) => {
     const prod = items.find(i=>i.id === itemId);
     if(!prod) return;
     
     const existing = cart.find(c=>c.itemId === itemId);
     if(existing) {
         if((existing.qty + 1) > prod.stock) {
             alert('Insufficient stock!');
             return;
         }
         setCart(cart.map(c=>c.itemId===itemId ? {...c, qty: c.qty+1} : c));
     } else {
         if(prod.stock < 1) {
             alert('Out of stock!');
             return;
         }
         setCart([...cart, { itemId, name: prod.name, qty: 1, price: prod.sellingPrice, _batchesUsed: [] }]);
     }
  };

  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);

  const handleCheckout = () => {
     if(cart.length === 0 || !paymentMethodId) return;

     // FIFO Logic processing
     const finalCartItems = [...cart];

     finalCartItems.forEach(cartItem => {
         const originalProd = items.find(i=>i.id === cartItem.itemId);
         if(!originalProd) return;

         let qtyRequested = cartItem.qty;
         const batchesUsed = [];

         let newBatches = [...originalProd.batches];
         if(originalProd.sellingMethod === 'fifo') {
             for(let i=0; i<newBatches.length; i++) {
                 if(newBatches[i].status === 'finished') continue;
                 if(qtyRequested === 0) break;

                 if(newBatches[i].quantityRemaining >= qtyRequested) {
                     newBatches[i].quantityRemaining -= qtyRequested;
                     batchesUsed.push({ batchId: newBatches[i].id, qty: qtyRequested, costPerUnit: newBatches[i].costPerUnit });
                     qtyRequested = 0;
                 } else {
                     batchesUsed.push({ batchId: newBatches[i].id, qty: newBatches[i].quantityRemaining, costPerUnit: newBatches[i].costPerUnit });
                     qtyRequested -= newBatches[i].quantityRemaining;
                     newBatches[i].quantityRemaining = 0;
                     newBatches[i].status = 'finished';
                 }
             }
         } else {
             // simplified logic for average/manual -> just use average cost as reference
             batchesUsed.push({ qty: cartItem.qty, costPerUnit: originalProd.averageCost });
         }

         cartItem._batchesUsed = batchesUsed;

         // update item stock
         updateItem({
             ...originalProd,
             stock: originalProd.stock - cartItem.qty,
             batches: newBatches
         });
     });

     addSale({
         id: Math.random().toString(36).substr(2, 9),
         items: finalCartItems,
         total,
         paymentMethodId,
         date: new Date().toISOString()
     });

     setSuccess(true);
     setCart([]);
     setPaymentMethodId('');
     setTimeout(()=>setSuccess(false), 3000);
  };

  return (
    <div className="flex h-full">
       <div className="flex-1 p-6 overflow-y-auto">
          <h2 className="text-2xl font-black text-slate-800 mb-6">Fast POS</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
             {posItems.map(p => (
                 <button key={p.id} onClick={()=>handleAddToCart(p.id)} className="bg-white border hover:border-emerald-500 hover:ring-2 hover:ring-emerald-200 transition-all border-slate-200 p-4 rounded-2xl text-left shadow-sm flex flex-col justify-between aspect-square">
                     <div>
                         <div className="font-bold text-slate-800 leading-tight">{p.name}</div>
                         <div className="text-xs mt-1 text-slate-500">Stock: {p.stock}</div>
                         {p.batches.filter(b=>b.status==='active').length > 1 && (
                             <div className="text-[9px] mt-1 bg-amber-100 text-amber-800 px-1 py-0.5 rounded inline-block font-bold">Stock ya zamani kwanza</div>
                         )}
                     </div>
                     <div className="font-black text-indigo-600">TZS {p.sellingPrice.toLocaleString()}</div>
                 </button>
             ))}
             {posItems.length === 0 && (
                 <div className="col-span-full p-10 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No products added directly to POS. Check inventory to add.</p>
                 </div>
             )}
          </div>
       </div>
       <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-800 flex items-center">
             <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600"/> Current Cart
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {success && (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-100 rounded-lg flex items-center mb-4">
                   <CheckCircle className="w-4 h-4 mr-2" /> Mteja amelipa kikamilifu!
                </div>
             )}
             {cart.map((c, idx) => (
                 <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex-1">
                        <div className="font-bold text-sm text-slate-800">{c.name}</div>
                        <div className="text-xs text-indigo-600 font-bold">TZS {c.price.toLocaleString()} x {c.qty}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                       <div className="font-black text-slate-800">{(c.price*c.qty).toLocaleString()}</div>
                       <button onClick={()=>setCart(cart.filter((_,i)=>i!==idx))} className="p-1.5 bg-rose-100 text-rose-600 rounded">
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 </div>
             ))}
          </div>
          <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
             <div className="flex justify-between items-center text-xl font-black text-slate-800">
                 <span>Total:</span>
                 <span>TZS {total.toLocaleString()}</span>
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Payment Method</label>
                <select value={paymentMethodId} onChange={e=>setPaymentMethodId(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 outline-none focus:border-indigo-500 bg-white">
                    <option value="">Select...</option>
                    {paymentMethods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
             </div>
             <button disabled={cart.length===0 || !paymentMethodId} onClick={handleCheckout} className="w-full p-4 bg-emerald-600 disabled:opacity-50 hover:bg-emerald-700 text-white font-black rounded-xl text-lg flex items-center justify-center">
                 <CreditCard className="w-5 h-5 mr-2"/> Complete Sale
             </button>
          </div>
       </div>
    </div>
  );
};
