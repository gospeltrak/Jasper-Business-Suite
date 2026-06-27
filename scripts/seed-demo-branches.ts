import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_PRODUCTS } from '../src/data';
import { Branch, BranchStock, Product } from '../src/types';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const DEMO_USER_ID = '33333333-3333-3333-3333-333333333333';
const MAIN_BRANCH_ID = '44444444-4444-4444-4444-444444444444';
const GOBA_BRANCH_ID = '55555555-5555-5555-5555-555555555555';
const DEMO_PHONE = '0700000002';
const DEMO_PHONE_NORMALIZED = '255700000002';
const DEMO_EMAIL = `wa${DEMO_PHONE_NORMALIZED}@whatsapp.jasper.local`;
const DEMO_PASSWORD = process.env.DEMO_BRANCH_PASSWORD || 'password123';

const nowIso = () => new Date().toISOString();
const makeBranchStockId = (branchId: string, productId: string) => `${branchId}:${productId}`;

const gobaQtyFor = (product: Product) => {
  const base = Number(product.stockQty || 0);
  if (base <= 0) return 0;
  return Math.max(3, Math.round(base * 0.45));
};

async function ensureDemoLogin() {
  const { data: existingPublicUser, error: existingPublicError } = await supabase
    .from('users')
    .select('id')
    .eq('id', DEMO_USER_ID)
    .maybeSingle();
  if (existingPublicError) throw existingPublicError;

  let authUserId = existingPublicUser?.id || DEMO_USER_ID;

  if (!existingPublicUser) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Jasper Demo Admin', phone: DEMO_PHONE },
    });

    if (createError && !createError.message.toLowerCase().includes('already registered')) {
      throw createError;
    }
    authUserId = created.user?.id || DEMO_USER_ID;
  }

  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: authUserId,
      email: DEMO_EMAIL,
      name: 'Jasper Demo Admin',
      role: 'Admin',
      tenant_id: DEMO_TENANT_ID,
      active_tenant: DEMO_TENANT_ID,
      phone: DEMO_PHONE,
      username_phone: DEMO_PHONE,
      account_type: 'business_user',
      role_key: 'Admin',
      role_permissions: {},
      is_active: true,
    }, { onConflict: 'id' });
  if (userError) throw userError;

  return authUserId;
}

async function ensureBranches(createdBy: string) {
  const branches = [
    {
      id: MAIN_BRANCH_ID,
      tenant_id: DEMO_TENANT_ID,
      branch_name: 'Main Branch',
      branch_code: 'MAIN',
      city: 'Dar es Salaam',
      status: 'active',
      is_default: true,
      created_by: createdBy,
      updated_at: nowIso(),
    },
    {
      id: GOBA_BRANCH_ID,
      tenant_id: DEMO_TENANT_ID,
      branch_name: 'Goba Branch',
      branch_code: 'GOBA',
      city: 'Goba',
      status: 'active',
      is_default: false,
      created_by: createdBy,
      updated_at: nowIso(),
    },
  ];

  const { error } = await supabase
    .from('branches')
    .upsert(branches, { onConflict: 'tenant_id,branch_code' });
  if (error) throw error;
}

