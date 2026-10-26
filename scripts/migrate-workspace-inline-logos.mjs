#!/usr/bin/env node
/**
 * Operator-only, opt-in migration for embedded legacy tenant logos.
 *
 * Default: read-only dry run. Apply requires --apply, --tenant-id, --confirm-tenant,
 * an outside-the-repository private backup directory, and trusted server-only DB/Storage credentials.
 *
 * No deletes, no backup pruning, no source_record or business-table writes.
 */
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Client } = pg;
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
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Server-only DATABASE_URL is required');
  if (doApply && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('Server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for apply');
  }

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    // Pull the canonical JSONB TEXT to avoid number rounding or object
    // reserialization; later SQL patches only individual existing logo paths.
    const source = await db.query(
      'select tenant_id::text, updated_at::text, payload::text as payload_json from public.tenant_workspaces where tenant_id=$1::uuid',
      [tenantId],
    );
    if (source.rows.length !== 1) throw new Error('Tenant workspace unavailable');
    const row = source.rows[0];
    const original = JSON.parse(row.payload_json);
    const candidates = collectInlineLogoCandidates(original);
    const unique = new Map(candidates.map(({ image }) => [image.hash, image]));
    const bytesTotal = [...unique.values()].reduce((n, image) => n + image.bytes.length, 0);
    console.log(`Found ${candidates.length} inline fields, ${unique.size} distinct images, ${bytesTotal} unique bytes.`);
    if (!doApply || !candidates.length) {
      console.log('Dry-run or empty result: no rows or Storage objects changed.');
      return;
    }

    const saved = await backupWorkspace(backupDir, row);
    console.log(`Private original workspace snapshot saved: ${saved.filename}; sha256=${saved.hash}`);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const bucket = supabase.storage.from('tenant-logos');
    const urlByHash = new Map();
    for (const image of unique.values()) {
      const storagePath = immutableLogoStoragePath(tenantId, image);
      const { error: uploadError } = await bucket.upload(storagePath, image.bytes, {
        contentType: image.mime, upsert: false, cacheControl: '31536000',
      });
      if (uploadError && !/already exists|duplicate|409/i.test(
        String(uploadError.message || '') + ' ' + String(uploadError.statusCode || ''),
      )) {
        throw new Error('Storage rejected a logo upload; database unchanged');
      }
      const { data: downloaded, error: readError } = await bucket.download(storagePath);
      if (readError || !downloaded || sha256(Buffer.from(await downloaded.arrayBuffer())) !== image.hash) {
        throw new Error('Storage SHA-256 download verification failed; database unchanged');
      }
      const url = bucket.getPublicUrl(storagePath).data?.publicUrl;
      if (!url?.startsWith('https://')) throw new Error('Storage URL unavailable; database unchanged');
      urlByHash.set(image.hash, url);
    }

    const expected = replaceInlineLogos(original, candidates, urlByHash);
    // The tenant_settings protection trigger preserves the old settings
    // unless app.jasper_explicit_settings_tenant is set IN THIS transaction.
    // Do not disable triggers or bypass integrity checks.
    await db.query('BEGIN');
    try {
      const latest = await db.query(
        'select updated_at::text, payload::text as payload_json from public.tenant_workspaces where tenant_id=$1::uuid for update',
        [tenantId],
      );
      if (latest.rows.length !== 1 || latest.rows[0].updated_at !== row.updated_at ||
          latest.rows[0].payload_json !== row.payload_json) {
        throw new Error('Workspace changed since preview; refusing stale settings write');
      }
      await db.query("select set_config('app.jasper_explicit_settings_tenant',$1,true)", [tenantId]);
      let expression = 'payload';
      const params = [];
      for (const { path: keyPath, image } of candidates) {
        const url = urlByHash.get(image.hash);
        if (!url) throw new Error('Verified URL missing');
        expression = `jsonb_set(${expression}, $${params.length + 1}::text[], to_jsonb($${params.length + 2}::text), false)`;
        params.push(keyPath, url);
      }
      // All paths and values are parameters; non-logo JSON stays server-side.
      const updated = await db.query(
        `update public.tenant_workspaces
         set payload=${expression}, updated_at=statement_timestamp()
         where tenant_id=$${params.length + 1}::uuid
           and updated_at=$${params.length + 2}::timestamptz
         returning payload::text as payload_json`,
        [...params, tenantId, row.updated_at],
      );
      if (updated.rows.length !== 1) throw new Error('No row passed compare-and-swap');
      const after = JSON.parse(updated.rows[0].payload_json);
      if (!isDeepStrictEqual(after, expected) || collectInlineLogoCandidates(after).length !== 0) {
        throw new Error('Transaction result differed from expected logo-only change');
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    console.log('Verified transaction committed: only inline logo paths changed; original snapshot retained.');
  } finally {
    await db.end();
  }
}

run().catch(error => {
  console.error('Logo migration stopped:', error.message);
  process.exitCode = 1;
});
