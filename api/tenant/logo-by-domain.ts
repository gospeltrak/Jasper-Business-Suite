import {
  cleanTenantSlug,
  getBaseDomain,
  getSupabaseAdmin,
  isSafeHostFormat,
  isTenantSlugValid,
  normalizeHost
} from './_domainUtils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(200).json({ logoUrlLight: null, logoUrlDark: null });

  const domain = normalizeHost(req.query?.domain || req.headers.host);
  const baseDomain = getBaseDomain();
  const subdomain = domain.endsWith(`.${baseDomain}`) ? domain.slice(0, -(baseDomain.length + 1)) : '';

  try {
    if (!isTenantSlugValid(subdomain) || !isSafeHostFormat(domain)) return res.status(200).json({ logoUrlLight: null, logoUrlDark: null });
    const safeSlug = cleanTenantSlug(subdomain);
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .or(`subdomain_slug.eq.${safeSlug},primary_domain.eq.${domain},custom_domain.eq.${domain}`)
      .maybeSingle();
    if (error || !tenant) return res.status(200).json({ logoUrlLight: null, logoUrlDark: null });

    // Business Settings is the single source of truth for the tenant's logo
    // (both light- and dark-theme variants) -- the tenants table's
    // company_settings.logo_url is a legacy, separate field that is never
    // read here.
    const { data: workspace } = await supabaseAdmin
      .from('tenant_workspaces')
      .select('business:payload->settings->business')
      .eq('tenant_id', (tenant as any).id)
      .maybeSingle();
    const business = (workspace as any)?.business || {};
    const logoUrlLight = business.businessLogoLight || business.businessLogo || business.businessLogoDark || null;
    const logoUrlDark = business.businessLogoDark || business.businessLogoLight || business.businessLogo || null;
    return res.status(200).json({ logoUrlLight, logoUrlDark, tenantName: (tenant as any).name || null });
  } catch (error) {
    return res.status(200).json({ logoUrlLight: null, logoUrlDark: null });
  }
}
