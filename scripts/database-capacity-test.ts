import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';

const TENANT_COUNT = 500;
const BATCH_SIZE = 50;
const READ_CONCURRENCY = 50;
const READ_ITERATIONS = 10;
const RUN_ID = `LOADTEST_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}_${randomUUID().slice(0, 8)}`;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.argv.includes('--confirm-staging')) {
  throw new Error('Refusing to run without --confirm-staging. This command writes temporary database records.');
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Sample = { operation: string; durationMs: number; rows: number };
const samples: Sample[] = [];
const tenantIds = Array.from({ length: TENANT_COUNT }, () => randomUUID());

const chunks = <T>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

const percentile = (values: number[], value: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((value / 100) * sorted.length) - 1)];
};

const timed = async <T>(operation: string, task: () => Promise<T>, rows = 0) => {
  const started = performance.now();
  const result = await task();
  samples.push({ operation, durationMs: performance.now() - started, rows });
  return result;
};

const workspacePayload = (tenantIndex: number) => ({
  loadTestRunId: RUN_ID,
  settings: { businessName: `${RUN_ID} Lim Cleaners ${tenantIndex + 1}`, currency: 'TZS' },
  products: Array.from({ length: 100 }, (_, index) => ({
    id: `product-${index + 1}`,
    name: `Cleaning Service ${index + 1}`,
    sellingPrice: 5_000 + index * 100,
    stockQty: 100 + index,
  })),
  sales: Array.from({ length: 100 }, (_, index) => ({
    id: `sale-${index + 1}`,
    amount: 10_000 + index * 250,
    createdAt: new Date(Date.now() - index * 60_000).toISOString(),
  })),
  expenses: Array.from({ length: 25 }, (_, index) => ({ id: `expense-${index + 1}`, amount: 1_000 + index * 100 })),
});

async function insertTestData() {
  const now = new Date().toISOString();
  for (const [batchIndex, ids] of chunks(tenantIds, BATCH_SIZE).entries()) {
    const offset = batchIndex * BATCH_SIZE;
    const tenants = ids.map((id, index) => {
      const number = offset + index + 1;
      const slug = `${RUN_ID.toLowerCase().replace(/_/g, '-')}-${number}`;
      return {
        id,
        name: `${RUN_ID} Lim Cleaners ${number}`,
        business_name: `${RUN_ID} Lim Cleaners ${number}`,
        business_name_slug: slug,
        subdomain_slug: slug,
        primary_domain: `${slug}.loadtest.invalid`,
        domain_status: 'inactive',
        is_domain_active: false,
        country: 'Tanzania',
        city: 'Dar es Salaam',
        currency: 'TSh',
        currency_code: 'TZS',
        tax_rate: 0.18,
        business_type: 'retail',
        mobile_money_providers: [],
        company_settings: { loadTestRunId: RUN_ID },
        business_settings: {},
        invoice_settings: {},
        subscription_status: 'trial',
        subscription_start_date: now,
        subscription_end_date: now,
        package_updated_at: now,
        package_change_type: 'capacity_test',
        package_change_note: RUN_ID,
      };
    });
    const tenantResult = await timed('tenant_batch_insert', async () => await supabase.from('tenants').insert(tenants), ids.length);
    if (tenantResult.error) throw tenantResult.error;

    const workspaces = ids.map((tenantId, index) => ({
      tenant_id: tenantId,
      payload: workspacePayload(offset + index),
      updated_at: now,
    }));
    const workspaceResult = await timed('workspace_batch_insert', async () => await supabase.from('tenant_workspaces').insert(workspaces), ids.length);
    if (workspaceResult.error) throw workspaceResult.error;
  }
}

async function benchmarkReads() {
  const jobs = Array.from({ length: READ_CONCURRENCY * READ_ITERATIONS }, (_, index) => async () => {
    const tenantId = tenantIds[index % tenantIds.length];
    const result = await timed('workspace_point_read', async () => await supabase
      .from('tenant_workspaces')
      .select('tenant_id,updated_at,payload')
      .eq('tenant_id', tenantId)
      .single(), 1);
    if (result.error) throw result.error;
  });
  for (const batch of chunks(jobs, READ_CONCURRENCY)) await Promise.all(batch.map((job) => job()));
}

async function benchmarkTenantSearch() {
  const result = await timed('tenant_prefix_search', async () => await supabase
    .from('tenants')
    .select('id,name,subscription_status')
    .like('name', `${RUN_ID}%`)
    .order('name')
    .limit(TENANT_COUNT), TENANT_COUNT);
  if (result.error) throw result.error;
  if (result.data?.length !== TENANT_COUNT) throw new Error(`Expected ${TENANT_COUNT} tenants, found ${result.data?.length || 0}.`);
}

async function cleanup() {
  for (const ids of chunks(tenantIds, BATCH_SIZE)) {
    const result = await timed('cleanup_batch_delete', async () => await supabase.from('tenants').delete().in('id', ids), ids.length);
    if (result.error) throw result.error;
  }
  const verification = await supabase.from('tenants').select('id', { count: 'exact', head: true }).like('name', `${RUN_ID}%`);
  if (verification.error) throw verification.error;
  if (verification.count !== 0) throw new Error(`Cleanup verification failed: ${verification.count} synthetic tenants remain.`);
}

function report(totalDurationMs: number) {
  const operations = [...new Set(samples.map((sample) => sample.operation))];
  console.log(JSON.stringify({
    runId: RUN_ID,
    syntheticTenants: TENANT_COUNT,
    workspaceShape: { products: 100, sales: 100, expenses: 25 },
    concurrentReads: READ_CONCURRENCY,
    totalReadRequests: READ_CONCURRENCY * READ_ITERATIONS,
    totalDurationMs: Number(totalDurationMs.toFixed(2)),
    cleanupVerified: true,
    operations: Object.fromEntries(operations.map((operation) => {
      const values = samples.filter((sample) => sample.operation === operation).map((sample) => sample.durationMs);
      return [operation, {
        requests: values.length,
        p50Ms: Number(percentile(values, 50).toFixed(2)),
        p95Ms: Number(percentile(values, 95).toFixed(2)),
        p99Ms: Number(percentile(values, 99).toFixed(2)),
        maxMs: Number(Math.max(...values).toFixed(2)),
      }];
    })),
  }, null, 2));
}

async function main() {
  const started = performance.now();
  let testError: unknown;
  try {
    await insertTestData();
    await benchmarkTenantSearch();
    await benchmarkReads();
  } catch (error) {
    testError = error;
  }

  try {
    await cleanup();
  } catch (cleanupError) {
    console.error(`CRITICAL: cleanup failed for ${RUN_ID}.`, cleanupError);
    process.exitCode = 2;
    return;
  }

  if (testError) throw testError;
  report(performance.now() - started);
}

main().catch((error) => {
  console.error('Database capacity test failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
