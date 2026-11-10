import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, History, RefreshCw, ShieldAlert, Wallet } from 'lucide-react';
import { getSecureDataBridgeClient } from '../../shared/dataBridge/secureDataBridge';

type Shift = {
  id: string; cashier_id: string; cashier_name: string; status: 'open'|'submitted'|'reviewed'|'flagged';
  opening_float: number; counted_cash: number|null; opened_at: string; submitted_at?: string;
  cashier_note?: string; review_note?: string;
};
type Section = 'settle'|'history'|'review';
interface Props { branchId: string|null; userId:string; currency:string; cashierName:string; }
const money = (v:unknown,currency:string) => currency+' '+Number(v||0).toLocaleString(undefined,{maximumFractionDigits:2});
const fieldClass='min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const cardClass='min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5';
export default function OrvixProSettleWorkspace({branchId,userId,currency,cashierName}:Props) {
  const [section,setSection]=useState<Section>('settle');
  const [records,setRecords]=useState<Shift[]>([]);
  const [manager,setManager]=useState(false);
  const [opening,setOpening]=useState('');
  const [counted,setCounted]=useState('');
  const [note,setNote]=useState('');
  const [reviewNote,setReviewNote]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const active=useMemo(()=>records.find(x=>x.status==='open' && x.cashier_id===userId),[records,userId]);
  const submitted=useMemo(()=>records.filter(x=>x.status==='submitted'),[records]);
  const request=useCallback(async(path:string,method:'GET'|'POST'='GET',body?:object)=>{
    const client=await getSecureDataBridgeClient();
    const {data,error:sessionError}=await client.auth.getSession();
    if(sessionError||!data.session?.access_token)throw new Error('Please sign in to Orvix Pro again.');
    const response=await fetch(path,{method,cache:'no-store',
      headers:{Authorization:'Bearer '+data.session.access_token,Accept:'application/json',
        ...(method==='POST'?{'Content-Type':'application/json'}:{})},
      ...(method==='POST'?{body:JSON.stringify(body)}:{})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(String(payload.error||'Shift request failed.'));
    return payload;
  },[]);
  const refresh=useCallback(async()=>{
    if(!branchId){setRecords([]);setError('Select the active branch first.');return;}
    setBusy(true);setError('');
    try{
      const result=await request('/api/orvix-pro/shifts?branchId='+encodeURIComponent(branchId));
      setRecords(Array.isArray(result.records)?result.records:[]);
      setManager(result.manager===true);
    }catch(e){setError(e instanceof Error?e.message:'Unable to load shifts.');}
    finally{setBusy(false);}
  },[branchId,request]);
  useEffect(()=>{void refresh();},[refresh]);
  const save=async(path:string,data:object,message:string)=>{
    if(!branchId||busy)return;setBusy(true);setError('');setNotice('');
    try{
      await request(path,'POST',{branchId,...data});
      setNotice(message);setOpening('');setCounted('');setNote('');
      const result=await request('/api/orvix-pro/shifts?branchId='+encodeURIComponent(branchId));
      setRecords(Array.isArray(result.records)?result.records:[]);
      setManager(result.manager===true);
    }catch(e){setError(e instanceof Error?e.message:'Unable to save.');}
    finally{setBusy(false);}
  };
  return <div id="orvix-pro-settle-workspace" className="min-w-0 space-y-4">
    <header className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase text-emerald-600">Orvix Pro · Cashier control</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Settle & Shift Records</h2>
          <p className="mt-1 text-xs text-slate-500">Cashier: {cashierName} · Currency: {currency}</p></div>
        <button onClick={()=>void refresh()} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs dark:border-slate-700"><RefreshCw size={15}/>Refresh</button>
      </div>
      <p className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <ShieldAlert size={17} className="shrink-0"/> Physical cash counts are self-declared. They are not verified sales balances. No bank transfer, Treasury posting, or handover is made here.</p>
    </header>
    <nav className="grid grid-cols-3 gap-2" aria-label="Settle sections">
      {([['settle','Settle',Wallet],['history','Shift Records',History],['review','Review',CheckCircle2]] as const).map(([id,label,Icon])=>
        <button key={id} type="button" onClick={()=>setSection(id)}
          className={'flex min-w-0 min-h-11 items-center justify-center gap-1.5 rounded-xl border px-1.5 text-xs font-semibold sm:text-sm '+(section===id?'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300':'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300')}>
          <Icon size={16}/>{label}</button>)}
    </nav>
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{notice}</p>}
    {section==='settle'&&<div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section className={cardClass}><h3 className="text-sm font-bold">Open a shift</h3>
        {active?<div className="mt-3 space-y-1 rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-950">
          <p className="font-bold text-emerald-700 dark:text-emerald-300">Shift open</p>
          <p>Opened: {new Date(active.opened_at).toLocaleString()}</p>
          <p>Opening float: {money(active.opening_float,currency)}</p>
        </div>:<form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();void save('/api/orvix-pro/shifts/open',{openingFloat:opening},'New shift opened and audited.');}}>
          <label className="block text-xs font-semibold">Opening Float ({currency})
            <input required type="number" min="0" step="0.01" value={opening} onChange={e=>setOpening(e.target.value)} className={'mt-1 '+fieldClass}/>
          </label>
          <button type="submit" disabled={!branchId||busy} className="min-h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-50">Open shift</button>
        </form>}
      </section>
      <section className={cardClass}><h3 className="text-sm font-bold">Count & submit physical cash</h3>
        <p className="mt-1 text-xs text-slate-500">Expected till cash will be calculated only once verified ledger integration is complete.</p>
        <form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();if(active)void save('/api/orvix-pro/shifts/submit',{shiftId:active.id,countedCash:counted,note},'Count submitted for independent review.');}}>
          <label className="block text-xs font-semibold">Cash counted ({currency})
            <input disabled={!active} required type="number" min="0" step="0.01" value={counted} onChange={e=>setCounted(e.target.value)} className={'mt-1 '+fieldClass}/>
          </label>
          <label className="block text-xs font-semibold">Cashier notes
            <textarea value={note} maxLength={500} rows={2} onChange={e=>setNote(e.target.value)} className={'mt-1 '+fieldClass}/>
          </label>
          <button type="submit" disabled={!active||busy} className="min-h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-50">Submit cash count</button>
        </form>
      </section>
    </div>}
    {section==='history'&&<section className={cardClass}><h3 className="text-sm font-bold">Shift history ({records.length})</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {records.map(x=><article key={x.id} className="min-w-0 space-y-1 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700">
          <div className="flex justify-between gap-2"><strong className="truncate">{x.cashier_name}</strong><span>{x.status}</span></div>
          <p>{new Date(x.opened_at).toLocaleString()}</p><p>Opening: {money(x.opening_float,currency)}</p>
          <p>Counted: {x.counted_cash===null?'Pending':money(x.counted_cash,currency)}</p>
          {x.review_note&&<p className="break-words text-slate-500">{x.review_note}</p>}
        </article>)}
        {!records.length&&<p className="text-sm text-slate-500">No shifts recorded for this branch.</p>}
      </div>
    </section>}
    {section==='review'&&<section className={cardClass}><h3 className="text-sm font-bold">Manager review</h3>
      <p className="mt-1 text-xs text-slate-500">Cashier cannot approve their own submission.</p>
      {!manager&&<p className="mt-3 text-xs text-amber-600">Manager access required.</p>}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {submitted.map(x=><article key={x.id} className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-sm font-semibold">{x.cashier_name} · {money(x.counted_cash,currency)}</p>
          {x.cashier_note&&<p className="break-words text-xs text-slate-500">{x.cashier_note}</p>}
          <textarea disabled={!manager||x.cashier_id===userId} rows={2} maxLength={500} placeholder="Review notes"
            value={reviewNote[x.id]||''} onChange={e=>setReviewNote(p=>({...p,[x.id]:e.target.value}))} className={fieldClass}/>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!manager||busy||x.cashier_id===userId} onClick={()=>void save('/api/orvix-pro/shifts/review',{shiftId:x.id,decision:'reviewed',note:reviewNote[x.id]},'Independent review recorded.')}
              className="min-h-10 rounded-xl bg-emerald-600 px-2 text-xs font-bold text-white disabled:opacity-40">Approve</button>
            <button disabled={!manager||busy||x.cashier_id===userId} onClick={()=>void save('/api/orvix-pro/shifts/review',{shiftId:x.id,decision:'flagged',note:reviewNote[x.id]},'Shift flagged for follow-up.')}
              className="min-h-10 rounded-xl border border-rose-400 px-2 text-xs font-bold text-rose-600 disabled:opacity-40">Flag issue</button>
          </div>
        </article>)}
        {!submitted.length&&<p className="text-xs text-slate-500">No submitted shifts awaiting review.</p>}
      </div>
    </section>}
    <p className="text-[11px] text-slate-500">Cash transfers and handover remain locked until double-entry posting and dual confirmation are implemented.</p>
  </div>;
}
