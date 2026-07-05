import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: 'Storage service not configured.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { tenantId, productId, base64DataUrl } = req.body;

  if (!tenantId || !productId || !base64DataUrl) {
    return res.status(400).json({ error: 'tenantId, productId and base64DataUrl are required.' });
  }
  if (!base64DataUrl.startsWith('data:image')) {
    return res.status(400).json({ error: 'Invalid image data URL.' });
  }

  try {
    const [header, data] = base64DataUrl.split(',');
    if (!data) return res.status(400).json({ error: 'Malformed base64 data URL.' });
    const mimeMatch = header.match(/data:(image\/\w+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const buffer = Buffer.from(data, 'base64');
    const path = `${tenantId}/${productId}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from('product-images')
      .upload(path, buffer, { contentType: mimeType, upsert: true });

    if (error) {
      console.error('[ImageMigration] Upload error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(path);

    return res.json({ success: true, url: urlData.publicUrl });
  } catch (err: any) {
    console.error('[ImageMigration] Exception:', err);
    return res.status(500).json({ error: err?.message || 'Migration failed.' });
  }
}
