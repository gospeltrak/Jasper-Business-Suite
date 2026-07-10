import {
  getBaseDomain,
  getSupabaseAdmin,
  isTenantSlugValid,
  mapTenantDomainRecord,
  normalizeHost,
  tenantDomainSelect
} from './_domainUtils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const host = normalizeHost(req.query?.host || req.headers['x-forwarded-host'] || req.headers.host);
  const baseDomain = getBaseDomain();
  const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

  if (!host || localHosts.has(host) || host.endsWith('.localhost')) {
    return res.status(200).json({ kind: 'app', host, baseDomain });
  }
  if (host === baseDomain || host === `www.${baseDomain}`) {
    return res.status(200).json({ kind: 'landing', host, baseDomain });
  }
  if (host === `app.${baseDomain}`) {
    return res.status(200).json({ kind: 'app', host, baseDomain });
  }

  const subdomain = host.endsWith(`.${baseDomain}`) ? host.slice(0, -(baseDomain.length + 1)) : '';
  if (!subdomain && !host.endsWith(`.${baseDomain}`)) {
    return res.status(200).json({ kind: 'app', host, baseDomain });
  }
  if (!isTenantSlugValid(subdomain)) {
    return res.status(200).json({ kind: 'tenant-not-found', host, baseDomain, subdomain, message: 'Tenant not found.' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(200).json({ kind: 'app', host, baseDomain, warning: 'Tenant domain resolver is not configured.' });
  }

  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select(tenantDomainSelect)
      .or(`subdomain_slug.eq.${subdomain},primary_domain.eq.${host},custom_domain.eq.${host}`)
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
