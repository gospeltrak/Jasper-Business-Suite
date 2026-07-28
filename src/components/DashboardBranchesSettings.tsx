import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Info,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Tenant } from '../types';
import { useBranchContext } from '../branches/BranchContext';
import type { BranchRelationshipType, BranchSummary, CreateBranchInput } from '../branches/branchTypes';

interface DashboardBranchesSettingsProps {
  activeTenant: Tenant;
  onTriggerUpgrade?: (limitType: 'products' | 'stores' | 'staff' | 'expired') => void;
}

interface BranchDraft {
  branchName: string;
  branchCode: string;
  businessName: string;
  relationshipType: BranchRelationshipType;
  address: string;
  city: string;
  region: string;
  district: string;
  country: string;
  phone: string;
  email: string;
  openingDate: string;
}

const createEmptyDraft = (tenant: Tenant): BranchDraft => ({
  branchName: '',
  branchCode: '',
  businessName: tenant.businessName || tenant.name || '',
  relationshipType: 'same_business',
  address: '',
  city: tenant.city || '',
  region: '',
  district: '',
  country: tenant.country || 'Tanzania',
  phone: '',
  email: '',
  openingDate: new Date().toISOString().slice(0, 10),
});

const buildBranchCode = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 16);

const relationshipLabel = (branch: BranchSummary) => {
  if (branch.isDefault) return 'Primary office';
  return branch.relationshipType === 'independent_business' ? 'Independent business' : 'Same business';
};

const branchLocation = (branch: BranchSummary) => [branch.city, branch.region, branch.country]
  .filter(Boolean)
  .filter((value, index, values) => values.indexOf(value) === index)
  .join(', ') || 'Location not set';

const fieldClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const labelClass = 'mb-1.5 block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400';

