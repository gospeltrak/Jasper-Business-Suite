import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateSalesDocumentTotals } from '../src/modules/sales/utils/salesDocumentTotals';

const sql = fs.readFileSync('supabase/migrations/20261106190000_fix_consolidated_invoice_staff_permissions.sql','utf8');
const sales = fs.readFileSync('src/modules/sales/DashboardSalesList.tsx','utf8');
const branchApi = fs.readFileSync('src/modules/branches/branchApi.ts','utf8');
const server = fs.readFileSync('server.ts','utf8');

test('zero delivery is optional for both invoices and quotes; VAT and discounts still work', () => {
  const items = [{ qty: 2, price: 50000 }];
  const withoutDelivery = calculateSalesDocumentTotals({items,deliveryCost:0,discountAmount:10000});
  expectTotals(withoutDelivery,90000,0);
  const blankDelivery = calculateSalesDocumentTotals({items,discountAmount:10000});
  expectTotals(blankDelivery,90000,0);
  const withDelivery = calculateSalesDocumentTotals({items,deliveryCost:5000});
  expectTotals(withDelivery,105000,5000);
  function expectTotals(value: ReturnType<typeof calculateSalesDocumentTotals>,total: number,delivery: number) {
    assert.equal(value.total,total);
    assert.equal(value.delivery,delivery);
  }
});

test('Cash and Credit are offered without a linked bank or mobile money account',()=>{
  assert.match(sales,/new Set\(\['Cash', 'Credit', \.\.\.enabled\]\)/);
  assert.match(sales,/\['cash', 'credit'\]\.includes\(method\.trim\(\)\.toLowerCase\(\)\)/);
  assert.match(sales,/paymentAmount: newDocPaymentMethod\.toLowerCase\(\) === 'credit' \? 0 : newDocGrandTotal/);
  assert.match(sales,/aria-label="Optional delivery fee"/);
  assert.match(sales,/deliveryAmount: Number\(newDocDeliveryCost\) \|\| 0/);
});

test('save and load are backed by server RPCs, and remote read errors cannot disappear silently',()=>{
  assert.match(server,/branchClient\.rpc\('save_current_sales_document'/);
  assert.match(server,/branchClient\.rpc\('list_current_commercial_documents'/);
  assert.match(sales,/Saved documents could not be refreshed:/);
  assert.match(sales,/setDocumentsLoadRetry\(counter => counter \+ 1\)/);
  assert.match(branchApi,/createStandardCommercialDocument/);
  assert.match(branchApi,/loadCommercialDocuments/);
});

test('cross-branch invoices store payment instructions independently of treasury or delivery',()=>{
  assert.match(sql,/add column if not exists payment_method text/);
  assert.match(sql,/add column if not exists payment_amount numeric/);
  assert.match(sql,/create or replace function public\.create_cross_branch_commercial_document/i);
  assert.match(sql,/create or replace function public\.update_cross_branch_commercial_document/i);
  assert.match(sql,/create or replace function public\.list_current_commercial_documents/i);
  assert.match(sql,/'paymentMethod', document\.payment_method/);
  assert.match(sql,/lower\(v_payment_method\) in \('cash','credit'\) then null/);
  assert.match(sql,/v_delivery := greatest\(0, coalesce\(\(p_document ->> 'deliveryAmount'\)::numeric, 0\)\)/);
  assert.match(branchApi,/paymentAccountNumber\?: string/);
  assert.match(sales,/paymentMethod: newDocPaymentMethod/);
});

test('consolidated access is tenant-scoped and only for active all-branch staff with explicit invoice rights',()=>{
  assert.match(sql,/profile\.access_scope = 'all_branches'/);
  assert.match(sql,/staff\.tenant_id = profile\.tenant_id/);
  assert.match(sql,/staff\.is_active = true/);
  assert.match(sql,/profile\.staff_id = \(select auth\.uid\(\)\)/);
  assert.match(sql,/staff\.role_permissions -> 'price quote' ->> 'write'/);
  assert.match(sql,/private\.can_operate_additional_branches/);
  assert.match(sql,/private\.is_tenant_branch_administrator/);
  assert.doesNotMatch(sql,/delete from public\.branch_staff_access_profiles/i);
  assert.doesNotMatch(sql,/delete from public\.cross_branch_commercial_documents/i);
});
