import React, { useCallback, useEffect, useState } from 'react';
import { getSecureDataBridgeClient } from '../../../shared/dataBridge/secureDataBridge';

type Agent = { name:string; status:string; affiliates:number; customers:number };
type Affiliate = { name:string; location:string; agent:string; customers:number };
type Customer = { name:string; affiliate:string; location:string; status:string };
type Audit = { affiliate:string; status:string; reason:string|null; reference:string|null; requested_at:string|null };
type Summary = {
  partial:boolean; agents:Agent[]; affiliate_total:number; assigned_affiliates:number;
  unassigned_affiliates:number; referred_customer_total:number;
  affiliates:Affiliate[]; customer_sources:Customer[]; payout_audit:Audit[]; payout_audit_more:boolean;
};

export default function SuperAffiliateNetworkOverview({initialTab: _initialTab, isUnlocked: _isUnlocked}:{
  initialTab?: 'agents'|'subAffiliates'|'payouts'; isUnlocked?: boolean;
}) {
  const [data,setData]=useState<Summary|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    setLoading(true);
    try {
      const client=await getSecureDataBridgeClient();
      const { data: auth }=await client.auth.getSession();
      if(!auth.session?.access_token)throw new Error('Admin authentication required.');
      const response=await fetch('/api/platform/affiliate-network-overview',{
        headers:{Authorization:`Bearer ${auth.session.access_token}`},
        credentials:'same-origin',
      });
      if(!response.ok)throw new Error('Unable to load affiliate overview.');
      setData(await response.json());
      setError('');
    } catch(e:any){setError(e?.message||'Unable to load overview.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  return <section className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-white">Affiliate Network Overview</h2>
        <p className="mt-1 text-xs text-slate-400">Read-only supervision · Payout operations belong to Agents</p>
      </div>
      <button type="button" onClick={()=>void load()} disabled={loading}
        className="rounded-lg border border-emerald-800 px-3 py-2 text-xs text-emerald-200 disabled:opacity-50">Refresh</button>
    </header>
    {error&&<p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/40 p-3 text-xs text-rose-200">{error}</p>}
    {loading&&!data&&<p className="text-sm text-slate-400">Loading network summary...</p>}
    {data&&<>
      {data.partial&&<p role="status" className="rounded-lg border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">Large network: only the first 200 records per source were counted. Totals below are partial, not complete.</p>}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          ['Agents',data.agents.length],
          ['Affiliates',data.affiliate_total],
          ['Assigned',data.assigned_affiliates],
          ['Referred Customers',data.referred_customer_total],
        ].map(([label,value])=><div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-sm">
          <p className="text-[11px] text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</p>
        </div>)}
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">Agents</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400"><tr>
            <th className="px-4 py-2 font-medium">Agent</th><th className="px-4 py-2 font-medium">Affiliates</th>
            <th className="px-4 py-2 font-medium">Customers</th><th className="px-4 py-2 font-medium">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-100">
            {data.agents.map((a,i)=><tr key={i}><td className="px-4 py-3">{a.name}</td><td className="px-4 py-3 tabular-nums">{a.affiliates}</td><td className="px-4 py-3 tabular-nums">{a.customers}</td><td className="px-4 py-3">{a.status}</td></tr>)}
            {!data.agents.length&&<tr><td colSpan={4} className="px-4 py-5 text-slate-500">No registered Agents.</td></tr>}
          </tbody>
        </table></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">Affiliate Locations and Sources</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400"><tr><th className="px-4 py-2 font-medium">Affiliate</th><th className="px-4 py-2 font-medium">Agent</th><th className="px-4 py-2 font-medium">Location</th><th className="px-4 py-2 font-medium">Customers</th></tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-100">
            {data.affiliates.map((a,i)=><tr key={i}><td className="px-4 py-3">{a.name}</td><td className="px-4 py-3">{a.agent}</td><td className="px-4 py-3">{a.location}</td><td className="px-4 py-3 tabular-nums">{a.customers}</td></tr>)}
          </tbody>
        </table></div>
        {data.unassigned_affiliates>0&&<p className="border-t border-slate-800 px-4 py-2 text-xs text-amber-300">{data.unassigned_affiliates} affiliates still need verified Agent assignment.</p>}
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">Customer Referral Attribution · Recent 50</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400"><tr><th className="px-4 py-2 font-medium">Customer</th><th className="px-4 py-2 font-medium">Referred by</th><th className="px-4 py-2 font-medium">Location</th><th className="px-4 py-2 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-100">{data.customer_sources.map((c,i)=><tr key={i}><td className="px-4 py-3">{c.name}</td><td className="px-4 py-3">{c.affiliate}</td><td className="px-4 py-3">{c.location}</td><td className="px-4 py-3">{c.status}</td></tr>)}</tbody>
        </table></div>
        {!data.customer_sources.length&&<p className="px-4 py-4 text-xs text-slate-500">No attributed customers recorded.</p>}
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">Recent Payout Audit · Read Only</h3>
        <div className="divide-y divide-slate-800">
          {data.payout_audit.map((p,i)=><div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
            <span className="text-slate-200">{p.affiliate}</span>
            <span className="text-slate-400">{p.status}</span>
            {(p.reason||p.reference)&&<span className="basis-full break-words text-[11px] text-slate-400">{p.reason? `Reason: ${p.reason}`:`Reference: ${p.reference}`}</span>}
          </div>)}
          {!data.payout_audit.length&&<p className="px-4 py-5 text-xs text-slate-500">No payment requests recorded.</p>}
        </div>
        {data.payout_audit_more&&<p className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500">Showing latest 30 records only.</p>}
      </section>
    </>}
  </section>;
}
