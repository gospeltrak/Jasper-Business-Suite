import React, { useState } from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { Package, Plus, Edit, ChevronDown, ChevronUp, Save, X } from 'lucide-react';
import { MsItem } from './MicroSokoTypes';

export const MicroSokoInventory: React.FC = () => {
  const { items, units, addItem, updateItem } = useMicroSoko();
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [name, setName] = useState('');
  const [type, setType] = useState<MsItem['type']>('raw_material');
  const [unitId, setUnitId] = useState('');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [lowStockAlert, setLowStockAlert] = useState('10');
  const [showOnPos, setShowOnPos] = useState(false);
  const [sellingMethod, setSellingMethod] = useState<MsItem['sellingMethod']>('fifo');

  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<string | null>(null);

  // Edit states
  const [editName, setEditName] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('0');
  const [editShowOnPos, setEditShowOnPos] = useState(false);
  const [editLowStockAlert, setEditLowStockAlert] = useState('0');
  const [editSellingMethod, setEditSellingMethod] = useState<MsItem['sellingMethod']>('fifo');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if(!name || !unitId) return;

    addItem({
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      unitId,
      stock: 0,
      averageCost: 0,
      latestCost: 0,
      sellingPrice: Number(sellingPrice),
      showOnPos,
      sellingMethod: sellingMethod,
      batches: [],
      lowStockAlert: Number(lowStockAlert)
    });
    
    setShowAddForm(false);
    setName(''); setSellingPrice('0'); setShowOnPos(false);
  };

  const startEdit = (item: MsItem) => {
    setEditingItem(item.id);
    setEditName(item.name);
    setEditSellingPrice(item.sellingPrice.toString());
    setEditShowOnPos(item.showOnPos);
    setEditLowStockAlert(item.lowStockAlert.toString());
    setEditSellingMethod(item.sellingMethod);
  };

  const saveEdit = (item: MsItem) => {
    updateItem(item.id, {
      name: editName,
      sellingPrice: Number(editSellingPrice),
      showOnPos: editShowOnPos,
      lowStockAlert: Number(editLowStockAlert),
      sellingMethod: editSellingMethod
    });
    setEditingItem(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Inventory & Items</h2>
          <p className="text-slate-500">Manage raw materials, packaging, and finished products.</p>
        </div>
        <button onClick={()=>setShowAddForm(!showAddForm)} className="bg-emerald-600 text-white px-4 py-2 flex items-center rounded-xl font-bold">
           <Plus className="w-5 h-5 mr-2" /> Add Stock Item
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddItem} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
           <h3 className="font-bold text-slate-800 border-b pb-3">Create New Item Structure</h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Item Name</label>
                 <input required type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full border p-2 rounded-lg" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
                 <select value={type} onChange={e=>setType(e.target.value as any)} className="w-full border p-2 rounded-lg bg-white">
                    <option value="raw_material">Raw Material / Malighafi</option>
                    <option value="finished_product">Finished Product / Bidhaa</option>
                    <option value="packaging">Packaging / Kifungashio</option>
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Unit</label>
                 <select required value={unitId} onChange={e=>setUnitId(e.target.value)} className="w-full border p-2 rounded-lg bg-white">
                    <option value="">Select...</option>
                    {units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Default Selling Price</label>
                 <input type="number" value={sellingPrice} onChange={e=>setSellingPrice(e.target.value)} className="w-full border p-2 rounded-lg" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Low Stock Alert At</label>
                 <input type="number" value={lowStockAlert} onChange={e=>setLowStockAlert(e.target.value)} className="w-full border p-2 rounded-lg" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Selling Method</label>
                 <select value={sellingMethod} onChange={e=>setSellingMethod(e.target.value as any)} className="w-full border p-2 rounded-lg bg-white">
                    <option value="fifo">FIFO (First-In, First-Out)</option>
                    <option value="average_cost">Average Cost</option>
                    <option value="manual">Manual Batch Selection</option>
                 </select>
              </div>
              <div className="flex items-end pb-2">
                 <label className="flex items-center space-x-2 font-bold text-sm text-slate-700">
                    <input type="checkbox" checked={showOnPos} onChange={e=>setShowOnPos(e.target.checked)} className="w-5 h-5 rounded text-emerald-600" />
                    <span>Show on Fast POS</span>
                 </label>
              </div>
           </div>
           <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Save Item</button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
         <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
               <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Avg Cost</th>
                  <th className="p-4">POS Price</th>
                  <th className="p-4">Batches</th>
                  <th className="p-4 text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {items.map(i => (
                  <React.Fragment key={i.id}>
                  {editingItem === i.id ? (
                     <tr className="bg-indigo-50/50">
                        <td className="p-4">
                           <input type="text" value={editName} onChange={e=>setEditName(e.target.value)} className="w-full border p-2 rounded" />
                        </td>
                        <td className="p-4 uppercase text-[10px] font-bold text-slate-500">{i.type.replace('_',' ')}</td>
                        <td className="p-4 font-black text-indigo-600">{i.stock} {units.find(u=>u.id===i.unitId)?.name}</td>
                        <td className="p-4">
                           <select value={editSellingMethod} onChange={e=>setEditSellingMethod(e.target.value as any)} className="w-full border p-2 text-xs rounded">
                              <option value="fifo">FIFO</option>
                              <option value="average_cost">Avg Cost</option>
                              <option value="manual">Manual</option>
                           </select>
                        </td>
                        <td className="p-4">
                           <input type="number" value={editSellingPrice} onChange={e=>setEditSellingPrice(e.target.value)} className="w-24 border p-2 rounded" />
                        </td>
                        <td className="p-4">
                           <label className="flex items-center space-x-1 text-xs">
                              <input type="checkbox" checked={editShowOnPos} onChange={e=>setEditShowOnPos(e.target.checked)} />
                              <span>Show POS</span>
                           </label>
                        </td>
                        <td className="p-4 text-right space-x-2">
                           <button onClick={()=>saveEdit(i)} className="p-2 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"><Save className="w-4 h-4"/></button>
                           <button onClick={()=>setEditingItem(null)} className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"><X className="w-4 h-4"/></button>
                        </td>
                     </tr>
                  ) : (
                  <tr className={i.stock <= i.lowStockAlert ? 'bg-rose-50 hover:bg-slate-50 cursor-pointer' : 'hover:bg-slate-50 cursor-pointer'} onClick={() => setExpandedBatches(expandedBatches === i.id ? null : i.id)}>
                     <td className="p-4 font-bold text-slate-800">
                        {i.name}
                        {i.stock <= i.lowStockAlert && <span className="ml-2 text-[10px] bg-rose-200 text-rose-800 px-1 py-0.5 rounded uppercase">Low</span>}
                     </td>
                     <td className="p-4 uppercase text-[10px] font-bold text-slate-500">{i.type.replace('_',' ')}</td>
                     <td className="p-4 font-black text-indigo-600">{i.stock} {units.find(u=>u.id===i.unitId)?.name}</td>
                     <td className="p-4 font-mono">TZS {Math.round(i.averageCost).toLocaleString()}</td>
                     <td className="p-4 font-mono">TZS {i.sellingPrice.toLocaleString()}</td>
                     <td className="p-4">
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold flex items-center w-fit">
                           {i.batches.filter(b=>b.status==='active').length} Active
                           {expandedBatches === i.id ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                        </span>
                     </td>
                     <td className="p-4 text-right">
                        <button onClick={(e)=>{e.stopPropagation(); startEdit(i);}} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                           <Edit className="w-4 h-4" />
                        </button>
                     </td>
                  </tr>
                  )}
                  {expandedBatches === i.id && (
                     <tr>
                        <td colSpan={7} className="p-0 border-b border-slate-100">
                           <div className="bg-slate-50 p-4 inner-shadow flex flex-col space-y-4">
                              <h4 className="font-bold text-sm text-slate-600">Batch History</h4>
                              {i.batches.length === 0 ? (
                                 <p className="text-sm text-slate-400">No batches recorded for this item yet.</p>
                              ) : (
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {i.batches.map(b => (
                                       <div key={b.id} className="bg-white p-3 rounded border border-slate-200 shadow-sm flex justify-between items-center">
                                          <div>
                                             <div className="flex items-center space-x-2">
                                                <span className="font-mono text-xs font-bold text-slate-700">{b.batchNumber}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${b.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{b.status}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold bg-indigo-50 text-indigo-600">{b.source}</span>
                                             </div>
                                             <p className="text-xs text-slate-500 mt-1">Cost: TZS {b.costPerUnit.toLocaleString()} / unit</p>
                                          </div>
                                          <div className="text-right">
                                             <p className="text-sm font-black text-slate-800">{b.quantityRemaining} remaining</p>
                                             <p className="text-xs text-slate-400">Orig: {b.quantityCreated}</p>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              )}
                           </div>
                        </td>
                     </tr>
                  )}
                  </React.Fragment>
               ))}
               {items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No items configured. Please add an item.</td></tr>}
            </tbody>
         </table>
      </div>
    </div>
  );
};
