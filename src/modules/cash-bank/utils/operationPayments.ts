import type { BranchStock, Expense, Product, Purchase, Sale } from '../../../types';
import { getSecureDataBridgeClient } from '../../../shared/dataBridge/secureDataBridge';
import { requireOnlineBusinessWrite } from '../../../shared/utils/onlineOnly';

async function operationRpc(name: string, args: Record<string, unknown>) {
  requireOnlineBusinessWrite('business payment');
  const client: any = await getSecureDataBridgeClient();
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (error.code === '42501') throw new Error('Your role does not allow this operation in the selected branch. Ask the business owner to check Roles & Access.');
    if (error.code === '40001' || error.code === '23505') throw new Error('This record has changed or already exists. Refresh and check its payment history before retrying.');
    if (error.code === '23514') throw new Error('Check the amount, outstanding balance and active payment account. Historical expense funding must be reconciled before changing its amount or account.');
    throw new Error('The payment could not be confirmed. Refresh and check the record before retrying.');
  }
  return data;
}

export async function saveExpensePayment(expense: Expense, previous?: Expense): Promise<Expense> {
  const result = await operationRpc('save_current_branch_expense_payment', {
    p_expense: expense,
    p_expected_version: previous ? previous.syncUpdatedAt || previous.timestamp || '' : null,
  });
  if (result?.expense?.id !== expense.id) throw new Error('Expense save was not confirmed. Refresh Expenses.');
  return result.expense;
}

export async function saveFundedPurchase(purchase: Purchase, products?: Product[], branchStocks?: BranchStock[]): Promise<Purchase> {
  const result = await operationRpc('save_current_branch_funded_purchase', {
    p_purchase: purchase, p_products: products ?? null, p_branch_stocks: branchStocks ?? null,
  });
  if (result?.purchase?.id !== purchase.id) throw new Error('Purchase save was not confirmed. Refresh Purchases.');
  return result.purchase;
}

export async function addSalePayment(saleId: string, paymentId: string, amount: number, sourceKey: string, paidAt?: string): Promise<Sale> {
  const result = await operationRpc('add_current_branch_sale_payment', {
    p_sale_id: saleId, p_payment_id: paymentId, p_amount: amount,
    p_source_key: sourceKey, p_paid_at: paidAt || null,
  });
  if (result?.sale?.id !== saleId || !result.sale.payments?.some((payment: { id: string }) => payment.id === paymentId)) {
    throw new Error('Customer payment was not confirmed. Refresh Sales.');
  }
  return result.sale;
}
