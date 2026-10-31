import React, { useState } from 'react';
import { Building2, CreditCard, FileCheck2, FlaskConical, Server, Users, ShieldCheck, ArrowRight } from 'lucide-react';

/**
 * Additive Orvix Pro admin workspace. This first UI stage deliberately does
 * not fabricate subscribers, collect money, activate entitlements, or create
 * demo users. Future reads/writes must use audited, server-authorized APIs.
 */
type Section = 'clients' | 'agreements' | 'billing' | 'demo' | 'edge';
const sections = [
  { id: 'clients' as const, label: 'Clients', icon: Users },
  { id: 'agreements' as const, label: 'Agreements', icon: FileCheck2 },
  { id: 'billing' as const, label: 'Billing', icon: CreditCard },
  { id: 'demo' as const, label: 'Pro Demo', icon: FlaskConical },
  { id: 'edge' as const, label: 'Pro Edge', icon: Server },
];

interface Props {
  onOpenSubscribers: () => void;
}

export default function OrvixProAdminPanel({ onOpenSubscribers }: Props) {
  const [section, setSection] = useState<Section>('clients');

  return (
    <div className="space-y-4 text-left animate-fade-in">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400"><Building2 size={20} /></div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-400">Enterprise workspace</p>
            <h2 className="text-lg font-extrabold text-white">Orvix Pro</h2>
            <p className="text-xs text-slate-400">Private cloud-first accounts. Existing Ruby, Diamond and Tanzanite remain unchanged.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Orvix Pro management">
        {sections.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={section === item.id}
              onClick={() => setSection(item.id)}
              className={'shrink-0 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ' +
                (section === item.id ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white')}>
              <Icon size={15} />{item.label}
            </button>
          );
        })}
      </div>

      <section role="tabpanel" className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        {section === 'clients' && (
          <>
            <h3 className="text-base font-bold text-white">Pro Clients</h3>
            <p className="text-sm text-slate-400">Private Pro memberships will be listed here from a verified, tenant-scoped admin API. Ordinary subscribers will not be converted or given Pro access automatically.</p>
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-center">
              <Users className="mx-auto mb-2 text-slate-500" size={22} />
              <p className="text-sm font-semibold text-slate-200">Client directory not connected yet</p>
              <p className="mt-1 text-xs text-slate-500">No client records are being simulated.</p>
            </div>
            <button type="button" onClick={onOpenSubscribers} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-slate-800">
              Open existing Subscribers <ArrowRight size={14} />
            </button>
          </>
        )}
        {section === 'agreements' && (
          <>
            <h3 className="text-base font-bold text-white">Individual Client Agreements</h3>
            <p className="text-sm text-slate-400">Every Pro client will have an individually agreed monthly amount, till count, resource allocation and effective date, set only by the Orvix team.</p>
            <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-4 text-sm text-slate-300 space-y-2">
              <p>Monthly fee: <strong className="text-white">Set per client — no flat rate</strong></p>
              <p>Billing period: <strong className="text-white">Monthly</strong></p>
              <p>Terms and activation: <strong className="text-white">Admin-managed, pending secure billing implementation</strong></p>
            </div>
          </>
        )}
        {section === 'billing' && (
          <>
            <h3 className="text-base font-bold text-white">Payments & Renewal</h3>
            <p className="text-sm text-slate-400">A verified payment must cover the client's agreed amount before a new paid period is activated. Partial payments remain incomplete; overpayments are recorded for reconciliation or future credit.</p>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
              Payment integration is not connected. No automatic charges, subscription renewals or account activations are performed by this screen.
            </div>
          </>
        )}
        {section === 'demo' && (
          <>
            <div className="flex items-center gap-2"><FlaskConical size={20} className="text-emerald-400" /><h3 className="text-base font-bold text-white">Orvix Pro Demo Account</h3></div>
            <p className="text-sm text-slate-400">Reserve a separate, isolated Pro tenant for the owner's tests. Use the same private <code className="text-emerald-300">/pro</code> email-and-password login, with a bounded administrator-approved trial. Never reuse an existing customer's tenant or credentials.</p>
            <div className="rounded-xl border border-slate-700 p-4 flex items-start gap-3">
              <ShieldCheck size={19} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Demo account not provisioned</p>
                <p className="text-xs text-slate-400 mt-1">The new test tenant, verified identity and database entitlement must exist before the demo can sign in. This panel does not create a fake login.</p>
              </div>
            </div>
            <button type="button" onClick={onOpenSubscribers} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-slate-800">
              Review account management <ArrowRight size={14} />
            </button>
          </>
        )}
        {section === 'edge' && (
          <>
            <h3 className="text-base font-bold text-white">Orvix Pro Edge</h3>
            <p className="text-sm text-slate-400">Future optional on-premises server solution. Cloud-based Orvix Pro comes first; Edge hardware, fleet monitoring and local synchronization will be added later.</p>
            <p className="text-xs text-slate-500">No device purchase, server installation or Edge connectivity is required for the initial Pro UI release.</p>
          </>
        )}
      </section>
    </div>
  );
}