async function seedWorkspaceAndStock() {
  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('tenant_workspaces')
    .select('payload')
    .eq('tenant_id', DEMO_TENANT_ID)
    .maybeSingle();
  if (workspaceError) throw workspaceError;

  const currentPayload = workspaceRow?.payload || {};
  const products: Product[] = Array.isArray(currentPayload.products) && currentPayload.products.length
    ? currentPayload.products
    : DEFAULT_PRODUCTS['t-lagos-01'];

  const createdAt = nowIso();
  const workspaceBranches: Branch[] = [
    {
      id: MAIN_BRANCH_ID,
      tenantId: DEMO_TENANT_ID,
      branchName: 'Main Branch',
      branchCode: 'MAIN',
      city: 'Dar es Salaam',
      status: 'active',
      isDefault: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: GOBA_BRANCH_ID,
      tenantId: DEMO_TENANT_ID,
      branchName: 'Goba Branch',
      branchCode: 'GOBA',
      city: 'Goba',
      status: 'active',
      isDefault: false,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const mainStocks: BranchStock[] = products.map((product) => ({
    id: makeBranchStockId(MAIN_BRANCH_ID, product.id),
    tenantId: DEMO_TENANT_ID,
    branchId: MAIN_BRANCH_ID,
    productId: product.id,
    quantity: Number(product.stockQty || 0),
    shopStockQty: Number(product.shopStockQty || 0),
    storeStockQty: Number(product.storeStockQty || 0),
    buyingPrice: Number(product.costPrice || 0),
    sellingPrice: Number(product.sellingPrice || 0),
    lowStockAlert: Number(product.alertQty || 0),
    createdAt,
    updatedAt: createdAt,
  }));

  const gobaStocks: BranchStock[] = products.map((product) => {
    const quantity = gobaQtyFor(product);
    const shopStockQty = Math.round(quantity * 0.4);
    return {
      id: makeBranchStockId(GOBA_BRANCH_ID, product.id),
      tenantId: DEMO_TENANT_ID,
      branchId: GOBA_BRANCH_ID,
      productId: product.id,
      quantity,
      shopStockQty,
      storeStockQty: Math.max(0, quantity - shopStockQty),
      buyingPrice: Number(product.costPrice || 0),
      sellingPrice: Number(product.sellingPrice || 0),
      lowStockAlert: Number(product.alertQty || 0),
      createdAt,
      updatedAt: createdAt,
    };
  });

  const allBranchStocks = [...mainStocks, ...gobaStocks];
  const dbStocks = allBranchStocks.map((stock) => ({
    tenant_id: stock.tenantId,
    branch_id: stock.branchId,
    product_id: stock.productId,
    quantity: stock.quantity,
    shop_stock_qty: stock.shopStockQty,
    store_stock_qty: stock.storeStockQty,
    buying_price: stock.buyingPrice,
    selling_price: stock.sellingPrice,
    low_stock_alert: stock.lowStockAlert,
    updated_at: stock.updatedAt,
  }));

  const { error: stockError } = await supabase
    .from('branch_stock')
    .upsert(dbStocks, { onConflict: 'tenant_id,branch_id,product_id' });
  if (stockError) throw stockError;

  const nextPayload = {
    ...currentPayload,
    products,
    branches: workspaceBranches,
    branchStocks: allBranchStocks,
    branchStaffAssignments: currentPayload.branchStaffAssignments || [],
    selectedBranchId: MAIN_BRANCH_ID,
  };

  const { error: saveError } = await supabase
    .from('tenant_workspaces')
    .upsert({
      tenant_id: DEMO_TENANT_ID,
      payload: nextPayload,
      updated_at: nowIso(),
    }, { onConflict: 'tenant_id' });
  if (saveError) throw saveError;

  return {
    productCount: products.length,
    branchStockCount: allBranchStocks.length,
    mainTotal: mainStocks.reduce((sum, stock) => sum + stock.quantity, 0),
    gobaTotal: gobaStocks.reduce((sum, stock) => sum + stock.quantity, 0),
  };
}

async function main() {
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', DEMO_TENANT_ID)
    .maybeSingle();
  if (tenantError) throw tenantError;
  if (!tenant) throw new Error(`Existing demo tenant not found: ${DEMO_TENANT_ID}`);

  const demoUserId = await ensureDemoLogin();
  await ensureBranches(demoUserId);
  const summary = await seedWorkspaceAndStock();

  console.log(JSON.stringify({
    ok: true,
    tenant,
    demoUsername: DEMO_PHONE,
    demoUserId,
    branches: [
      { id: MAIN_BRANCH_ID, name: 'Main Branch', code: 'MAIN', isDefault: true },
      { id: GOBA_BRANCH_ID, name: 'Goba Branch', code: 'GOBA', isDefault: false },
    ],
    ...summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
