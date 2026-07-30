import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Check, ChevronDown, LoaderCircle, MapPin, Plus, Search, Settings2, X } from 'lucide-react';
import { useBranchContext } from '../branches/BranchContext';
import type { BranchSummary, SelectableBranchScope } from '../branches/branchTypes';

interface GlobalBranchSwitcherProps {
  onManageBranches: () => void;
}

const locationLabel = (branch: BranchSummary | null) => branch
  ? [branch.city, branch.region].filter(Boolean).join(', ') || branch.country || ''
  : '';

// Tailwind's `xl` breakpoint (1280px) - matches the `xl:` classes used
// throughout Dashboard.tsx to switch between the mobile and desktop chrome.
const DESKTOP_MEDIA_QUERY = '(min-width: 1280px)';

function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MEDIA_QUERY).matches : true
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const handleChange = () => setIsDesktop(mql.matches);
    handleChange();
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);
  return isDesktop;
}

export default function GlobalBranchSwitcher({ onManageBranches }: GlobalBranchSwitcherProps) {
  const { snapshot, isLoading, switchingBranch, switchingToBranchName, chooseBranch } = useBranchContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const isDesktop = useIsDesktopViewport();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = React.useId();

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

  // The mobile top bar (Dashboard.tsx) uses `transform: translateZ(0)` for
  // scroll performance. Any ancestor transform creates a new containing
  // block for position:fixed descendants, so the sheet below - even though
  // it used `fixed inset-x-0 bottom-0` - was being confined inside that
  // ~60px header instead of covering the viewport. That's what caused it to
  // render clipped/upward and let the header's own contents (language
  // button) appear over it. Rendering through a portal to document.body
  // (same pattern already used by ui/ModernSelect.tsx) sidesteps this
  // entirely: the sheet is no longer a DOM descendant of the transformed
  // header, so `fixed` resolves against the real viewport again.
  useEffect(() => {
    if (!open || isDesktop) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 180);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isDesktop]);

  // Escape-to-close and return-focus-to-trigger for the desktop dropdown too.
  useEffect(() => {
    if (!open || !isDesktop) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isDesktop]);

  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

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
      ref={triggerRef}
      type="button"
      onClick={() => !switchingBranch && setOpen(true)}
      disabled={isLoading || switchingBranch}
      className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20 xl:min-w-[220px] xl:px-3"
      aria-label="Switch active branch"
      aria-haspopup="dialog"
      aria-expanded={open}
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

  const selectorBody = (
    <>
      {branches.length > 5 ? (
        <label className="relative mx-4 mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Search branches" />
        </label>
      ) : null}
      <div role="listbox" aria-label="Branches" className="max-h-[52dvh] overflow-y-auto overscroll-contain p-2">
        {filteredBranches.map(branch => {
          const selected = branch.id === snapshot?.context.activeBranchId
            || (branch.isCompatibilityPrimary && snapshot?.context.activeScope === 'compatibility_primary');
          return (
            <button key={branch.id || 'compatibility-primary'} type="button" role="option" aria-selected={selected} onClick={() => void select(branch)} disabled={switchingBranch || branch.status !== 'active'} className={`flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:opacity-50 ${selected ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}><Building2 className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-sm font-black text-slate-950 dark:text-white">{branch.branchName}</span>{branch.isDefault ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">Main Branch</span> : null}</span>
                <span className="mt-1 flex items-center gap-1 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400"><MapPin className="h-3 w-3 shrink-0" />{locationLabel(branch) || branch.businessName || 'Location not set'}</span>
              </span>
              {selected ? <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /> : null}
              <span className="sr-only">{selected ? 'Currently active branch' : ''}</span>
            </button>
          );
        })}
      </div>
      {selectionError ? <p className="mx-4 mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{selectionError}</p> : null}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-800">
        <button type="button" onClick={() => { setOpen(false); onManageBranches(); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 dark:border-slate-700 dark:text-slate-200"><Settings2 className="h-4 w-4" />Manage Branches</button>
        <button type="button" onClick={() => { setOpen(false); onManageBranches(); }} disabled={!canCreateBranch} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-black text-white disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800"><Plus className="h-4 w-4" />Add Branch</button>
      </div>
    </>
  );

  // Mobile & tablet (below the `xl` breakpoint): native-style bottom sheet,
  // rendered through a portal so it is never trapped inside a
  // transformed/positioned ancestor (see note above).
  const mobileSheet = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10050] flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close branch switcher"
            className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[26px] border border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.8 }}
          >
            <div className="flex justify-center pb-1 pt-2.5">
              <span className="h-1.5 w-11 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
            <div className="flex items-start justify-between border-b border-slate-200 px-4 pb-4 pt-1 dark:border-slate-800">
              <div>
                <h2 id={titleId} className="text-base font-black text-slate-950 dark:text-white">Switch branch</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">Only branches assigned to your account are shown.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-label="Close branch switcher"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {selectorBody}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  // Desktop (`xl` and up): unchanged anchored dropdown behaviour - no
  // clipping/overlap bug was reported here, so it keeps its original
  // presentation and is not portaled.
  const desktopDropdown = open ? (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[390px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div>
          <h2 id={titleId} className="text-base font-black text-slate-950 dark:text-white">Switch branch</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">Only branches assigned to your account are shown.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-label="Close branch switcher"><X className="h-4 w-4" /></button>
      </div>
      {selectorBody}
    </div>
  ) : null;

  return (
    <div className="relative min-w-0">
      {closedButton}
      {isDesktop
        ? desktopDropdown
        : (open && typeof document !== 'undefined' ? createPortal(mobileSheet, document.body) : null)}
    </div>
  );
}
