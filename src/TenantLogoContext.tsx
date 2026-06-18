import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TenantLogoContextType {
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
  fetchLogoUrl: (tenantId: string) => Promise<string | null>;
  getFallbackInitials: (name: string) => string;
}

const TenantLogoContext = createContext<TenantLogoContextType | undefined>(undefined);

export function TenantLogoProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoState] = useState<string | null>(null);

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
    
    // First try localStorage
    const local = localStorage.getItem(`jasper_tenant_logo_${tenantId}`);
    if (local) {
      setLogoState(local);
      return local;
    }

    try {
      const response = await fetch(`/api/tenant/logo-by-id?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await response.json();
      if (data && data.logoUrl) {
        localStorage.setItem(`jasper_tenant_logo_${tenantId}`, data.logoUrl);
        setLogoState(data.logoUrl);
        return data.logoUrl;
      }
    } catch (err: any) {
      console.warn('[TenantLogoContext] Failed to fetch logo from server:', err?.message || err);
    }
    
    setLogoState(null);
    return null;
  };

  return (
    <TenantLogoContext.Provider value={{ logoUrl, setLogoUrl, fetchLogoUrl, getFallbackInitials }}>
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
