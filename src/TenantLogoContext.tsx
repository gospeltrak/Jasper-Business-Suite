import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { loadTenantWorkspaceCore } from './utils/tenantWorkspace';

interface TenantLogoContextType {
  logoUrl: string | null;
  businessName: string | null;
  setLogoUrl: (url: string | null) => void;
  fetchLogoUrl: (tenantId: string) => Promise<string | null>;
  getFallbackInitials: (name: string) => string;
}

const TenantLogoContext = createContext<TenantLogoContextType | undefined>(undefined);
const logoRequests = new Map<string, Promise<{ logoUrl: string | null; businessName: string | null }>>();
const logoCache = new Map<string, { logoUrl: string | null; businessName: string | null; cachedAt: number }>();
const LOGO_CACHE_MS = 5 * 60 * 1000;

export function TenantLogoProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoState] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);

  const setLogoUrl = useCallback((url: string | null) => {
    setLogoState(url);
  }, []);

  const getFallbackInitials = useCallback((name: string): string => {
    if (!name) return 'JA';
    const cleanName = name.trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
  }, []);

  const fetchLogoUrl = useCallback(async (tenantId: string): Promise<string | null> => {
    if (!tenantId) return null;

    const cached = logoCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < LOGO_CACHE_MS) {
      setBusinessName(cached.businessName);
      setLogoState(cached.logoUrl);
      return cached.logoUrl;
    }

    try {
      let request = logoRequests.get(tenantId);
      if (!request) request = (async () => {
      // Business branding comes directly from the tenant's online workspace.
      // Do not use company name, tenant name, admin name or local browser storage.
      // Reuses loadTenantWorkspaceCore's fast, deduped request -- Dashboard's
      // own initial load calls the same function for the same tenant, so this
      // shares that request instead of racing it with a separate, slower
      // query. Previously that separate query meant the tenant's real logo
      // often hadn't arrived yet by the time the loading screen (which reads
      // this fetch's result) was replaced by the dashboard, leaving the
      // generic Orvix fallback icon showing instead.
      const core = await loadTenantWorkspaceCore(tenantId);
      const business = core?.settings?.business;
      const cloudBusinessName = String(business?.businessName || '').trim();
      const cloudBusinessLogo = business?.businessLogoLight || business?.businessLogoDark || business?.businessLogo || null;
      if (cloudBusinessLogo) {
        return { logoUrl: cloudBusinessLogo, businessName: cloudBusinessName || null };
      }

      const response = await fetch(`/api/tenant/logo-by-id?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'default' });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        return { logoUrl: null, businessName: cloudBusinessName || null };
      }
      const data = await response.json();
      return { logoUrl: data?.logoUrl || null, businessName: String(data?.businessName || cloudBusinessName || '').trim() || null };
      })().finally(() => logoRequests.delete(tenantId));
      logoRequests.set(tenantId, request);
      const result = await request;
      logoCache.set(tenantId, { ...result, cachedAt: Date.now() });
      setBusinessName(result.businessName);
      setLogoState(result.logoUrl);
      return result.logoUrl;
    } catch (err: any) {
      // Keep the default initials/icon when the deployment has no logo API available.
    }
    
    setLogoState(null);
    return null;
  }, []);

  return (
    <TenantLogoContext.Provider value={{ logoUrl, businessName, setLogoUrl, fetchLogoUrl, getFallbackInitials }}>
      {children}
    </TenantLogoContext.Provider>
  );
}

export function useTenantLogo() {
  const context = useContext(TenantLogoContext);
  if (context === undefined) {
    throw new Error('useTenantLogo must be used within a TenantLogoProvider');
  }
  return context;
}
