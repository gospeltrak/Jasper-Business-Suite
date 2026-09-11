import { SystemSettings, Tenant } from '../types';

const cleanName = (value: unknown) => String(value || '').trim();

const normalized = (value: unknown) => cleanName(value).toLocaleLowerCase();

export const getBusinessDisplayName = (
  tenant: Pick<Tenant, 'businessName' | 'name'>,
  settings?: Pick<SystemSettings, 'business' | 'company'> | null,
  userName?: string,
) => {
  // The registered business_name is the universal source of truth.
  // It is intentionally different from tenant.name, companyName and user.name.
  const registeredBusinessName = cleanName(tenant.businessName);
  if (registeredBusinessName) return registeredBusinessName;

  const configuredBusinessName = cleanName(settings?.business?.businessName);
  const user = cleanName(userName);
  const legacyOrWrongNames = new Set([
    normalized(settings?.company?.companyName),
    normalized(user),
    normalized(user ? `${user}'s Business` : ''),
  ].filter(Boolean));

  if (configuredBusinessName && !legacyOrWrongNames.has(normalized(configuredBusinessName))) {
    return configuredBusinessName;
  }

  return 'My Business';
};

// Canonical business logo resolver — same field priority as TenantLogoContext.tsx's
// cloud-fetched resolver (business.businessLogoLight || business.businessLogoDark ||
// business.businessLogo), so app chrome and generated documents never disagree.
// Deliberately Business Settings-only: does not fall back to company.logo or any
// Tenant/company_settings field, since those are not the Business Settings source.
export const getBusinessLogo = (
  settings?: Pick<SystemSettings, 'business'> | null,
): string => {
  const business = settings?.business as any;
  return business?.businessLogoLight || business?.businessLogoDark || business?.businessLogo || '';
};

type BrandableBranch = {
  isPhysical?: boolean;
  businessName?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

// Branch-aware variants of the two resolvers above — used by document
// generators (POS receipt, sales documents, reports, delivery notes) so a
// tenant operating multiple real branches gets each document branded with
// the active branch's own name/logo instead of always the tenant-wide one.
// `selectedBranch` comes from BranchContext's `snapshot.context.selectedBranch`;
// the compatibility/virtual Primary Branch (isPhysical: false) and any branch
// missing its own logo/name fall straight through to the tenant-wide value,
// so behavior is unchanged for tenants who haven't set up real Branches yet.
export const getActiveBranchDisplayName = (
  tenant: Pick<Tenant, 'businessName' | 'name'>,
  settings: Pick<SystemSettings, 'business' | 'company'> | null | undefined,
  userName: string | undefined,
  selectedBranch: BrandableBranch | null | undefined,
): string => {
  if (selectedBranch?.isPhysical) {
    const branchName = cleanName(selectedBranch.businessName);
    if (branchName) return branchName;
  }
  return getBusinessDisplayName(tenant, settings, userName);
};

export const getActiveBranchLogo = (
  settings: Pick<SystemSettings, 'business'> | null | undefined,
  selectedBranch: BrandableBranch | null | undefined,
): string => {
  if (selectedBranch?.isPhysical) {
    const branchLogo = selectedBranch.logoLightUrl || selectedBranch.logoDarkUrl;
    if (branchLogo) return branchLogo;
  }
  return getBusinessLogo(settings);
};

export const getActiveBranchAddress = (
  settings: Pick<SystemSettings, 'business' | 'company'> | null | undefined,
  selectedBranch: BrandableBranch | null | undefined,
): string => cleanName(selectedBranch?.isPhysical ? selectedBranch.address : '')
  || cleanName((settings?.business as any)?.businessAddress || (settings?.business as any)?.address)
  || cleanName((settings?.company as any)?.address);

export const getActiveBranchPhone = (
  settings: Pick<SystemSettings, 'business' | 'company'> | null | undefined,
  selectedBranch: BrandableBranch | null | undefined,
): string => cleanName(selectedBranch?.isPhysical ? selectedBranch.phone : '')
  || cleanName((settings?.business as any)?.businessPhone || (settings?.business as any)?.phone)
  || cleanName((settings?.company as any)?.phone);

export const getActiveBranchEmail = (
  settings: Pick<SystemSettings, 'business' | 'company'> | null | undefined,
  selectedBranch: BrandableBranch | null | undefined,
): string => cleanName(selectedBranch?.isPhysical ? selectedBranch.email : '')
  || cleanName((settings?.business as any)?.businessEmail || (settings?.business as any)?.email)
  || cleanName((settings?.company as any)?.email);
