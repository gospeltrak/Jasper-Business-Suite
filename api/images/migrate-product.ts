import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown) => UUID_RE.test(String(value || ''));
const SAFE_RECORD_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const isSafeRecordToken = (value: unknown) => SAFE_RECORD_RE.test(String(value || ''));

const MAX_UPLOAD_BYTES = 2_000_000; // 2 MB

const ALLOWED_IMAGE_TYPES: Record<string, { ext: string; magic: (buf: Buffer) => boolean }> = {
  'image/png': { ext: 'png', magic: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/jpeg': { ext: 'jpg', magic: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { ext: 'webp', magic: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  'image/gif': { ext: 'gif', magic: (b) => b.length >= 6 && (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a') },
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return res.status(503).json({ error: 'Storage service not configured.' });
  }

  const { tenantId, productId, base64DataUrl } = req.body || {};

  if (!isUuid(tenantId)) {
    return res.status(400).json({ error: 'Invalid tenant identifier.' });
  }
  if (!isSafeRecordToken(productId)) {
    return res.status(400).json({ error: 'Invalid product identifier.' });
  }
  if (!base64DataUrl || typeof base64DataUrl !== 'string' || !base64DataUrl.startsWith('data:image')) {
    return res.status(400).json({ error: 'Invalid image data URL.' });
  }

  try {
    // Authenticate: the caller must hold a valid session that belongs to this
    // tenant (or be a platform admin) before we use the service-role client,
    // which bypasses RLS entirely.
    const authHeader = String(req.headers?.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.' });

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authData?.user) return res.status(401).json({ error: 'Invalid session.' });

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, tenant_id, active_tenant, account_type, role, role_key')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const isPlatformAdmin = (profile as any)?.account_type === 'super_admin' ||
      ['superadmin', 'super_admin'].includes(String((profile as any)?.role_key || (profile as any)?.role || '').toLowerCase());
    const belongsToTenant = String((profile as any)?.tenant_id || '') === tenantId || String((profile as any)?.active_tenant || '') === tenantId;
    if (!isPlatformAdmin && !belongsToTenant) {
      return res.status(403).json({ error: 'This account is not allowed to upload images for this tenant.' });
    }

    const [header, data] = base64DataUrl.split(',');
    if (!data) return res.status(400).json({ error: 'Malformed base64 data URL.' });
    const mimeMatch = header.match(/data:(image\/\w+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : '';
    const allowed = ALLOWED_IMAGE_TYPES[mimeType];
    if (!allowed) {
      return res.status(400).json({ error: 'Unsupported image type. Only PNG, JPEG, WEBP and GIF are accepted.' });
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
      return res.status(400).json({ error: 'Invalid image data.' });
    }

    const buffer = Buffer.from(data, 'base64');
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'Image is too large. Please upload an image below 2 MB.' });
    }
    if (!allowed.magic(buffer)) {
      return res.status(400).json({ error: 'File content does not match the declared image type.' });
    }

    const path = `${tenantId}/${productId}.${allowed.ext}`;

    const { error } = await supabaseAdmin.storage
      .from('product-images')
      .upload(path, buffer, { contentType: mimeType, upsert: true });

    if (error) {
      console.error('[ImageMigration] Upload error:', error.message);
      return res.status(500).json({ error: 'Image could not be saved. Please try again.' });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(path);

    return res.json({ success: true, url: urlData.publicUrl });
  } catch (err: any) {
    console.error('[ImageMigration] Exception:', err);
    return res.status(500).json({ error: 'Image could not be saved. Please try again.' });
  }
}
