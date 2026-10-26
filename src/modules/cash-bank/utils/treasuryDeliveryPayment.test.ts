import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Delivery } from '../../../types';

const transport = vi.hoisted(() => ({ rpc: vi.fn(), requireOnline: vi.fn() }));
vi.mock('../../../shared/dataBridge/secureDataBridge', () => ({ getSecureDataBridgeClient: async () => ({ rpc: transport.rpc }) }));
vi.mock('../../../shared/utils/onlineOnly', () => ({ requireOnlineBusinessWrite: transport.requireOnline }));
import { collectDeliveryPayment } from './treasuryApi';

const delivery: Delivery = {
  id: 'delivery-a', tenantId: 'tenant-a', branchId: 'branch-a', saleId: 'sale-a',
  customerName: 'Customer', customerPhone: '', items: [], totalAmount: 1000,
  deliveryCost: 125, timestamp: '2026-10-26T01:00:00Z', status: 'Delivered',
  deliveryPaymentStatus: 'collected', treasuryJournalId: 'journal-a',
};

describe('staff delivery collection', () => {
  beforeEach(() => { transport.rpc.mockReset(); transport.requireOnline.mockReset(); });

  it('uses the delivery-only atomic RPC and returns the committed record', async () => {
    transport.rpc.mockResolvedValue({ data: { delivery }, error: null });
    expect(await collectDeliveryPayment('delivery-a', 'mpesa-delivery')).toEqual(delivery);
    expect(transport.rpc).toHaveBeenCalledExactlyOnceWith('collect_current_branch_delivery_payment', {
      p_delivery_id: 'delivery-a', p_source_account_key: 'mpesa-delivery',
    });
    expect(transport.requireOnline).toHaveBeenCalledWith('delivery payment');
  });

  it('does not ask for generic Money & Bank permission or try another posting after a denial', async () => {
    transport.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Internal permission diagnostic' } });
    await expect(collectDeliveryPayment('delivery-a', 'mpesa-delivery')).rejects.toThrow('permission to collect delivery payments in this branch');
    expect(transport.rpc).toHaveBeenCalledTimes(1);
  });

  it('rejects an unconfirmed paid delivery instead of reporting success without a journal', async () => {
    transport.rpc.mockResolvedValue({ data: { delivery: { ...delivery, treasuryJournalId: undefined } }, error: null });
    await expect(collectDeliveryPayment('delivery-a', 'mpesa-delivery')).rejects.toThrow('not confirmed');
  });

  it('allows a confirmed zero-fee delivery without a fabricated money journal', async () => {
    const free = { ...delivery, deliveryCost: 0, treasuryJournalId: undefined };
    transport.rpc.mockResolvedValue({ data: { delivery: free }, error: null });
    expect(await collectDeliveryPayment('delivery-a')).toEqual(free);
    expect(transport.rpc).toHaveBeenCalledWith('collect_current_branch_delivery_payment', {
      p_delivery_id: 'delivery-a', p_source_account_key: null,
    });
  });

  it('keeps website and PWA collection online-only', async () => {
    transport.requireOnline.mockImplementation(() => { throw new Error('Reconnect before saving'); });
    await expect(collectDeliveryPayment('delivery-a', 'mpesa-delivery')).rejects.toThrow('Reconnect before saving');
    expect(transport.rpc).not.toHaveBeenCalled();
  });
});
