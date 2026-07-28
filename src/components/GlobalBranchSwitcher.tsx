import React, { useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, LoaderCircle, MapPin, Plus, Search, Settings2, X } from 'lucide-react';
import { useBranchContext } from '../branches/BranchContext';
import type { BranchSummary, SelectableBranchScope } from '../branches/branchTypes';

interface GlobalBranchSwitcherProps {
  onManageBranches: () => void;
}

const locationLabel = (branch: BranchSummary | null) => branch
  ? [branch.city, branch.region].filter(Boolean).join(', ') || branch.country || ''
  : '';

export default function GlobalBranchSwitcher({ onManageBranches }: GlobalBranchSwitcherProps) {
  const { snapshot, isLoading, switchingBranch, switchingToBranchName, chooseBranch } = useBranchContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const branches = snapshot?.directory.branches || [];
  const activeBranch = snapshot?.context.selectedBranch || branches.find(branch => branch.isSelected) || branches[0] || null;
  const entitlement = snapshot?.entitlement;
  const isEligibleSurface = entitlement?.packageId === 'tanzanite' || branches.length > 1;
  const canCreateBranch = entitlement?.subscriptionCurrent === true
    && entitlement.canManageBranches === true
    && snapshot?.serverRolloutEnabled === true
    && entitlement.canOperateAdditionalBranches === true
    && entitlement.currentPhysicalBranchCount < entitlement.effectiveTotalBranches;
  const filteredBranches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return branches;
    return branches.filter(branch => [
      branch.branchName,
      branch.businessName,
      branch.city,
      branch.region,
      branch.country,
    ].some(value => String(value || '').toLowerCase().includes(needle)));
  }, [branches, search]);

  if (!isEligibleSurface && !isLoading) return null;

  const select = async (branch: BranchSummary) => {
    setSelectionError(null);
    const scope: SelectableBranchScope = branch.isCompatibilityPrimary ? 'compatibility_primary' : 'branch';
    try {
      await chooseBranch(branch.id, scope);
      setOpen(false);
      setSearch('');
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : 'Branch could not be selected.');
    }
  };

  const closedButton = (
    <button
      type="button"
      onClick={() => !switchingBranch && setOpen(true)}
      disabled={isLoading || switchingBranch}
      className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20 xl:min-w-[220px] xl:px-3"
      aria-label="Switch active branch"
      aria-haspopup="dialog"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        {switchingBranch ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-[11px] font-black text-slate-900 dark:text-white xl:text-xs">
            {switchingBranch ? `Switching to ${switchingToBranchName || 'branch'}…` : activeBranch?.branchName || 'Loading branch…'}
          </span>
          {activeBranch?.isDefault ? <span className="hidden shrink-0 rounded bg-emerald-100 px-1 py-0.5 text-[7px] font-black uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:inline">Main</span> : null}
        </span>
        <span className="hidden truncate text-[9px] font-semibold text-slate-500 dark:text-slate-400 xl:block">{locationLabel(activeBranch) || 'Operational workspace'}</span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );

  const selectorContent = (
    <>
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-base font-black text-slate-950 dark:text-white">Switch branch</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">Only branches assigned to your account are shown.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-label="Close branch switcher"><X className="h-4 w-4" /></button>
      </div>
      {branches.length > 5 ? (
        <label className="relative mx-4 mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Search branches" />
        </label>
      ) : null}
      <div className="max-h-[52dvh] overflow-y-auto p-2">
        {filteredBranches.map(branch => {
          const selected = branch.id === snapshot?.context.activeBranchId
            || (branch.isCompatibilityPrimary && snapshot?.context.activeScope === 'compatibility_primary');
          return (
            <button key={branch.id || 'compatibility-primary'} type="button" onClick={() => void select(branch)} disabled={switchingBranch || branch.status !== 'active'} className={`flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:opacity-50 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}><Building2 className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-sm font-black text-slate-950 dark:text-white">{branch.branchName}</span>{branch.isDefault ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">Main Branch</span> : null}</span>
                <span className="mt-1 flex items-center gap-1 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400"><MapPin className="h-3 w-3 shrink-0" />{locationLabel(branch) || branch.businessName || 'Location not set'}</span>
              </span>
              {selected ? <Check className="h-5 w-5 shrink-0 text-emerald-600" /> : null}
            </button>
          );
        })}
      </div>
      {selectionError ? <p className="mx-4 mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{selectionError}</p> : null}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-800">
        <button type="button" onClick={() => { setOpen(false); onManageBranches(); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 dark:border-slate-700 dark:text-slate-200"><Settings2 className="h-4 w-4" />Manage Branches</button>
        <button type="button" onClick={() => { setOpen(false); onManageBranches(); }} disabled={!canCreateBranch} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-black text-white disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800"><Plus className="h-4 w-4" />Add Branch</button>
      </div>
    </>
  );

  return (
    <div className="relative min-w-0">
      {closedButton}
      {open ? (
        <>
          <div className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-[1px] xl:hidden" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label="Select active branch" className="fixed inset-x-0 bottom-0 z-[90] overflow-hidden rounded-t-[26px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 xl:absolute xl:inset-auto xl:left-0 xl:top-[calc(100%+0.5rem)] xl:z-50 xl:w-[390px] xl:rounded-2xl">
            {selectorContent}
          </div>
        </>
      ) : null}
    </div>
  );
}
