import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  activatePrimaryBranch,
  createBranch,
  loadBranchWorkspace,
  selectBranch,
  updateBranchLogo,
} from './branchApi';
import type {
  BranchWorkspaceSnapshot,
  CreateBranchInput,
  CreatedBranchResult,
  SelectableBranchScope,
} from './branchTypes';

interface BranchContextValue {
  snapshot: BranchWorkspaceSnapshot | null;
  isLoading: boolean;
  switchingBranch: boolean;
  switchingToBranchName: string | null;
  error: Error | null;
  refresh: () => Promise<void>;
  chooseBranch: (branchId: string | null, scope: SelectableBranchScope) => Promise<void>;
  activatePrimary: () => Promise<void>;
  addBranch: (input: CreateBranchInput) => Promise<CreatedBranchResult>;
  updateLogo: (
    branchId: string,
    logos: { logoLightUrl?: string | null; logoDarkUrl?: string | null },
  ) => Promise<void>;
}

const BranchContext = createContext<BranchContextValue | null>(null);
const branchSnapshotCache = new Map<string, BranchWorkspaceSnapshot>();

const publishBranchContext = (snapshot: BranchWorkspaceSnapshot | null) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('jasper_branch_context_changed', {
    detail: {
      activeBranchId: snapshot?.context.activeBranchId || null,
      businessName: snapshot?.context.selectedBranch?.businessName || '',
      branchName: snapshot?.context.selectedBranch?.branchName || '',
      activeScope: snapshot?.context.activeScope || 'no_branch_access',
      selectedBranch: snapshot?.context.selectedBranch || null,
      scope: snapshot?.context.activeScope || 'no_branch_access',
    },
  }));
};

export function BranchProvider({
  tenantKey,
  children,
}: {
  tenantKey: string;
  children: React.ReactNode;
}) {
  const cachedSnapshot = branchSnapshotCache.get(tenantKey) || null;
  const [snapshot, setSnapshot] = useState<BranchWorkspaceSnapshot | null>(cachedSnapshot);
  const [isLoading, setIsLoading] = useState(!cachedSnapshot);
  const [switchingBranch, setSwitchingBranch] = useState(false);
  const [switchingToBranchName, setSwitchingToBranchName] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);
  const refreshAbortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    if (!branchSnapshotCache.has(tenantKey)) setIsLoading(true);
    setError(null);
    try {
      const nextSnapshot = await loadBranchWorkspace(controller.signal);
      if (requestId === requestIdRef.current) {
        branchSnapshotCache.set(tenantKey, nextSnapshot);
        setSnapshot(nextSnapshot);
        publishBranchContext(nextSnapshot);
      }
    } catch (nextError) {
      if (requestId === requestIdRef.current) {
        setError(nextError instanceof Error ? nextError : new Error('Branch information could not be loaded.'));
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [tenantKey]);

  useEffect(() => {
    const cached = branchSnapshotCache.get(tenantKey) || null;
    setSnapshot(cached);
    if (cached) publishBranchContext(cached);
    void refresh();
    return () => {
      requestIdRef.current += 1;
      refreshAbortRef.current?.abort();
    };
  }, [tenantKey, refresh]);

  // A short-lived auth/network failure must not leave the tenant permanently
  // stuck in the implicit `no_branch_access` state. Keep the last valid
  // snapshot when one exists; otherwise retry until the authoritative branch
  // context is available.
  useEffect(() => {
    if (!error || snapshot || isLoading) return;
    const retryTimer = window.setTimeout(() => {
      void refresh();
    }, 2000);
    return () => window.clearTimeout(retryTimer);
  }, [error, snapshot, isLoading, refresh]);

  const chooseBranch = useCallback(async (
    branchId: string | null,
    scope: SelectableBranchScope,
  ) => {
    if (switchingBranch) return;
    if (
      snapshot?.context.activeBranchId === branchId
      && snapshot.context.activeScope === scope
    ) return;
    const target = snapshot?.directory.branches.find(branch => branch.id === branchId)
      || (scope === 'compatibility_primary' ? snapshot?.directory.branches[0] : null);
    const targetName = target?.branchName || (scope === 'all_branches' ? 'All Branches' : 'Branch');
    const previousSnapshot = snapshot;
    const optimisticContext = snapshot ? {
      ...snapshot.context,
      activeBranchId: branchId,
      activeScope: scope,
      selectedBranch: target || null,
      branches: snapshot.directory.branches.map(branch => ({
        ...branch,
        isSelected: branch.id === branchId,
      })),
    } : null;
    const optimisticSnapshot = snapshot && optimisticContext
      ? { ...snapshot, context: optimisticContext, directory: optimisticContext }
      : null;
    setSwitchingBranch(true);
    setSwitchingToBranchName(targetName);
    if (optimisticSnapshot) {
      setSnapshot(optimisticSnapshot);
      publishBranchContext(optimisticSnapshot);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jasper_branch_switch_started', {
        detail: { branchId, scope, branchName: targetName },
      }));
    }
    try {
      const context = await selectBranch(branchId, scope);
      const next = previousSnapshot ? { ...previousSnapshot, context, directory: context } : null;
      if (next) branchSnapshotCache.set(tenantKey, next);
      setSnapshot(next);
      publishBranchContext(next);
    } catch (nextError) {
      setSnapshot(previousSnapshot);
      publishBranchContext(previousSnapshot);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jasper_branch_switch_failed', {
          detail: { branchId, scope, branchName: targetName },
        }));
      }
      throw nextError;
    } finally {
      setSwitchingBranch(false);
      setSwitchingToBranchName(null);
    }
  }, [snapshot, switchingBranch, tenantKey]);

  const activatePrimary = useCallback(async () => {
    await activatePrimaryBranch();
    await refresh();
  }, [refresh]);

  const addBranch = useCallback(async (input: CreateBranchInput) => {
    const created = await createBranch(input);
    await refresh();
    return created;
  }, [refresh]);

  const updateLogo = useCallback(async (
    branchId: string,
    logos: { logoLightUrl?: string | null; logoDarkUrl?: string | null },
  ) => {
    await updateBranchLogo(branchId, logos);
    await refresh();
  }, [refresh]);

  const value = useMemo<BranchContextValue>(() => ({
    snapshot,
    isLoading,
    switchingBranch,
    switchingToBranchName,
    error,
    refresh,
    chooseBranch,
    activatePrimary,
    addBranch,
    updateLogo,
  }), [snapshot, isLoading, switchingBranch, switchingToBranchName, error, refresh, chooseBranch, activatePrimary, addBranch, updateLogo]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export const useBranchContext = () => {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranchContext must be used inside BranchProvider.');
  return context;
};

// Same as useBranchContext(), but returns null instead of throwing when
// rendered outside a BranchProvider (e.g. the SuperAdmin dashboard tree,
// which intentionally never mounts BranchProvider). Use this in call sites
// that may render for SuperAdmin; use useBranchContext() everywhere else.
export const useOptionalBranchContext = () => useContext(BranchContext);
