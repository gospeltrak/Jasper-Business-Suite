import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { loadTenantWorkspaceCore } from '../utils/tenantWorkspace';

interface TenantLogoContextType {
  /** The light-theme logo, falling back to whichever variant the tenant has set. */
  logoUrlLight: string | null;
  /** The dark-theme logo, falling back to whichever variant the tenant has set. */
  logoUrlDark: string | null;
  businessName: string | null;
  /** Resolves the right variant for the given theme in one call. */
  getLogoUrl: (isDark: boolean) => string | null;
  setLogoUrls: (urls: { light?: string | null; dark?: string | null }) => void;
  fetchLogoUrl: (tenantId: string) => Promise<{ light: string | null; dark: string | null }>;
  getFallbackInitials: (name: string) => string;
}

const TenantLogoContext = createContext<TenantLogoContextType | undefined>(undefined);
const logoRequests = new Map<string, Promise<{ light: string | null; dark: string | null; businessName: string | null }>>();
const logoCache = new Map<string, { light: string | null; dark: string | null; businessName: string | null; cachedAt: number }>();
const LOGO_CACHE_MS = 5 * 60 * 1000;

export function TenantLogoProvider({ children }: { children: ReactNode }) {
  const [logoUrlLight, setLogoUrlLight] = useState<string | null>(null);
  const [logoUrlDark, setLogoUrlDark] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);

  const getLogoUrl = useCallback((isDark: boolean): string | null => {
    return isDark ? (logoUrlDark || logoUrlLight) : (logoUrlLight || logoUrlDark);
  }, [logoUrlLight, logoUrlDark]);

  const setLogoUrls = useCallback((urls: { light?: string | null; dark?: string | null }) => {
    if (urls.light !== undefined) setLogoUrlLight(urls.light);
    if (urls.dark !== undefined) setLogoUrlDark(urls.dark);
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

  const fetchLogoUrl = useCallback(async (tenantId: string): Promise<{ light: string | null; dark: string | null }> => {
    if (!tenantId) return { light: null, dark: null };

    const cached = logoCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < LOGO_CACHE_MS) {
      setBusinessName(cached.businessName);
      setLogoUrlLight(cached.light);
      setLogoUrlDark(cached.dark);
      return { light: cached.light, dark: cached.dark };
    }

    try {
      let request = logoRequests.get(tenantId);
      if (!request) request = (async () => {
      // Business Settings is the single source of truth for the tenant's
      // logo (both light- and dark-theme variants) -- do not use company
      // name, tenant name, admin name, local browser storage, or any other
      // settings field. Reuses loadTenantWorkspaceCore's fast, deduped
      // request -- Dashboard's own initial load calls the same function for
      // the same tenant, so this shares that request instead of racing it
      // with a separate, slower query. Previously that separate query meant
      // the tenant's real logo often hadn't arrived yet by the time the
      // loading screen (which reads this fetch's result) was replaced by
      // the dashboard, leaving the generic Orvix fallback icon showing
      // instead.
      const core = await loadTenantWorkspaceCore(tenantId);
      const business = core?.settings?.business as any;
      const cloudBusinessName = String(business?.businessName || '').trim();
      // A tenant who has only ever set one variant should still see it in
      // both themes rather than a blank logo -- each falls back to
      // whichever other variant exists before falling back to the oldest
      // (pre-light/dark) `businessLogo` field.
      const light = business?.businessLogoLight || business?.businessLogo || business?.businessLogoDark || null;
      const dark = business?.businessLogoDark || business?.businessLogoLight || business?.businessLogo || null;
      return { light, dark, businessName: cloudBusinessName || null };
      })().finally(() => logoRequests.delete(tenantId));
      logoRequests.set(tenantId, request);
      const result = await request;
      logoCache.set(tenantId, { ...result, cachedAt: Date.now() });
      setBusinessName(result.businessName);
      setLogoUrlLight(result.light);
      setLogoUrlDark(result.dark);
      return { light: result.light, dark: result.dark };
    } catch (err: any) {
      // Keep the default initials/icon when the deployment has no logo API available.
    }

    setLogoUrlLight(null);
    setLogoUrlDark(null);
    return { light: null, dark: null };
  }, []);

  return (
    <TenantLogoContext.Provider value={{ logoUrlLight, logoUrlDark, businessName, getLogoUrl, setLogoUrls, fetchLogoUrl, getFallbackInitials }}>
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
