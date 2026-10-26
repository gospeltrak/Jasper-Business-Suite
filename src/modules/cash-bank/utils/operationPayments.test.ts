import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Expense, Purchase } from '../../../types';
const { rpc, requireOnline } = vi.hoisted(() => ({ rpc: vi.fn(), requireOnline: vi.fn() }));
vi.mock('../../../shared/dataBridge/secureDataBridge', () => ({ getSecureDataBridgeClient: async () => ({ rpc }) }));
vi.mock('../../../shared/utils/onlineOnly', () => ({ requireOnlineBusinessWrite: requireOnline }));
import { addSalePayment, saveExpensePayment, saveFundedPurchase } from './operationPayments';

describe('authorized operation payment client', () => {
  beforeEach(() => { rpc.mockReset(); requireOnline.mockReset(); });
  it('sends expense corrections with the version the staff actually edited', async () => {
    const previous = { id: 'expense', syncUpdatedAt: 'old' } as Expense;
    const next = { ...previous, amount: 12 };
    rpc.mockResolvedValue({ data: { expense: { ...next, syncUpdatedAt: 'committed' } } });
    expect((await saveExpensePayment(next, previous)).syncUpdatedAt).toBe('committed');
    expect(rpc).toHaveBeenCalledWith('save_current_branch_expense_payment', { p_expense: next, p_expected_version: 'old' });
  });
  it('does not report success when permission is denied', async () => {
    rpc.mockResolvedValue({ error: { code: '42501' } });
    await expect(saveExpensePayment({ id: 'expense' } as Expense)).rejects.toThrow('Your role');
  });
  it('does not accept an unconfirmed or different expense record', async () => {
    rpc.mockResolvedValue({ data: { expense: { id: 'other' } } });
    await expect(saveExpensePayment({ id: 'expense' } as Expense)).rejects.toThrow('not confirmed');
  });
  it('keeps purchase, inventory and branch stock in one RPC', async () => {
    const purchase = { id: 'purchase' } as Purchase;
    rpc.mockResolvedValue({ data: { purchase } });
    await saveFundedPurchase(purchase, [], []);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('save_current_branch_funded_purchase', { p_purchase: purchase, p_products: [], p_branch_stocks: [] });
  });
  it('only confirms a sale payment returned in committed payment history', async () => {
    rpc.mockResolvedValueOnce({ data: { sale: { id: 'sale', payments: [] } } });
    await expect(addSalePayment('sale', 'payment', 5, 'mpesa')).rejects.toThrow('not confirmed');
    rpc.mockResolvedValueOnce({ data: { sale: { id: 'sale', payments: [{ id: 'payment' }] } } });
    expect((await addSalePayment('sale', 'payment', 5, 'mpesa')).id).toBe('sale');
  });
  it('blocks offline payments before making an RPC request', async () => {
    requireOnline.mockImplementation(() => { throw new Error('Connect to internet'); });
    await expect(addSalePayment('sale', 'payment', 5, 'mpesa')).rejects.toThrow('Connect');
    expect(rpc).not.toHaveBeenCalled();
  });
});
