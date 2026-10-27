import { describe, expect, it } from 'vitest';
import type { PaymentChannel } from '../../types';
import { findPaymentChannel, getDebtCollectionPaymentChannels, reconcilePaymentChannels } from './paymentAccounts';

const options = { currency: 'TZS', branchId: 'branch-1' };

describe('receivables Add Payment — active Money & Bank resolution', () => {
  it('accepts Mpesa even if the tenant has never opened Money & Bank', () => {
    const accounts = getDebtCollectionPaymentChannels(
      { paymentModes: ['Mpesa', 'Cash'] },
      [],
      options,
    );
    const mpesa = findPaymentChannel(accounts, 'Mpesa');
    expect(mpesa).toBeDefined();
    expect(mpesa?.id).toBe(reconcilePaymentChannels(['Mpesa', 'Cash'], [], options)[0].id);
    expect(mpesa?.status).toBe('active');
    expect(mpesa?.branchId).toBe('branch-1');
    expect(mpesa?.currency).toBe('TZS');
  });

  it('uses an existing legacy M-Pesa account instead of silently creating a duplicate', () => {
    const previous: PaymentChannel[] = [{
      id: 'previous-mpesa-account',
      name: 'M-Pesa',
      paymentMethod: 'M-Pesa',
      category: 'telco',
      status: 'active',
      branchId: 'branch-1',
    }];
    const accounts = getDebtCollectionPaymentChannels(
      { paymentModes: ['Mpesa'] }, previous, options,
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('previous-mpesa-account');
    expect(accounts[0].paymentMethod).toBe('Mpesa');
    expect(previous[0].paymentMethod).toBe('M-Pesa'); // original settings untouched
  });

  it('rejects inactive, archived, wrong-branch and credit accounts', () => {
    const accounts: PaymentChannel[] = [
      { id: 'mpesa-disabled', name: 'Mpesa', paymentMethod: 'Mpesa', category: 'telco', status: 'inactive' },
      { id: 'cash-archived', name: 'Cash', paymentMethod: 'Cash', category: 'physical', status: 'archived' },
      { id: 'bank-other-branch', name: 'NMB', paymentMethod: 'NMB', category: 'bank', status: 'active', branchId: 'branch-2' },
    ];
    expect(getDebtCollectionPaymentChannels(
      { paymentModes: ['Mpesa', 'Cash', 'NMB', 'Credit'] },
      accounts,
      options,
    )).toHaveLength(0);
  });

  it('does not choose an arbitrary account if two active accounts have the same payment mode', () => {
    const accounts: PaymentChannel[] = [
      { id: 'first', name: 'Mpesa Paybill', paymentMethod: 'Mpesa', category: 'telco', status: 'active' },
      { id: 'second', name: 'Mpesa Till', paymentMethod: 'Mpesa', category: 'telco', status: 'active' },
    ];
    expect(getDebtCollectionPaymentChannels({ paymentModes: ['Mpesa'] }, accounts, options)).toHaveLength(0);
  });

  it('does not mutate channel settings while resolving a payment', () => {
    const original: PaymentChannel[] = [
      { id: 'legacy', name: 'Mpesa', category: 'telco', status: 'active' },
    ];
    const copy = JSON.stringify(original);
    const result = getDebtCollectionPaymentChannels({ paymentModes: ['Mpesa'] }, original, options);
    expect(result[0]?.id).toBe('legacy');
    expect(JSON.stringify(original)).toBe(copy);
  });
});