function BranchCreationWizard({
  activeTenant,
  onClose,
}: {
  activeTenant: Tenant;
  onClose: () => void;
}) {
  const { addBranch } = useBranchContext();
  const draftStorageKey = `jasper:branch-draft:v1:${activeTenant.id}`;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<BranchDraft>(() => {
    try {
      const savedDraft = window.sessionStorage.getItem(draftStorageKey);
      return savedDraft ? { ...createEmptyDraft(activeTenant), ...JSON.parse(savedDraft) } : createEmptyDraft(activeTenant);
    } catch {
      return createEmptyDraft(activeTenant);
    }
  });
  const [codeWasEdited, setCodeWasEdited] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Draft persistence is a convenience; branch creation remains usable if storage is unavailable.
    }
  }, [draft, draftStorageKey]);

  const updateDraft = <K extends keyof BranchDraft>(key: K, value: BranchDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const updateBranchName = (value: string) => {
    setDraft(current => ({
      ...current,
      branchName: value,
      branchCode: codeWasEdited ? current.branchCode : buildBranchCode(value),
    }));
  };

  const basicInfoIsValid = draft.branchName.trim().length >= 2
    && (!draft.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email));

  const submitBranch = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const input: CreateBranchInput = {
        branchName: draft.branchName.trim(),
        branchCode: draft.branchCode.trim() || undefined,
        relationshipType: draft.relationshipType,
        businessName: draft.businessName.trim() || undefined,
        address: draft.address.trim() || undefined,
        city: draft.city.trim() || undefined,
        region: draft.region.trim() || undefined,
        district: draft.district.trim() || undefined,
        country: draft.country.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        openingDate: draft.openingDate || undefined,
      };
      await addBranch(input);
      try {
        window.sessionStorage.removeItem(draftStorageKey);
      } catch {
        // The server creation succeeded; local draft cleanup must not turn it into a failure.
      }
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Branch could not be created.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm md:items-center md:p-5" role="dialog" aria-modal="true" aria-labelledby="branch-wizard-title">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 md:h-auto md:max-h-[92vh] md:max-w-4xl md:rounded-[24px] md:border md:border-slate-200 md:dark:border-slate-700">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] dark:border-slate-800 md:px-6 md:py-5">
          <div>
            <h3 id="branch-wizard-title" className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Add a branch</h3>
            <p className="mt-1 hidden text-sm font-medium text-slate-500 dark:text-slate-400 sm:block">Create the branch identity first. Catalogue and warehouse setup remain separate.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white" aria-label="Close branch wizard">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="sticky top-0 z-10 grid grid-cols-3 border-b border-slate-200 bg-slate-50/95 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:px-6">
          {['Basic information', 'Relationship', 'Review'].map((label, index) => {
            const number = index + 1;
            const isActive = number === step;
            const isComplete = number < step;
            return (
              <div key={label} className={`flex min-h-14 items-center justify-center gap-2 border-b-2 px-1 md:min-h-16 md:justify-start md:gap-3 md:px-2 ${isActive ? 'border-emerald-600' : 'border-transparent'}`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${isComplete ? 'bg-emerald-600 text-white' : isActive ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {isComplete ? <Check className="h-4 w-4" /> : number}
                </span>
                <span className={`hidden text-xs font-black sm:block ${isActive ? 'text-slate-950 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
              </div>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 md:p-6 md:pb-6">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Branch name *</label>
                <input className={fieldClass} value={draft.branchName} onChange={event => updateBranchName(event.target.value)} maxLength={120} placeholder="e.g. Mwenge Branch" autoFocus />
              </div>
              <div>
                <label className={labelClass}>Branch code</label>
                <input className={fieldClass} value={draft.branchCode} onChange={event => { setCodeWasEdited(true); updateDraft('branchCode', buildBranchCode(event.target.value)); }} maxLength={20} placeholder="Auto-generated" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Business display name</label>
                <input className={fieldClass} value={draft.businessName} onChange={event => updateDraft('businessName', event.target.value)} maxLength={160} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Street address</label>
                <input className={fieldClass} value={draft.address} onChange={event => updateDraft('address', event.target.value)} maxLength={500} placeholder="Building, street or landmark" />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input className={fieldClass} value={draft.city} onChange={event => updateDraft('city', event.target.value)} maxLength={100} />
              </div>
              <div>
                <label className={labelClass}>Region</label>
                <input className={fieldClass} value={draft.region} onChange={event => updateDraft('region', event.target.value)} maxLength={100} />
              </div>
              <div>
                <label className={labelClass}>District</label>
                <input className={fieldClass} value={draft.district} onChange={event => updateDraft('district', event.target.value)} maxLength={100} />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input className={fieldClass} value={draft.country} onChange={event => updateDraft('country', event.target.value)} maxLength={100} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input className={fieldClass} value={draft.phone} onChange={event => updateDraft('phone', event.target.value)} maxLength={40} inputMode="tel" />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input className={fieldClass} value={draft.email} onChange={event => updateDraft('email', event.target.value)} maxLength={254} type="email" />
              </div>
              <div>
                <label className={labelClass}>Opening date</label>
                <input className={fieldClass} value={draft.openingDate} onChange={event => updateDraft('openingDate', event.target.value)} type="date" />
              </div>
              <div>
                <label className={labelClass}>Initial status</label>
                <div className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Active
                </div>
              </div>
              {!basicInfoIsValid && draft.branchName && (
                <p className="text-xs font-bold text-rose-600 md:col-span-2">Enter a valid branch name and email address.</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h4 className="text-lg font-black text-slate-950 dark:text-white">What type of branch are you creating?</h4>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This relationship controls which sharing options may be configured later.</p>
              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5">
                {([
                  {
                    value: 'same_business' as const,
                    title: 'Same Business',
                    body: 'Sells the same or related products. Catalogue, pricing or warehouse sharing may be configured after creation.',
                  },
                  {
                    value: 'independent_business' as const,
                    title: 'Different Independent Business',
                    body: 'Operates independently. Products, stock, warehouse, branding and accounts remain separate.',
                  },
                ]).map(option => {
                  const selected = draft.relationshipType === option.value;
                  return (
                    <button key={option.value} type="button" onClick={() => updateDraft('relationshipType', option.value)} className={`min-h-40 rounded-2xl border p-4 text-left transition md:min-h-52 md:p-5 ${selected ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-500/10 dark:bg-emerald-950/25' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}`}>
                      <span className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {option.value === 'same_business' ? <Building2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                      </span>
                      <span className="block text-base font-black text-slate-950 dark:text-white">{option.title}</span>
                      <span className="mt-2 block text-sm leading-6 text-slate-600 dark:text-slate-400">{option.body}</span>
                      <span className={`mt-5 inline-flex h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="font-semibold leading-6">Creating this branch does not copy products, stock, balances, staff or historical transactions. Those configurations remain separate and auditable.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700 sm:grid-cols-2">
                {[
                  ['Branch', draft.branchName],
                  ['Code', draft.branchCode || 'Generated by server'],
                  ['Business name', draft.businessName || draft.branchName],
                  ['Relationship', draft.relationshipType === 'same_business' ? 'Same Business' : 'Different Independent Business'],
                  ['Location', [draft.city, draft.region, draft.country].filter(Boolean).join(', ') || 'Not set'],
                  ['Opening date', draft.openingDate || 'Not set'],
                  ['Initial status', 'Active'],
                  ['Data migration', 'No historical records changed'],
                ].map(([label, value]) => (
                  <div key={label} className="min-h-24 bg-white p-4 dark:bg-slate-950">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                    <span className="mt-2 block text-sm font-black leading-5 text-slate-900 dark:text-white">{value}</span>
                  </div>
                ))}
              </div>
              {submitError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {submitError}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-slate-200 bg-slate-50/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:static md:px-6 md:py-4">
          <button type="button" onClick={step === 1 ? onClose : () => setStep(current => current - 1)} disabled={isSubmitting} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" /> {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep(current => current + 1)} disabled={step === 1 && !basicInfoIsValid} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => void submitBranch()} disabled={isSubmitting} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isSubmitting ? 'Creating branch...' : 'Confirm & create branch'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BranchDetailsDialog({ branch, onClose }: { branch: BranchSummary; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[84] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm md:items-center md:p-5" role="dialog" aria-modal="true" aria-labelledby="branch-details-title">
      <div className="w-full max-w-lg overflow-hidden rounded-t-[24px] border border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:border-slate-700 dark:bg-slate-950 md:rounded-[22px] md:pb-0">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 md:hidden" />
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 id="branch-details-title" className="text-lg font-black text-slate-950 dark:text-white">{branch.branchName}</h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{branch.branchCode}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 dark:border-slate-700" aria-label="Close branch details"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-200 dark:bg-slate-700">
          {[
            ['Business name', branch.businessName],
            ['Location', branchLocation(branch)],
            ['Relationship', relationshipLabel(branch)],
            ['Status', branch.status],
            ['Setup', branch.setupStatus || (branch.isPhysical ? 'Not set' : 'Compatibility Primary')],
            ['Write access', branch.canWrite ? 'Available' : 'Read only'],
          ].map(([label, value]) => (
            <div key={label} className="min-h-24 bg-white p-4 dark:bg-slate-950">
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
              <span className="mt-2 block text-sm font-black capitalize text-slate-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs font-semibold leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
          {branch.includesUnassignedHistoricalRecords
            ? 'Existing unassigned business records continue to resolve through this Primary Branch. No historical record has been rewritten.'
            : 'This view shows database-backed branch identity only.'}
        </div>
      </div>
    </div>
  );
}

function BranchActionsSheet({
  branch,
  onClose,
  onViewDetails,
}: {
  branch: BranchSummary;
  onClose: () => void;
  onViewDetails: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[83] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm md:hidden" role="dialog" aria-modal="true" aria-labelledby="branch-actions-title">
      <div className="w-full rounded-t-[26px] border border-slate-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="mx-auto h-1 w-11 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="flex items-center justify-between py-4">
          <div className="min-w-0">
            <h3 id="branch-actions-title" className="truncate text-base font-black text-slate-950 dark:text-white">{branch.branchName}</h3>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{branch.businessName || branch.branchName}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300" aria-label="Close branch actions"><X className="h-5 w-5" /></button>
        </div>
        <button type="button" onClick={onViewDetails} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 text-left text-sm font-black text-slate-900 active:scale-[0.99] dark:bg-slate-900 dark:text-white">
          <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          View branch details
          <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
        </button>
        <p className="px-2 pt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Operational actions will appear only when their audited backend workflows are available.</p>
      </div>
    </div>
  );
}

function BranchSettingsContent({ activeTenant, onTriggerUpgrade }: DashboardBranchesSettingsProps) {
  const { snapshot, isLoading, error, refresh, activatePrimary } = useBranchContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchSummary | null>(null);
  const [actionSheetBranch, setActionSheetBranch] = useState<BranchSummary | null>(null);
  const [tabletSelectedBranchId, setTabletSelectedBranchId] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  const entitlement = snapshot?.entitlement;
  const directory = snapshot?.directory;
  const packageId = String(entitlement?.packageId || activeTenant.activePackageId || activeTenant.selectedPackageId || '').toLowerCase();
  const isTanzanite = packageId === 'tanzanite';
  const subscriptionCurrent = entitlement?.subscriptionCurrent === true;
  const canManageBranches = entitlement?.canManageBranches === true;
  const branches = directory?.branches || [];
  const currentUsage = directory?.usesCompatibilityPrimary ? 1 : (directory?.physicalBranchCount || 0);
  const effectiveLimit = entitlement?.effectiveTotalBranches || (isTanzanite ? 2 : 1);
  const capacityReached = currentUsage >= effectiveLimit;
  const mutationRolloutReady = snapshot?.serverRolloutEnabled === true;
  const canOperateAdditional = mutationRolloutReady && entitlement?.canOperateAdditionalBranches === true;
  const canOpenWizard = canManageBranches && canOperateAdditional && !capacityReached && !directory?.usesCompatibilityPrimary;
  const branchActionLabel = !isTanzanite
    ? 'Tanzanite only'
    : !subscriptionCurrent
      ? 'Renew Tanzanite'
      : !canManageBranches
        ? 'Admin permission required'
        : capacityReached
          ? 'Capacity full'
          : mutationRolloutReady
            ? 'Add Branch'
            : 'Rollout pending';
  const eligibilityTitle = !subscriptionCurrent
    ? 'Tanzanite subscription expired'
    : !canManageBranches
      ? 'Branch management requires administrator permission'
      : mutationRolloutReady
        ? `Tanzanite includes ${entitlement?.defaultTotalBranches || 2} total branches`
        : 'Branch workspace prepared for controlled rollout';
  const eligibilityDetail = !subscriptionCurrent
    ? 'Existing branch records remain preserved. Renew Tanzanite to restore Branch actions.'
    : !canManageBranches
      ? 'You can use authorized branches, but only a tenant administrator can add or activate branches.'
      : mutationRolloutReady
        ? 'Contact support for additional capacity.'
        : 'Creation remains closed until the server rollout is enabled.';

  const filteredBranches = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return branches;
    return branches.filter(branch => [
      branch.branchName,
      branch.branchCode,
      branch.businessName,
      branch.city,
      branch.region,
      branch.country,
    ].some(value => String(value || '').toLowerCase().includes(needle)));
  }, [branches, searchTerm]);

  const tabletSelectedBranch = filteredBranches.find(branch => (branch.id || 'compatibility-primary') === tabletSelectedBranchId)
    || filteredBranches[0]
    || null;

  const activateCompatibilityPrimary = async () => {
    setIsActivating(true);
    setActivationError(null);
    try {
      await activatePrimary();
    } catch (nextError) {
      setActivationError(nextError instanceof Error ? nextError.message : 'Primary Branch could not be activated.');
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading && !snapshot) {
    return (
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950" aria-label="Loading branches">
        <div className="animate-pulse space-y-6 p-6">
          <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-12 w-full rounded-xl bg-slate-100 dark:bg-slate-900" />
          <div className="space-y-px overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            {[0, 1, 2].map(item => <div key={item} className="h-20 bg-slate-50 dark:bg-slate-900/70" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="rounded-[22px] border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900 dark:bg-slate-950">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><AlertCircle className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-950 dark:text-white">Branch workspace could not be loaded</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">{error.message}</p>
            <button type="button" onClick={() => void refresh()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"><RefreshCw className="h-4 w-4" /> Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="min-w-0 bg-white pb-[calc(env(safe-area-inset-bottom)+10.5rem)] dark:bg-slate-950 md:hidden" aria-label="Mobile branches">
        <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">
          {!isTanzanite ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300" />
                <p className="text-[13px] font-semibold leading-5 text-slate-700 dark:text-slate-300">Branches are available only on the Tanzanite Package. Upgrade to create and manage multiple branches.</p>
              </div>
              <button type="button" onClick={() => onTriggerUpgrade?.('stores')} className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white">View Tanzanite</button>
            </div>
          ) : (
            <div className={`flex min-h-[64px] items-center gap-3 rounded-2xl border px-3.5 py-3 ${mutationRolloutReady ? 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300"><Building2 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black leading-5 text-slate-900 dark:text-white">{eligibilityTitle}</p>
                <p className="mt-0.5 text-[10.5px] font-medium text-slate-500 dark:text-slate-400">{eligibilityDetail}</p>
              </div>
              <span className={`shrink-0 text-[13px] font-black ${capacityReached ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{currentUsage} of {effectiveLimit}</span>
            </div>
          )}

          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Search branches" />
          </label>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredBranches.length ? filteredBranches.map(branch => (
            <article key={branch.id || 'compatibility-primary'} className={`flex min-h-[154px] gap-3 px-3 py-4 ${branch.isLocked ? 'bg-slate-50/80 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-950'}`}>
              <span className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${branch.isLocked ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800' : 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'}`}><Building2 className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-[14px] font-black leading-5 text-slate-950 dark:text-white">{branch.businessName || branch.branchName}</h3>
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <span className="truncate text-[12px] font-semibold text-slate-600 dark:text-slate-300">{branch.branchName}</span>
                      {branch.isDefault ? <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Primary</span> : null}
                    </div>
                  </div>
                  <button type="button" onClick={() => setActionSheetBranch(branch)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95 dark:bg-slate-900 dark:text-slate-300" aria-label={`Open ${branch.branchName} actions`}><MoreHorizontal className="h-5 w-5" /></button>
                </div>
                <p className="mt-2 flex items-center gap-1.5 truncate text-[12px] font-medium text-slate-500 dark:text-slate-400"><MapPin className="h-4 w-4 shrink-0" />{branchLocation(branch)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-bold">
                  <span className={`inline-flex items-center gap-1.5 ${branch.status === 'active' && !branch.isLocked ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${branch.status === 'active' && !branch.isLocked ? 'bg-emerald-500' : 'bg-slate-400'}`} />{branch.isLocked ? 'Read only' : branch.status}</span>
                  <span className="text-slate-600 dark:text-slate-300">{relationshipLabel(branch)}</span>
                  <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{branch.isPhysical ? (branch.setupStatus || 'Not set') : 'Compatible'}</span>
                </div>
              </div>
            </article>
          )) : (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
              <Search className="h-7 w-7 text-slate-300 dark:text-slate-700" />
              <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-300">No branch matches this search.</p>
              <button type="button" onClick={() => setSearchTerm('')} className="mt-2 min-h-11 px-4 text-xs font-black text-emerald-700 dark:text-emerald-400">Clear search</button>
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-20 border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <p className="mb-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400">{branches.length} {branches.length === 1 ? 'branch' : 'branches'}</p>
          {directory?.usesCompatibilityPrimary && canOperateAdditional ? (
            <button type="button" onClick={() => void activateCompatibilityPrimary()} disabled={isActivating} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-60">
              {isActivating ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}{isActivating ? 'Activating...' : 'Activate Branches'}
            </button>
          ) : (
            <button type="button" onClick={() => setShowWizard(true)} disabled={!canOpenWizard} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm disabled:bg-amber-50 disabled:text-amber-700 disabled:shadow-none dark:disabled:bg-amber-950/30 dark:disabled:text-amber-300">
              {canOpenWizard ? <Plus className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}{branchActionLabel}
            </button>
          )}
          {activationError ? <p className="mt-2 text-center text-xs font-bold text-rose-600 dark:text-rose-400">{activationError}</p> : null}
        </div>
      </section>

      <section className="hidden overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 md:block xl:hidden" aria-label="Tablet branches">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          {!isTanzanite ? (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex min-w-0 items-center gap-3"><LockKeyhole className="h-5 w-5 shrink-0 text-slate-500" /><p className="text-xs font-semibold leading-5 text-slate-700 dark:text-slate-300">Branches are available only on the Tanzanite Package. Upgrade to create and manage multiple branches.</p></div>
              <button type="button" onClick={() => onTriggerUpgrade?.('stores')} className="min-h-11 shrink-0 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white">View Tanzanite</button>
            </div>
          ) : !subscriptionCurrent || !canManageBranches ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div><p className="font-black">{eligibilityTitle}</p><p className="mt-0.5">{eligibilityDetail}</p></div>
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">Branches</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{currentUsage} of {effectiveLimit} used · {branches.length} visible</p>
            </div>
            {directory?.usesCompatibilityPrimary && canOperateAdditional ? (
              <button type="button" onClick={() => void activateCompatibilityPrimary()} disabled={isActivating} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-60"><ShieldCheck className="h-4 w-4" />Activate Branches</button>
            ) : (
              <button type="button" onClick={() => setShowWizard(true)} disabled={!canOpenWizard} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">{canOpenWizard ? <Plus className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}{branchActionLabel}</button>
            )}
          </div>
          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Search branches" />
          </label>
        </div>

        <div className="grid min-h-[460px] grid-cols-1 lg:grid-cols-[minmax(260px,.9fr)_minmax(0,1.1fr)]">
          <div className="border-b border-slate-200 dark:border-slate-800 lg:border-b-0 lg:border-r">
            {filteredBranches.length ? filteredBranches.map(branch => {
              const branchKey = branch.id || 'compatibility-primary';
              const isSelected = tabletSelectedBranch === branch;
              return (
                <button key={branchKey} type="button" onClick={() => setTabletSelectedBranchId(branchKey)} className={`flex min-h-[118px] w-full items-start gap-3 border-b border-slate-100 p-4 text-left transition dark:border-slate-800 ${isSelected ? 'border-l-2 border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300'}`}><Building2 className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-2 text-[13px] font-black leading-5 text-slate-950 dark:text-white">{branch.businessName || branch.branchName}</span>
                    <span className="mt-1 block truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{branch.branchName}</span>
                    <span className="mt-1.5 flex items-center gap-1 truncate text-[10.5px] font-medium text-slate-500 dark:text-slate-400"><MapPin className="h-3.5 w-3.5" />{branchLocation(branch)}</span>
                    <span className="mt-2 inline-flex items-center gap-1.5 text-[10.5px] font-black text-emerald-700 dark:text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />{branch.isLocked ? 'Read only' : branch.status}</span>
                  </span>
                </button>
              );
            }) : <p className="p-6 text-center text-xs font-bold text-slate-500">No branch matches this search.</p>}
          </div>

          <div className="min-w-0 bg-slate-50/40 dark:bg-slate-900/20">
            {tabletSelectedBranch ? (
              <div>
                <div className="flex items-center gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Building2 className="h-7 w-7" /></span>
                  <div className="min-w-0 flex-1"><h4 className="line-clamp-2 text-base font-black text-slate-950 dark:text-white">{tabletSelectedBranch.businessName || tabletSelectedBranch.branchName}</h4><p className="mt-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">{tabletSelectedBranch.isLocked ? 'Read only' : tabletSelectedBranch.status}</p></div>
                  <button type="button" onClick={() => setSelectedBranch(tabletSelectedBranch)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300" aria-label={`View ${tabletSelectedBranch.branchName} details`}><MoreHorizontal className="h-5 w-5" /></button>
                </div>
                <dl className="divide-y divide-slate-200 dark:divide-slate-800">
                  {[
                    ['Business name', tabletSelectedBranch.businessName || tabletSelectedBranch.branchName],
                    ['Location', branchLocation(tabletSelectedBranch)],
                    ['Relationship', relationshipLabel(tabletSelectedBranch)],
                    ['Status', tabletSelectedBranch.isLocked ? 'Read only' : tabletSelectedBranch.status],
                    ['Setup', tabletSelectedBranch.isPhysical ? (tabletSelectedBranch.setupStatus || 'Not set') : 'Compatibility Primary'],
                    ['Write access', tabletSelectedBranch.canWrite ? 'Available' : 'Read only'],
                  ].map(([label, value]) => <div key={label} className="flex min-h-14 items-center justify-between gap-4 px-5 py-3"><dt className="text-xs font-black text-slate-800 dark:text-slate-200">{label}</dt><dd className="text-right text-xs font-semibold capitalize text-slate-500 dark:text-slate-400">{value}</dd></div>)}
                </dl>
                <p className="border-t border-slate-200 p-5 text-xs font-medium leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">{tabletSelectedBranch.includesUnassignedHistoricalRecords ? 'Unassigned historical records continue to resolve through this Primary Branch. No record was rewritten.' : 'Database-backed branch identity only.'}</p>
              </div>
            ) : <div className="flex min-h-[360px] items-center justify-center p-8 text-center text-xs font-semibold text-slate-500">Select a branch to view its details.</div>}
          </div>
        </div>
      </section>

      <div className="hidden overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 xl:block">
      <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        {!isTanzanite ? (
          <div className="mb-6 flex items-center justify-between gap-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex min-w-0 items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300" />
              <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-300">Branches are available only on the Tanzanite Package. Upgrade to create and manage multiple branches.</p>
            </div>
            <button type="button" onClick={() => onTriggerUpgrade?.('stores')} className="min-h-11 shrink-0 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800">View Tanzanite</button>
          </div>
        ) : !subscriptionCurrent || !canManageBranches ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="text-sm font-black">{eligibilityTitle}</p><p className="mt-0.5 text-sm font-semibold leading-6">{eligibilityDetail}</p></div>
          </div>
        ) : !mutationRolloutReady ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold leading-6">Your branch workspace is safely prepared. New branch activation remains closed until the controlled rollout is enabled.</p>
          </div>
        ) : (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold leading-6">Tanzanite includes {entitlement?.defaultTotalBranches || 2} total branches by default. Contact support when you need additional branch capacity.</p>
          </div>
        )}

        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <h3 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Branches</h3>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Manage independent business branches inside this tenant.</p>
          </div>
          <div className="flex shrink-0 items-stretch divide-x divide-slate-200 dark:divide-slate-700">
            <div className="pr-6">
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Branch capacity</span>
              <span className={`mt-2 block text-lg font-black ${capacityReached ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{currentUsage} of {effectiveLimit} used</span>
            </div>
            <div className="pl-6">
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Visible branches</span>
              <span className="mt-2 block text-lg font-black text-slate-950 dark:text-white">{branches.length}</span>
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between gap-4">
          <label className="relative block w-full max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Search branches by name or location..." />
          </label>
          <div className="flex shrink-0 items-center gap-2">
            {directory?.usesCompatibilityPrimary && canOperateAdditional ? (
              <button type="button" onClick={() => void activateCompatibilityPrimary()} disabled={isActivating} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                {isActivating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {isActivating ? 'Activating...' : 'Activate Branches'}
              </button>
            ) : (
              <button type="button" onClick={() => setShowWizard(true)} disabled={!canOpenWizard} title={!isTanzanite ? 'Upgrade to Tanzanite to create and manage multiple branches.' : !subscriptionCurrent ? 'Renew Tanzanite to manage branches.' : !canManageBranches ? 'Only a tenant administrator may manage branches.' : capacityReached ? 'Branch capacity is full.' : !canOperateAdditional ? 'Branch creation is not enabled.' : undefined} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm shadow-emerald-600/15 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
                {canOpenWizard ? <Plus className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                {branchActionLabel}
              </button>
            )}
          </div>
        </div>
        {activationError && <p className="mt-3 text-sm font-bold text-rose-600 dark:text-rose-400">{activationError}</p>}
      </div>

      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,.8fr)_minmax(0,.9fr)_44px] items-center gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-3 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <span>Business name</span><span>Location</span><span>Relationship</span><span>Status</span><span>Setup</span><span className="sr-only">Actions</span>
        </div>
        {filteredBranches.length ? filteredBranches.map(branch => (
          <div key={branch.id || 'compatibility-primary'} className={`grid min-h-[92px] grid-cols-[minmax(0,2.2fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,.8fr)_minmax(0,.9fr)_44px] items-center gap-4 border-b border-slate-100 px-6 py-4 last:border-b-0 dark:border-slate-800 ${branch.isLocked ? 'bg-slate-50 text-slate-500 dark:bg-slate-900/50' : 'hover:bg-slate-50/70 dark:hover:bg-slate-900/35'}`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${branch.isLocked ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'}`}><Building2 className="h-5 w-5" /></span>
              <div className="min-w-0">
                <span className="block truncate text-sm font-black text-slate-950 dark:text-white">{branch.businessName || branch.branchName}</span>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{branch.branchName}</span>
                  {branch.isDefault ? <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Primary</span> : null}
                  {branch.isLocked ? <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
                </div>
              </div>
            </div>
            <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300" title={branchLocation(branch)}><MapPin className="mr-1 inline h-3.5 w-3.5 text-slate-400" />{branchLocation(branch)}</span>
            <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{relationshipLabel(branch)}</span>
            <span className={`inline-flex items-center gap-2 text-xs font-black capitalize ${branch.status === 'active' && !branch.isLocked ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}><span className={`h-2 w-2 rounded-full ${branch.status === 'active' && !branch.isLocked ? 'bg-emerald-500' : 'bg-slate-400'}`} />{branch.isLocked ? 'Read only' : branch.status}</span>
            <span className="inline-flex items-center gap-2 truncate text-xs font-bold text-slate-600 dark:text-slate-300">{branch.setupStatus === 'complete' || !branch.isPhysical ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Info className="h-4 w-4 shrink-0 text-amber-500" />}{branch.isPhysical ? (branch.setupStatus || 'Not set') : 'Compatible'}</span>
            <button type="button" onClick={() => setSelectedBranch(branch)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={`View ${branch.branchName} details`}><MoreHorizontal className="h-5 w-5" /></button>
          </div>
        )) : (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
            <Search className="h-7 w-7 text-slate-300 dark:text-slate-700" />
            <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-300">No branch matches this search.</p>
            <button type="button" onClick={() => setSearchTerm('')} className="mt-2 text-xs font-black text-emerald-700 hover:underline dark:text-emerald-400">Clear search</button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-6 py-3 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        <span>Showing {filteredBranches.length} of {branches.length} {branches.length === 1 ? 'branch' : 'branches'}</span>
        <span>{directory?.usesCompatibilityPrimary ? 'Compatibility Primary · no historical data changed' : 'Database-backed branch directory'}</span>
      </div>

      </div>

      {showWizard ? <BranchCreationWizard activeTenant={activeTenant} onClose={() => setShowWizard(false)} /> : null}
      {actionSheetBranch ? <BranchActionsSheet branch={actionSheetBranch} onClose={() => setActionSheetBranch(null)} onViewDetails={() => { setSelectedBranch(actionSheetBranch); setActionSheetBranch(null); }} /> : null}
      {selectedBranch ? <BranchDetailsDialog branch={selectedBranch} onClose={() => setSelectedBranch(null)} /> : null}
    </>
  );
}

export default function DashboardBranchesSettings(props: DashboardBranchesSettingsProps) {
  return <BranchSettingsContent {...props} />;
}
