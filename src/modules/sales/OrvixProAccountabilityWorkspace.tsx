import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Truck, Receipt, RefreshCw, UserRound, ShieldAlert } from 'lucide-react';
import { getSecureDataBridgeClient } from '../../shared/dataBridge/secureDataBridge';

type Staff={id:string;name:string;role:string;created_at?:string};
type Sale={id:string;staff_name?:string;cashier_name?:string;reference?:string;total:number;amount_paid:number;payment_method?:string;created_at?:string};
type Delivery={id:string;customer_name?:string;status?:string;delivery_cost?:number;delivery_payment_method?:string;rider_details?:any;created_at?:string};
type Tab='staff'|'deliveries'|'sales';
interface Props{branchId:string|null;currency:string}
const panel='min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5';
export default function OrvixProAccountabilityWorkspace({branchId,currency}:Props){
  const[tab,setTab]=useState<Tab>('staff');
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[staff,setStaff]=useState<Staff[]>([]);
  const[sales,setSales]=useState<Sale[]>([]);
  const[deliveries,setDeliveries]=useState<Delivery[]>([]);
  const[selected,setSelected]=useState<string|null>(null);
  const[branchName,setBranchName]=useState('');
  const load=useCallback(async()=>{
    if(!branchId){setStaff([]);setSales([]);setDeliveries([]);setError('Select an active branch.');return;}
    setBusy(true);setError('');
    try{
      const client=await getSecureDataBridgeClient();
      const {data,error:sessionError}=await client.auth.getSession();
      if(sessionError||!data.session?.access_token)throw new Error('Sign in to your Pro account again.');
      const response=await fetch('/api/orvix-pro/accountability?branchId='+encodeURIComponent(branchId),{
        cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token,Accept:'application/json'}});
      const info=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(String(info.error||'Unable to load activity.'));
      setStaff(Array.isArray(info.staff)?info.staff:[]);
      setSales(Array.isArray(info.sales)?info.sales:[]);
      setDeliveries(Array.isArray(info.deliveries)?info.deliveries:[]);
      setBranchName(String(info.branch?.name||''));
    }catch(e){setError(e instanceof Error?e.message:'Activity unavailable.');}
    finally{setBusy(false);}
  },[branchId]);
  useEffect(()=>{void load();},[load]);
  const counts=useMemo(()=>staff.map(member=>{
    const related=sales.filter(s=>[s.staff_name,s.cashier_name].some(name=>String(name||'').trim().toLocaleLowerCase()===member.name.trim().toLocaleLowerCase()));
    return {...member,activity:related,count:related.length,
      recordedTotal:related.reduce((sum,s)=>sum+Number(s.total||0),0)};
  }),[staff,sales]);
  const selectedStaff=counts.find(x=>x.id===selected);
  const money=(n:unknown)=>currency+' '+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const date=(v?:string)=>v?new Date(v).toLocaleString():'—';
  return <div className="min-w-0 space-y-4">
    <header className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase text-emerald-600">Orvix Pro · Accountability</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Staff & Delivery Performance</h2>
          <p className="mt-1 text-xs text-slate-500">Branch: {branchName||'Selected branch'} · Latest recorded activity</p>
        </div>
        <button type="button" disabled={busy} onClick={()=>void load()}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs dark:border-slate-700"><RefreshCw size={15}/>Refresh</button>
      </div>
      <p className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <ShieldAlert size={16} className="shrink-0"/>Recorded activities only. Staff matching uses recorded names; these figures are not payroll, verified payment collection, or a final sales audit. Data never combines separate branches.</p>
    </header>
    <nav className="grid grid-cols-3 gap-2" aria-label="Pro accountability">
      {([['staff','Staff',Users],['deliveries','Deliveries',Truck],['sales','Sales',Receipt]] as const).map(([id,label,Icon])=>
        <button type="button" key={id} onClick={()=>{setTab(id);setSelected(null);}}
          className={'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-xs font-semibold sm:text-sm '+(tab===id?'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300':'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300')}>
          <Icon size={16}/>{label}</button>)}
    </nav>
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
    {tab==='staff'&&<div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section className={panel}><h3 className="text-sm font-bold">Employee Directory ({counts.length})</h3>
        <div className="mt-3 space-y-2">
          {counts.map(x=><button type="button" key={x.id} onClick={()=>setSelected(x.id)}
            className={'flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-left '+(selected===x.id?'border-emerald-500 bg-emerald-50 dark:bg-emerald-950':'border-slate-200 dark:border-slate-700')}>
            <span className="min-w-0"><span className="block truncate text-sm font-bold">{x.name}</span><span className="text-xs text-slate-500">{x.role}</span></span>
            <span className="shrink-0 text-right text-xs"><strong className="block">{x.count} sales</strong><span>{money(x.recordedTotal)}</span></span>
          </button>)}
          {!counts.length&&<p className="text-xs text-slate-500">No active employees found for this business.</p>}
        </div>
      </section>
      <section className={panel}><h3 className="flex items-center gap-2 text-sm font-bold"><UserRound size={16}/>Employee Profile & Activity</h3>
        {selectedStaff?<div className="mt-3 space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <p className="font-bold">{selectedStaff.name}</p><p className="text-xs text-slate-500">Role: {selectedStaff.role}</p>
            <p className="mt-1 text-xs">Recorded sales: {selectedStaff.count}</p>
            <p className="text-xs">Sale totals: {money(selectedStaff.recordedTotal)}</p>
          </div>
          <div className="max-h-[24rem] space-y-2 overflow-y-auto">
            {selectedStaff.activity.map(row=><div key={row.id} className="rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700">
              <p className="font-semibold">{row.reference||'Recorded Sale'} · {money(row.total)}</p>
              <p className="text-slate-500">{date(row.created_at)} · {row.payment_method||'Unspecified payment'}</p>
            </div>)}
          </div>
        </div>:<p className="mt-3 text-sm text-slate-500">Select an employee to see their recorded sales activity.</p>}
      </section>
    </div>}
    {tab==='deliveries'&&<section className={panel}><h3 className="text-sm font-bold">Delivery Accountability ({deliveries.length})</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {deliveries.map(row=><article key={row.id} className="min-w-0 space-y-1 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700">
          <p className="truncate text-sm font-bold">{row.customer_name||'Delivery'}</p>
          <p>Status: <strong>{row.status||'Unknown'}</strong></p>
          <p>Delivery fee: {money(row.delivery_cost)}</p>
          <p>Method: {row.delivery_payment_method||'Not recorded'}</p>
          <p className="text-slate-500">{date(row.created_at)}</p>
        </article>)}
        {!deliveries.length&&<p className="text-xs text-slate-500">No delivery records for this branch.</p>}
      </div>
    </section>}
    {tab==='sales'&&<section className={panel}><h3 className="text-sm font-bold">Recorded Sales Activity ({sales.length})</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sales.map(row=><article key={row.id} className="min-w-0 space-y-1 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700">
          <p className="truncate text-sm font-bold">{row.reference||'Sale'}</p>
          <p>Seller: {row.staff_name||row.cashier_name||'Not recorded'}</p>
          <p>Total: {money(row.total)}</p><p>Amount paid: {money(row.amount_paid)}</p>
          <p className="text-slate-500">{date(row.created_at)}</p>
        </article>)}
        {!sales.length&&<p className="text-xs text-slate-500">No sales recorded for this branch.</p>}
      </div>
    </section>}
  </div>;
}
