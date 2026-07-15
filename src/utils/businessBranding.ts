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
