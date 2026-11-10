import React, { useEffect, useMemo, useState } from 'react';
import { FileCheck2, RefreshCw, ShieldAlert } from 'lucide-react';
import { getSecureDataBridgeClient } from '../../../shared/dataBridge/secureDataBridge';
type Client={tenantId:string;businessName:string;status:string};
type Agreement={tenant_id:string;status:string;till_count:number;fee_per_till:number;monthly_amount:number;notes?:string};
const formClass='min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-emerald-500';
export default function OrvixProAgreementsEditor(){
  const[clients,setClients]=useState<Client[]>([]);
  const[agreements,setAgreements]=useState<Agreement[]>([]);
  const[tenantId,setTenantId]=useState('');
  const[tills,setTills]=useState('1');
  const[fee,setFee]=useState('120000');
  const[notes,setNotes]=useState('');
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');
  const month=useMemo(()=>Number(tills||0)*Number(fee||0),[tills,fee]);
  const money=(amount:number)=>'TZS '+amount.toLocaleString(undefined,{maximumFractionDigits:2});
  const fetchPrivate=async(path:string,method:'GET'|'POST'='GET',body?:object)=>{
    const client=await getSecureDataBridgeClient();
    const {data,error:authError}=await client.auth.getSession();
    if(authError||!data.session?.access_token)throw new Error('Sign in to Super Admin again.');
    const r=await fetch(path,{method,cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token,Accept:'application/json',
      ...(method==='POST'?{'Content-Type':'application/json'}:{})},
      ...(method==='POST'?{body:JSON.stringify(body)}:{})});
    const p=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(String(p.error||'Could not load Pro agreements.'));
    return p;
  };
  const load=async()=>{
    setBusy(true);setError('');
    try{
      const [p,a]=await Promise.all([fetchPrivate('/api/orvix-pro/admin/clients'),fetchPrivate('/api/orvix-pro/admin/agreements')]);
      setClients(Array.isArray(p.clients)?p.clients:[]);
      setAgreements(Array.isArray(a.agreements)?a.agreements:[]);
    }catch(e){setError(e instanceof Error?e.message:'Agreements unavailable.');}
    finally{setBusy(false);}
  };
  useEffect(()=>{void load();},[]);
  const choose=(id:string)=>{
    setTenantId(id);
    const item=agreements.find(a=>a.tenant_id===id);
    setTills(String(item?.till_count||1));
    setFee(String(item?.fee_per_till??120000));
    setNotes(item?.notes||'');
    setNotice('');setError('');
  };
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await fetchPrivate('/api/orvix-pro/admin/agreements','POST',
        {tenantId,tillCount:Number(tills),feePerTill:Number(fee),notes});
      setAgreements(old=>[...old.filter(a=>a.tenant_id!==tenantId),result.agreement]);
      setNotice('Agreement saved as draft. No payment was collected and no access was activated.');
    }catch(e){setError(e instanceof Error?e.message:'Could not save draft.');}
    finally{setBusy(false);}
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-base font-bold text-white"><FileCheck2 size={18}/>Individual Pro Agreements</h3>
        <p className="mt-1 text-xs text-slate-400">Set a different monthly price and till count for each private Pro business.</p></div>
      <button type="button" onClick={()=>void load()} disabled={busy}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-700 px-3 text-xs text-slate-300"><RefreshCw size={15}/>Refresh</button>
    </div>
    <p className="flex gap-2 rounded-xl border border-amber-700/30 bg-amber-950/20 p-3 text-xs text-amber-200">
      <ShieldAlert size={17} className="shrink-0"/>Draft agreements are internal records only. No charge, renewal, payment verification or Pro entitlement change occurs here.</p>
    {error&&<p role="alert" className="rounded-xl bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</p>}
    <form onSubmit={e=>void save(e)} className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <label className="block text-xs font-semibold text-slate-300">Pro Client
          <select required value={tenantId} onChange={e=>choose(e.target.value)} className={'mt-1 '+formClass}>
            <option value="">Select a private Pro client</option>
            {clients.map(c=><option key={c.tenantId} value={c.tenantId}>{c.businessName} ({c.status})</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="min-w-0 text-xs font-semibold text-slate-300">Tills
            <input required type="number" min={1} max={1000} step={1} value={tills} onChange={e=>setTills(e.target.value)} className={'mt-1 '+formClass}/>
          </label>
          <label className="min-w-0 text-xs font-semibold text-slate-300">Fee / till (TZS)
            <input required type="number" min={0} step={0.01} value={fee} onChange={e=>setFee(e.target.value)} className={'mt-1 '+formClass}/>
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-300">Contract Notes
          <textarea rows={3} maxLength={900} value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder="Individual customer terms..." className={'mt-1 '+formClass}/>
        </label>
      </div>
      <div className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-slate-400">Monthly agreed amount</p>
          <p className="break-words text-2xl font-bold text-emerald-300">{Number.isFinite(month)?money(month):'Invalid amount'}</p>
          <p className="text-xs text-slate-500">{tills||0} tills × {money(Number(fee||0))} per till</p>
          {tenantId&&<p className="text-xs text-slate-400">Draft status: {agreements.find(a=>a.tenant_id===tenantId)?.status||'Not yet saved'}</p>}
        </div>
        <button type="submit" disabled={busy||!tenantId||!Number.isFinite(month)}
          className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50">Save Draft Agreement</button>
      </div>
    </form>
  </div>;
}
