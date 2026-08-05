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
  if (!supabaseAdmin) return res.status(200).json({ logoUrl: null });

  const domain = normalizeHost(req.query?.domain || req.headers.host);
  const baseDomain = getBaseDomain();
  const subdomain = domain.endsWith(`.${baseDomain}`) ? domain.slice(0, -(baseDomain.length + 1)) : '';

  try {
    if (!isTenantSlugValid(subdomain) || !isSafeHostFormat(domain)) return res.status(200).json({ logoUrl: null });
    const safeSlug = cleanTenantSlug(subdomain);
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('name, company_settings')
      .or(`subdomain_slug.eq.${safeSlug},primary_domain.eq.${domain},custom_domain.eq.${domain}`)
      .maybeSingle();
    if (error || !tenant) return res.status(200).json({ logoUrl: null });
    const companySettings = typeof (tenant as any).company_settings === 'string'
      ? JSON.parse((tenant as any).company_settings)
      : (tenant as any).company_settings;
    return res.status(200).json({ logoUrl: companySettings?.logo_url || companySettings?.logoUrl || null, tenantName: (tenant as any).name || null });
  } catch (error) {
    return res.status(200).json({ logoUrl: null });
  }
}
