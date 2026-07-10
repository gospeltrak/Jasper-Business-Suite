import { createClient } from '@supabase/supabase-js';

export const DEFAULT_BASE_DOMAIN = 'ndiva.africa';
export const RESERVED_TENANT_SLUGS = new Set([
  'www', 'app', 'admin', 'superadmin', 'api', 'auth', 'login', 'signup', 'dashboard',
  'support', 'help', 'mail', 'static', 'assets', 'cdn', 'root'
]);

export const normalizeHost = (value: unknown) =>
  String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

export const getBaseDomain = () =>
  normalizeHost(process.env.APP_BASE_DOMAIN || process.env.NDIVA_BASE_DOMAIN || DEFAULT_BASE_DOMAIN) || DEFAULT_BASE_DOMAIN;

export const cleanTenantSlug = (value: unknown) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 63);

export const isTenantSlugValid = (value: unknown) => {
  const slug = cleanTenantSlug(value);
  return slug.length >= 2 && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) && !RESERVED_TENANT_SLUGS.has(slug);
};

export const tenantDomainSelect = [
  'id',
  'name',
  'country',
  'city',
  'currency',
  'currency_code',
  'tax_rate',
  'business_type',
  'company_settings',
  'business_settings',
  'invoice_settings',
  'selected_package_id',
  'active_package_id',
  'subscription_status',
  'subscription_start_date',
  'subscription_end_date',
  'business_name',
  'business_name_slug',
  'subdomain_slug',
  'custom_domain',
  'primary_domain',
  'domain_status',
  'is_domain_active'
].join(', ');

export const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

export const mapTenantDomainRecord = (tenant: any) => {
  if (!tenant) return null;
  return {
    id: tenant.id,
    name: tenant.name || tenant.business_name || 'Business',
    country: tenant.country,
    city: tenant.city,
    currency: tenant.currency,
    currencyCode: tenant.currency_code,
    taxRate: tenant.tax_rate,
    businessType: tenant.business_type,
    selectedPackageId: tenant.selected_package_id,
    activePackageId: tenant.active_package_id,
    subscriptionStatus: tenant.subscription_status,
    subscriptionStartDate: tenant.subscription_start_date,
    subscriptionEndDate: tenant.subscription_end_date,
    company_settings: tenant.company_settings || {},
    business_settings: tenant.business_settings || {},
    invoice_settings: tenant.invoice_settings || {},
    businessName: tenant.business_name || tenant.name,
    businessNameSlug: tenant.business_name_slug || tenant.subdomain_slug || null,
    subdomainSlug: tenant.subdomain_slug || null,
    customDomain: tenant.custom_domain || null,
    primaryDomain: tenant.primary_domain || (tenant.subdomain_slug ? `${tenant.subdomain_slug}.${getBaseDomain()}` : null),
    domainStatus: tenant.domain_status || 'active',
    isDomainActive: tenant.is_domain_active !== false
  };
};

export const getBearerToken = (req: any) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};
