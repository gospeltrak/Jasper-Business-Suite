import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSecureDataBridgeClient } from './secureDataBridge';

interface TenantLogoContextType {
  logoUrl: string | null;
  businessName: string | null;
  setLogoUrl: (url: string | null) => void;
  fetchLogoUrl: (tenantId: string) => Promise<string | null>;
  getFallbackInitials: (name: string) => string;
}

const TenantLogoContext = createContext<TenantLogoContextType | undefined>(undefined);

export function TenantLogoProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoState] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);

  const setLogoUrl = (url: string | null) => {
    setLogoState(url);
  };

  const getFallbackInitials = (name: string): string => {
    if (!name) return 'JA';
    const cleanName = name.trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
  };

  const fetchLogoUrl = async (tenantId: string): Promise<string | null> => {
    if (!tenantId) return null;

    try {
      // Business branding comes directly from the tenant's online workspace.
      // Do not use company name, tenant name, admin name or local browser storage.
      const client: any = await getSecureDataBridgeClient();
      const { data: workspace } = await client
        .from('tenant_workspaces')
        .select('payload')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const business = workspace?.payload?.settings?.business;
      const cloudBusinessName = String(business?.businessName || '').trim();
      const cloudBusinessLogo = business?.businessLogoLight || business?.businessLogoDark || business?.businessLogo || null;
      setBusinessName(cloudBusinessName || null);
      if (cloudBusinessLogo) {
        setLogoState(cloudBusinessLogo);
        return cloudBusinessLogo;
      }

      const response = await fetch(`/api/tenant/logo-by-id?tenantId=${encodeURIComponent(tenantId)}`);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        setLogoState(null);
        return null;
      }
      const data = await response.json();
      if (data?.businessName) setBusinessName(String(data.businessName).trim() || null);
      if (data && data.logoUrl) {
        setLogoState(data.logoUrl);
        return data.logoUrl;
      }
    } catch (err: any) {
      // Keep the default initials/icon when the deployment has no logo API available.
    }
    
    setLogoState(null);
    return null;
  };

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
