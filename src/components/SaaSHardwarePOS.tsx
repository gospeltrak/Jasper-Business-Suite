import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, Plus, Trash, CheckCircle, User } from 'lucide-react';
import { defaultHardwareInventory, loadPlatformRecord, savePlatformRecord } from '../utils/superAdminPlatformRecords';
import { getSecureDataBridgeClient } from '../secureDataBridge';
import { ONLINE_ONLY_WRITE_MESSAGE } from '../utils/onlineOnly';

async function loadAffiliatesForPOS(): Promise<any[]> {
  const results: any[] = [];
  try {
    const client: any = await getSecureDataBridgeClient();
    const { data } = await client.from('affiliates')
      .select('id, display_name, promo_code, referral_code, account_type, phone_whatsapp')
      .order('created_at', { ascending: false });
    if (data?.length) {
      data.forEach((aff: any) => {
        results.push({
          id: aff.id,
          name: aff.display_name || aff.promo_code || aff.referral_code,
          promoCode: aff.promo_code || aff.referral_code,
          phone: aff.phone_whatsapp,
          isSuper: aff.account_type === 'partner' || aff.account_type === 'super_agent',
        });
      });
    }
  } catch { /* DB unavailable — do not use stale local affiliate cache. */ }
  return results;
}

async function loadSubscribersForPOS(): Promise<any[]> {
  try {
    const client: any = await getSecureDataBridgeClient();
    const { data } = await client.from('tenants')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data?.length) return data.map((t: any) => ({ id: t.id, name: t.name, business: t.name }));
  } catch { /* offline */ }
  // Fallback to onlineStorage
  try {
    const local: any[] = JSON.parse(onlineStorage.getItem('jasper_custom_tenants') || '[]');
    return local.map((t: any) => ({ id: t.id, name: t.name || t.businessName, business: t.name || t.businessName }));
  } catch { return []; }
}

