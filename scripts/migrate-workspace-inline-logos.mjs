#!/usr/bin/env node
/**
 * Operator-only, opt-in migration for embedded legacy tenant logos.
 *
 * Default: read-only dry run. Apply requires --apply, --tenant-id, --confirm-tenant,
 * an outside-the-repository private backup directory, and a server-only service key.
 *
 * No deletes, no backup pruning, no source_record or business-table writes.
 */
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import {
  collectInlineLogoCandidates, replaceInlineLogos, immutableLogoStoragePath,
} from './lib/workspace-logo-migration.mjs';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function arg(name) {
  const found = process.argv.slice(2).find(v => v.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : null;
}

async function backupWorkspace(directory, row) {
  const dest = resolve(directory);
  const cwd = resolve('.');
  if (dest === cwd || dest.startsWith(cwd + sep)) {
    throw new Error('Backup directory must be outside the working repository');
  }
  await mkdir(dest, { recursive: true, mode: 0o700 });
  const folderStat = await stat(dest);
  if (!folderStat.isDirectory() || (folderStat.mode & 0o077) !== 0) {
    throw new Error('Backup directory must be private (chmod 700)');
  }
  const original = JSON.stringify(row);
  const hash = sha256(Buffer.from(original));
  const filename = `${row.tenant_id}-${Date.now()}-${hash.slice(0, 12)}.json`;
  const handle = await open(resolve(dest, filename), 'wx', 0o600);
  try { await handle.writeFile(original); }
  finally { await handle.close(); }
  if (sha256(await readFile(resolve(dest, filename))) !== hash) {
    throw new Error('Saved rollback snapshot hash mismatch');
  }
  return { filename, hash };
}

async function run() {
  const tenantId = arg('tenant-id');
  const doApply = process.argv.includes('--apply');
  const confirmId = arg('confirm-tenant');
  const backupDir = arg('backup-dir');
  if (!tenantId || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(tenantId)) {
    throw new Error('Supply --tenant-id=<UUID> to scope the operation to one tenant');
  }
  if (doApply && (confirmId !== tenantId || !backupDir || process.env.CI)) {
    throw new Error('Apply requires --confirm-tenant=<same UUID>, --backup-dir=<private absolute path> and non-CI environment');
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row, error: loadError } = await client
    .from('tenant_workspaces')
    .select('tenant_id,updated_at,payload')
    .eq('tenant_id', tenantId).maybeSingle();
  if (loadError || !row) throw new Error('Tenant workspace unavailable; no changes made');

  const candidates = collectInlineLogoCandidates(row.payload);
  const unique = new Map(candidates.map(({image}) => [image.hash, image]));
  const totalBytes = [...unique.values()].reduce((sum, image) => sum + image.bytes.length, 0);
  console.log(`Found ${candidates.length} inline logo fields, ${unique.size} distinct images, ${totalBytes} unique bytes.`);
  if (!doApply || !candidates.length) {
    console.log('Dry run/empty result: no data or Storage objects changed.');
    return;
  }

  const snapshot = await backupWorkspace(backupDir, row);
  console.log(`Private original workspace backup saved: ${snapshot.filename}; sha256=${snapshot.hash}`);
  const bucket = client.storage.from('tenant-logos');
  const urlByHash = new Map();
  for (const image of unique.values()) {
    const path = immutableLogoStoragePath(tenantId, image);
    const { error: uploadError } = await bucket.upload(path, image.bytes, {
      contentType: image.mime, upsert: false, cacheControl: '31536000',
    });
    if (uploadError && !/already exists|duplicate|409/i.test(String(uploadError.message || uploadError.statusCode || ''))) {
      throw new Error('Storage upload rejected; original database workspace unchanged');
    }
    // Validate bytes for both a new upload and an existing immutable object.
    const { data: downloaded, error: readError } = await bucket.download(path);
    if (readError || !downloaded || sha256(Buffer.from(await downloaded.arrayBuffer())) !== image.hash) {
      throw new Error('Storage round-trip SHA-256 mismatch; original database workspace unchanged');
    }
    const publicUrl = bucket.getPublicUrl(path).data?.publicUrl;
    if (!publicUrl?.startsWith('https://')) {
      throw new Error('Storage public URL unavailable; original database workspace unchanged');
    }
    urlByHash.set(image.hash, publicUrl);
  }

  const replacement = replaceInlineLogos(row.payload, candidates, urlByHash);
  const updatedTime = new Date().toISOString();
  // Optimistic compare-and-swap protects concurrent user changes in production.
  const { data: changed, error: updateError } = await client.from('tenant_workspaces')
    .update({ payload: replacement, updated_at: updatedTime })
    .eq('tenant_id', tenantId)
    .eq('updated_at', row.updated_at)
    .select('payload,updated_at');
  if (updateError || !changed || changed.length !== 1) {
    throw new Error('Workspace changed concurrently or update rejected. No workspace overwritten; uploaded objects retained.');
  }

  if (!isDeepStrictEqual(changed[0].payload, replacement) ||
      collectInlineLogoCandidates(changed[0].payload).length !== candidates.length - candidates.length) {
    throw new Error('Post-write validation failed; restore using the private backup after manual investigation');
  }
  console.log('Migration confirmed: logo URLs replaced, all other workspace fields preserved; original backup retained.');
}

run().catch(error => {
  console.error('Logo migration stopped:', error.message);
  process.exitCode = 1;
});
