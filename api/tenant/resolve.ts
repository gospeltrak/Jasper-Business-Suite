import {
  cleanTenantSlug,
  getBaseDomain,
  getSupabaseAdmin,
  isSafeHostFormat,
  isTenantSlugValid,
  mapTenantDomainRecord,
  normalizeHost,
  tenantDomainSelect
} from './_domainUtils.js';

const PORTAL_NAMES = ['app', 'auth', 'admin', 'affiliate', 'partner'] as const;
const OVERRIDABLE_KINDS = new Set(['app', 'auth', 'admin', 'affiliate', 'partner', 'landing']);

async function resolveTenantSubdomain(res: any, subdomain: string, host: string, baseDomain: string) {
  if (!isTenantSlugValid(subdomain) || !isSafeHostFormat(host)) {
    return res.status(200).json({ kind: 'tenant-not-found', host, baseDomain, subdomain, message: 'Tenant not found.' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(200).json({ kind: 'app', host, baseDomain, warning: 'Tenant domain resolver is not configured.' });
  }

  try {
    const safeSlug = cleanTenantSlug(subdomain);
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select(tenantDomainSelect)
      .or(`subdomain_slug.eq.${safeSlug},primary_domain.eq.${host},custom_domain.eq.${host}`)
      .maybeSingle();
    if (error) throw error;
    if (!tenant) {
      return res.status(200).json({ kind: 'tenant-not-found', host, baseDomain, subdomain, message: 'Tenant not found.' });
    }
    const mappedTenant = mapTenantDomainRecord(tenant);
    if (mappedTenant?.isDomainActive === false) {
      return res.status(200).json({ kind: 'tenant-inactive', host, baseDomain, subdomain, tenant: mappedTenant, message: 'This business domain is not active.' });
    }
    return res.status(200).json({ kind: 'tenant', host, baseDomain, subdomain, tenant: mappedTenant });
  } catch (error: any) {
    console.warn('[Tenant Resolve] Falling back to app mode:', error?.message || error);
    return res.status(200).json({ kind: 'app', host, baseDomain, warning: 'Tenant domain resolver is not fully configured yet.' });
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const host = normalizeHost(req.query?.host || req.headers['x-forwarded-host'] || req.headers.host);
  const baseDomain = getBaseDomain();
  const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
  const isBareLocalHost = !host || localHosts.has(host);
  const isLocalSubdomain = host.endsWith('.localhost');
  const isPreviewHost = host.endsWith('.vercel.app');

  // Developer-only escape hatch: on localhost or a Vercel preview URL (never on the
  // real production domain) a `?portal=` query param lets you simulate any portal
  // kind without needing real wildcard DNS. Ignored anywhere else.
  if (isBareLocalHost || isPreviewHost) {
    const portalOverride = String(req.query?.portal || '').toLowerCase().trim();
    if (OVERRIDABLE_KINDS.has(portalOverride)) {
      return res.status(200).json({ kind: portalOverride, host, baseDomain, preview: true });
    }
  }

  if (isBareLocalHost) {
    return res.status(200).json({ kind: 'app', host, baseDomain });
  }

  if (host === baseDomain || host === `www.${baseDomain}`) {
    return res.status(200).json({ kind: 'landing', host, baseDomain });
  }

  const portalSuffix = isLocalSubdomain ? '.localhost' : `.${baseDomain}`;
  for (const name of PORTAL_NAMES) {
    if (host === `${name}${portalSuffix}`) {
      return res.status(200).json({ kind: name, host, baseDomain });
    }
  }

  if (isLocalSubdomain) {
    // Any other {slug}.localhost simulates a real tenant wildcard subdomain for local testing.
    const subdomain = host.slice(0, -'.localhost'.length);
    return resolveTenantSubdomain(res, subdomain, host, baseDomain);
  }

  if (isPreviewHost) {
    // Vercel preview deployments are single-origin; without ?portal= they behave as plain app mode.
    return res.status(200).json({ kind: 'app', host, baseDomain });
  }

  const subdomain = host.endsWith(`.${baseDomain}`) ? host.slice(0, -(baseDomain.length + 1)) : '';
  if (!subdomain && !host.endsWith(`.${baseDomain}`)) {
    return res.status(200).json({ kind: 'app', host, baseDomain });
  }
  return resolveTenantSubdomain(res, subdomain, host, baseDomain);
}