export default function SaaSHardwarePOS({ affiliateId }: { affiliateId?: string }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [customerMode, setCustomerMode] = useState<'subscriber' | 'walk-in' | 'affiliate'>('subscriber');
  const [selectedSubscriber, setSelectedSubscriber] = useState('');
  const [selectedAffiliate, setSelectedAffiliate] = useState('');
  const [walkInName, setWalkInName] = useState('');
  
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [traReceipt, setTraReceipt] = useState(false);
  const [discountVal, setDiscountVal] = useState(0);
  const [discountType, setDiscountType] = useState<'amount'|'percent'>('amount');
  const [deliveryFee, setDeliveryFee] = useState(0);

  const recordType = affiliateId ? 'affiliate_hardware_inventory' : 'hardware_inventory';
  const scopeId = affiliateId || 'global';

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadPlatformRecord<any[]>(recordType, scopeId, affiliateId ? [] : defaultHardwareInventory),
      loadAffiliatesForPOS(),
      loadSubscribersForPOS(),
    ]).then(([items, affList, subList]) => {
      if (!alive) return;
      setInventory(Array.isArray(items) ? items : []);
      setAffiliates(affList);
      setSubscribers(subList);
    }).catch(() => {
      if (!alive) return;
      setInventory(affiliateId ? [] : defaultHardwareInventory);
      setAffiliates([]);
      setSubscribers([]);
    });
    return () => { alive = false; };
  }, [recordType, scopeId, affiliateId]);

  const addToCart = (item: any) => {
    if (item.stock <= 0) {
      alert('Item is out of stock!');
      return;
    }
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      if (existing.qty + 1 > item.stock) {
        alert('Cannot exceed available stock.');
        return;
      }
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { ...item, qty: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(id);
      return;
    }
    const item = inventory.find(i => i.id === id);
    if (item && qty > item.stock) {
      alert('Cannot exceed available stock.');
      return;
    }
    setCart(cart.map(c => c.id === id ? { ...c, qty } : c));
  };

  const subTotal = cart.reduce((acc, c) => acc + (c.price * c.qty), 0);
  const discountAmount = discountType === 'amount' ? discountVal : (subTotal * discountVal / 100);
  const cartTotal = Math.max(0, subTotal - discountAmount) + deliveryFee;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    let custName = '';
    let isSub = false;
    let isAff = false;

    if (customerMode === 'subscriber') {
      if (!selectedSubscriber) {
        alert('Please select a subscriber.');
        return;
      }
      custName = selectedSubscriber;
      isSub = true;
    } else if (customerMode === 'affiliate') {
      if (!selectedAffiliate) {
        alert('Please select an affiliate.');
        return;
      }
      const aff = affiliates.find(a => a.id === selectedAffiliate);
      custName = aff ? aff.name : selectedAffiliate;
      isAff = true;
    } else {
      if (!walkInName.trim()) {
        alert('Please enter walk-in customer name.');
        return;
      }
      custName = walkInName;
    }

    const saleRecord = {
      id: 'hw-sale-' + Date.now(),
      receiptNo: 'HW-' + Math.floor(Math.random() * 10000),
      date: new Date().toISOString(),
      customerName: custName,
      isSubscriber: isSub,
      isAffiliate: isAff,
      items: cart,
      subTotal,
      discount: discountAmount,
      deliveryFee,
      total: cartTotal,
      paymentMethod,
      traReceipt,
      affiliateSeller: affiliateId || null
    };

    // update general HW inventory
    const newInv = inventory.map(invItem => {
      const cartItem = cart.find(c => c.id === invItem.id);
      if (cartItem) {
        return { ...invItem, stock: invItem.stock - cartItem.qty };
      }
      return invItem;
    });
    try {
      await savePlatformRecord(recordType, scopeId, newInv);

      const salesRecordType = affiliateId ? 'affiliate_hardware_sales' : 'hardware_sales';
      const priorSales = await loadPlatformRecord<any[]>(salesRecordType, scopeId, []);
      await savePlatformRecord(salesRecordType, scopeId, [saleRecord, ...(Array.isArray(priorSales) ? priorSales : [])]);

      // Also update subscriber profile directly if isSub is true
      if (isSub && !affiliateId) {
        const purchases = await loadPlatformRecord<Record<string, any[]>>('hardware_purchases_by_subscriber', 'global', {});
        if (!purchases[custName]) purchases[custName] = [];
        purchases[custName].push(saleRecord);
        await savePlatformRecord('hardware_purchases_by_subscriber', 'global', purchases);
      }

      // If super admin selling to affiliate ON CREDIT — add to affiliate's inventory
      // The affiliate's POS reads from: affiliate_hardware_inventory__{affiliate.id}
      // We must use the same ID the Partner dashboard uses as partnerId
      if (isAff && !affiliateId && selectedAffiliate) {
        const affRecord = affiliates.find(a => a.id === selectedAffiliate);
        const affId = affRecord?.id || selectedAffiliate;

        const affInv = await loadPlatformRecord<any[]>('affiliate_hardware_inventory', affId, []);
        cart.forEach(cartItem => {
          const existing = affInv.find((i: any) => i.id === cartItem.id);
          if (existing) {
            existing.stock = (existing.stock || 0) + cartItem.qty;
          } else {
            affInv.push({ ...cartItem, stock: cartItem.qty });
          }
        });
        await savePlatformRecord('affiliate_hardware_inventory', affId, affInv);

        // Also save sale as a credit record for this affiliate
        const creditSales = await loadPlatformRecord<any[]>('affiliate_credit_sales', affId, []);
        await savePlatformRecord('affiliate_credit_sales', affId, [{
          ...saleRecord,
          soldOnCredit: true,
          affiliateId: affId,
          affiliateName: custName,
          creditDate: new Date().toISOString(),
        }, ...creditSales]);
      }
      setInventory(newInv);
    } catch (error: any) {
      alert(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }

    alert(`Checkout successful! Hardware sale recorded as ${paymentMethod}.`);
    setCart([]);
    setWalkInName('');
    setSelectedSubscriber('');
    setSelectedAffiliate('');
    setPaymentMethod('Cash');
    setTraReceipt(false);
    setDiscountVal(0);
    setDeliveryFee(0);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in text-left">
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-4">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Hardware POS System {affiliateId && '(Partner Location)'}</h3>
          </div>
          <p className="text-[11px] text-slate-400">Sell devices.</p>
          
          {inventory.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-slate-800 rounded-xl bg-slate-950/50">
              No hardware stock available. {affiliateId && 'Purchase inventory on credit from Admin.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {inventory.map(item => (
                <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-colors" onClick={() => addToCart(item)}>
                  <h4 className="font-bold text-white text-xs">{item.name}</h4>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">{item.price.toLocaleString()} TZS</span>
                    <span className="text-[9px] text-slate-500 font-mono">Stock: {item.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-5 bg-slate-900 border border-slate-850 p-6 rounded-2xl flex flex-col h-full max-h-[800px]">
        <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Current Cart & Customer</h3>
        
        {/* Customer Selection */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4 space-y-3">
          <div className="flex space-x-2">
            <button 
              onClick={() => setCustomerMode('subscriber')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded ${customerMode === 'subscriber' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
            >
              Subscriber
            </button>
            {!affiliateId && (
              <button 
                onClick={() => setCustomerMode('affiliate')}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded ${customerMode === 'affiliate' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
              >
                Affiliate
              </button>
            )}
            <button 
              onClick={() => setCustomerMode('walk-in')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded ${customerMode === 'walk-in' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
            >
              Walk-in
            </button>
          </div>

          {customerMode === 'subscriber' ? (
            <div>
              <select 
                className="w-full bg-slate-900 border border-slate-800 p-2 text-xs text-white rounded outline-none cursor-pointer font-mono"
                value={selectedSubscriber}
                onChange={(e) => setSelectedSubscriber(e.target.value)}
              >
                <option value="">-- Select Subscriber --</option>
                {subscribers.map(s => (
                  <option key={s.id} value={s.name}>{s.name} ({s.business})</option>
                ))}
              </select>
            </div>
          ) : (customerMode === 'affiliate' && !affiliateId) ? (
            <div>
              <select 
                className="w-full bg-slate-900 border border-slate-800 p-2 text-xs text-white rounded outline-none cursor-pointer font-mono"
                value={selectedAffiliate}
                onChange={(e) => setSelectedAffiliate(e.target.value)}
              >
                <option value="">-- Select Partner / Affiliate to sell on credit --</option>
                {affiliates.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.promoCode ? ` (${a.promoCode})` : ''} — {a.isSuper ? 'Partner' : 'Affiliate'}
                  </option>
                ))}
              </select>
              {selectedAffiliate && (
                <p className="text-[10px] text-amber-400 mt-1">
                  ⚠️ Items sold on credit will be added to this partner/affiliate's inventory automatically
                </p>
              )}
            </div>
          ) : (
            <div>
              <input 
                type="text"
                placeholder="Walk-in Customer Name"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 p-2 text-xs text-white rounded outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
          {cart.length === 0 ? (
            <div className="text-center p-6 bg-slate-950 rounded-xl border border-slate-800 border-dashed">
              <span className="text-slate-500 text-xs">Cart is empty</span>
            </div>
          ) : (
            cart.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div className="flex-1">
                  <h4 className="text-[11px] font-bold text-white">{c.name}</h4>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold whitespace-nowrap">{(c.price * c.qty).toLocaleString()} TZS</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => updateQty(c.id, c.qty - 1)} className="bg-slate-800 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-xs">-</button>
                  <span className="text-xs font-mono font-bold w-4 text-center">{c.qty}</span>
                  <button onClick={() => updateQty(c.id, c.qty + 1)} className="bg-slate-800 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-xs">+</button>
                  <button onClick={() => removeFromCart(c.id)} className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded ml-1 transition-colors">
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Payment Details */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3 mt-4">
          <div className="flex flex-wrap gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-lg">
            {['Cash', 'Mobile', 'Bank', ...(affiliateId ? [] : ['Credit'])].map(method => (
              <button 
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 min-w-[50px] text-[10px] font-bold uppercase py-1.5 rounded-md transition-colors ${paymentMethod === method ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                {method}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 font-mono">Discount Type & Val</label>
              <div className="flex focus-within:ring-1 focus-within:ring-indigo-500 rounded border border-slate-800">
                <select 
                  className="bg-slate-800 text-[10px] text-white p-1.5 rounded-l outline-none cursor-pointer border-r border-slate-700 w-16"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                >
                  <option value="amount">TZS</option>
                  <option value="percent">%</option>
                </select>
                <input 
                  type="number"
                  min="0"
                  className="w-full bg-slate-900 p-1.5 text-xs text-white rounded-r outline-none text-right placeholder-slate-600"
                  placeholder="0"
                  value={discountVal || ''}
                  onChange={(e) => setDiscountVal(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 font-mono">Delivery Fee</label>
              <input 
                type="number"
                min="0"
                className="w-full bg-slate-900 border border-slate-800 p-1.5 text-xs text-white rounded outline-none focus:border-indigo-500 text-right placeholder-slate-600"
                placeholder="0"
                value={deliveryFee || ''}
                onChange={(e) => setDeliveryFee(Number(e.target.value))}
              />
            </div>
          </div>

          <label className="flex items-center space-x-2 bg-slate-900 p-2 rounded border border-slate-800 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={traReceipt}
              onChange={(e) => setTraReceipt(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900" 
            />
            <span className="text-[10px] font-bold text-slate-400 group-hover:text-white uppercase transition-colors">Issue Official EFD Receipt (TRA)</span>
          </label>
        </div>

        {/* Total & Checkout */}
        <div className="pt-4 border-t border-slate-800 mt-4 space-y-4">
          <div className="space-y-1.5 text-[10px] font-mono border-b border-slate-850 pb-3">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>{subTotal.toLocaleString()}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-400">
                <span>Discount</span>
                <span>-{discountAmount.toLocaleString()}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Delivery Fee</span>
                <span>{deliveryFee.toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-end">
            <span className="text-xs uppercase font-mono text-white font-bold">Total Amount</span>
            <span className="text-xl font-bold text-emerald-400 font-mono">{cartTotal.toLocaleString()} TZS</span>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-mono font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Complete Sale</span>
          </button>
        </div>
      </div>
    </div>
  );
}
