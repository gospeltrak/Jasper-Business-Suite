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
