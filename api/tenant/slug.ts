import {
  cleanTenantSlug,
  getBaseDomain,
  getBearerToken,
  getSupabaseAdmin,
  isTenantSlugValid,
  mapTenantDomainRecord,
  tenantDomainSelect
} from './_domainUtils.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown) => UUID_RE.test(String(value || ''));

const getBusinessNameSlugCandidates = (businessName: unknown) => {
  const words = String(businessName || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const candidates = [words.slice(0, 1), words.slice(0, 2), words.slice(0, 3)]
    .map(parts => cleanTenantSlug(parts.join('-')))
    .filter(Boolean);
  return Array.from(new Set(candidates.length ? candidates : ['business']));
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase backend client is not configured' });

  if (req.method === 'GET') {
    const slug = cleanTenantSlug(req.query?.slug);
    const tenantId = String(req.query?.tenantId || '');
    if (!isTenantSlugValid(slug)) return res.status(400).json({ available: false, slug, error: 'Slug is invalid or reserved.' });
    let query = supabaseAdmin.from('tenants').select('id').eq('subdomain_slug', slug).limit(1);
    if (isUuid(tenantId)) query = query.neq('id', tenantId);
    const { data, error } = await query;
    if (error) return res.status(400).json({ available: false, error: error.message });
    return res.status(200).json({ available: !data?.length, slug, domain: `${slug}.${getBaseDomain()}` });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const tenantId = String(req.body?.tenantId || '');
    if (!isUuid(tenantId)) return res.status(400).json({ error: 'Invalid tenant identifier.' });

    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) return res.status(401).json({ error: 'Invalid session.' });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, tenant_id, active_tenant, account_type, role, role_key')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const isPlatformAdmin = profile?.account_type === 'super_admin' ||
      ['superadmin', 'super_admin'].includes(String(profile?.role_key || profile?.role || '').toLowerCase());
    if (!isPlatformAdmin && profile?.tenant_id !== tenantId && profile?.active_tenant !== tenantId) {
      return res.status(403).json({ error: 'This account is not allowed to update this tenant.' });
    }

    const { data: currentTenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, business_name, business_name_slug, subdomain_slug')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (!currentTenant) return res.status(404).json({ error: 'Tenant not found.' });
    if (currentTenant.subdomain_slug || currentTenant.business_name_slug) {
      const lockedSlug = currentTenant.subdomain_slug || currentTenant.business_name_slug;
      return res.status(409).json({
        error: 'Business Name Slug is already saved and cannot be changed.',
        slug: lockedSlug,
        domain: `${lockedSlug}.${getBaseDomain()}`
      });
    }

    let slug = cleanTenantSlug(req.body?.slug);
    if (!slug) {
      for (const candidate of getBusinessNameSlugCandidates(currentTenant.business_name || currentTenant.name)) {
        const { data } = await supabaseAdmin.from('tenants').select('id').eq('subdomain_slug', candidate).limit(1);
        if (isTenantSlugValid(candidate) && !data?.length) {
          slug = candidate;
          break;
        }
      }
    }
    if (!isTenantSlugValid(slug)) throw new Error('Business Name Slug is invalid or reserved.');
    const { data: existing } = await supabaseAdmin.from('tenants').select('id').eq('subdomain_slug', slug).neq('id', tenantId).limit(1);
    if (existing?.length) throw new Error(`Business Name Slug "${slug}" is already taken.`);

    const domain = `${slug}.${getBaseDomain()}`;
    const { data: updatedTenant, error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        business_name: currentTenant.business_name || currentTenant.name,
        business_name_slug: slug,
        subdomain_slug: slug,
        primary_domain: domain,
        domain_status: 'active',
        is_domain_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId)
      .select(tenantDomainSelect)
      .single();
    if (updateError) throw updateError;
    return res.status(200).json({ success: true, slug, domain, tenant: mapTenantDomainRecord(updatedTenant) });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Unable to save Business Name Slug.' });
  }
}
