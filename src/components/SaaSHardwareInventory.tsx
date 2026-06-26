import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash } from 'lucide-react';
import { defaultHardwareInventory, loadPlatformRecord, savePlatformRecord } from '../utils/superAdminPlatformRecords';

export default function SaaSHardwareInventory({ affiliateId }: { affiliateId?: string }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEdit, setSelectedEdit] = useState<any>(null);

  // Form states for Add/Edit
  const [formData, setFormData] = useState({ name: '', category: '', price: 0, stock: 0 });

  const recordType = affiliateId ? 'affiliate_hardware_inventory' : 'hardware_inventory';
  const scopeId = affiliateId || 'global';

  useEffect(() => {
    let alive = true;
    loadPlatformRecord<any[]>(recordType, scopeId, affiliateId ? [] : defaultHardwareInventory)
      .then((items) => { if (alive) setInventory(Array.isArray(items) ? items : []); })
      .catch(() => setInventory(affiliateId ? [] : defaultHardwareInventory));
    return () => { alive = false; };
  }, [recordType, scopeId, affiliateId]);

  const handleUpdateStock = (id: string, qty: number) => {
    const updated = inventory.map(item => item.id === id ? { ...item, stock: Math.max(0, item.stock + qty) } : item);
    setInventory(updated);
    savePlatformRecord(recordType, scopeId, updated).catch(() => {});
  };

  const handleSaveItem = () => {
    let updated;
    if (selectedEdit) {
      updated = inventory.map(item => item.id === selectedEdit.id ? { ...item, ...formData } : item);
    } else {
      updated = [...inventory, { id: 'item-' + Date.now(), ...formData }];
    }
    setInventory(updated);
    savePlatformRecord(recordType, scopeId, updated).catch(() => {});
    setShowAddModal(false);
    setSelectedEdit(null);
  };

  const handleDeleteItem = (id: string) => {
    if (!confirm('Are you sure you want to delete this hardware item?')) return;
    const updated = inventory.filter(i => i.id !== id);
    setInventory(updated);
    savePlatformRecord(recordType, scopeId, updated).catch(() => {});
  };

  const openAdd = () => {
    setFormData({ name: '', category: '', price: 0, stock: 0 });
    setSelectedEdit(null);
    setShowAddModal(true);
  };

  const openEdit = (item: any) => {
    setFormData({ name: item.name, category: item.category, price: item.price, stock: item.stock });
    setSelectedEdit(item);
    setShowAddModal(true);
  };

  return (
    <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Package className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Hardware Inventory {affiliateId && '(Partner Location)'}</h3>
        </div>
        {!affiliateId && (
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Add / Purchase Stock</span>
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-400">Hardware stock.</p>

      {inventory.length === 0 ? (
        <div className="p-8 text-center text-slate-500 border border-slate-800 rounded-xl bg-slate-950/50">
          No hardware inventory stock recorded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {inventory.map(item => (
            <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2 group">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-xs">{item.name}</h4>
                  <span className="text-[9px] uppercase font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{item.category}</span>
                </div>
                {!affiliateId && (
                  <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-rose-400 hover:text-rose-300 p-1 bg-slate-800 rounded"><Trash className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              <div className="pt-2">
                <span className="text-xs text-slate-400 block font-mono">Price: {item.price.toLocaleString()} TZS</span>
                <span className="text-xs text-slate-400 block font-mono">In Stock: <span className="font-bold text-emerald-400">{item.stock}</span></span>
              </div>
              <div className="flex space-x-2 pt-2 border-t border-slate-800">
                <button onClick={() => handleUpdateStock(item.id, 1)} className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-1 rounded text-[10px] font-bold">+1</button>
                <button onClick={() => handleUpdateStock(item.id, -1)} className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-1 rounded text-[10px] font-bold">-1</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && !affiliateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative animate-fade-in">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">{selectedEdit ? 'Edit Item' : 'Purchase / Add hardware'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono text-slate-500">Item Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2 text-xs text-white rounded outline-none focus:border-indigo-500 mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-500">Category</label>
                  <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2 text-xs text-white rounded outline-none focus:border-indigo-500 mt-1" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-500">Stock Qty</label>
                  <input type="number" min="0" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 p-2 text-xs text-white rounded outline-none focus:border-indigo-500 mt-1" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-slate-500">Retail Price (TZS)</label>
                <input type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 p-2 text-xs text-white rounded outline-none focus:border-indigo-500 mt-1" />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-xs font-bold text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700">Cancel</button>
              <button onClick={handleSaveItem} className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500">{selectedEdit ? 'Save Changes' : 'Confirm Addition'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
