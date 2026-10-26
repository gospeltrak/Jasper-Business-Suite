import { describe, it, expect } from 'vitest';
import {
  permissionNotice, offlineNotice, OFFLINE_CONFIRMATION_MS,
  isAuthorizationDenial, isConnectivityNotice, normalizeActionNotice,
  confirmConnectivityLoss,
} from './actionNoticePolicy';

describe('Quiet bilingual business notifications', () => {
  it('gives staff the same short role denial for read/write/deletion restrictions', () => {
    expect(normalizeActionNotice('You do not have permission to post this Money & Bank transaction.', 'sw',false))
      .toBe('Huna idhini ya kufanya kitendo hiki.');
    expect(normalizeActionNotice('Permission denied','en',false)).toBe(permissionNotice('en'));
    expect(isAuthorizationDenial({code:'42501',message:'redacted database info'})).toBe(true);
    expect(isAuthorizationDenial({status:403})).toBe(true);
    expect(normalizeActionNotice('Huna ruhusa ya kuhifadhi bidhaa','sw',false)).toBe(permissionNotice('sw'));
  });
  it('does not call stock, checkout or validation failures missing permissions', () => {
    for (const text of ['Insufficient stock','Invalid payment amount','Changes could not be saved',
      'Money & Bank could not post this transaction safely.']) {
      expect(isAuthorizationDenial(text)).toBe(false);
      expect(normalizeActionNotice(text,'sw',false)).toBe(text);
    }
  });
  it('does not show noisy temporary connectivity alerts during short outages', () => {
    expect(normalizeActionNotice('Please check your internet connection and try again','sw',false)).toBe(null);
    expect(normalizeActionNotice('Internet connection restored.','en',false)).toBe(null);
    expect(normalizeActionNotice('Failed to fetch','en',false)).toBe(null);
    expect(OFFLINE_CONFIRMATION_MS).toBeGreaterThanOrEqual(5000);
  });
  it('announces only confirmed offline without making a false deleted-data claim', () => {
    expect(normalizeActionNotice('No internet connection','sw',true)).toBe(offlineNotice('sw'));
    expect(offlineNotice('sw')).not.toMatch(/data zako zimefutwa|taarifa zimefutwa/i);
    expect(offlineNotice('en')).not.toMatch(/data (?:was|has been) deleted/i);
    expect(normalizeActionNotice('insufficient stock','en',true)).toBe('insufficient stock');
  });
  it('requires browser offline AND a failed health probe', async () => {
    expect(await confirmConnectivityLoss(()=>false,async()=>false)).toBe(false);
    expect(await confirmConnectivityLoss(()=>true,async()=>true)).toBe(false);
    expect(await confirmConnectivityLoss(()=>true,async()=>false)).toBe(true);
    expect(await confirmConnectivityLoss(()=>true,async()=>{throw Error('timeout')})).toBe(true);
    let offline=true;
    expect(await confirmConnectivityLoss(()=>offline,async()=>{offline=false;throw Error('handoff')})).toBe(false);
  });
  it('does not hide unrelated errors or arbitrary server error messages', () => {
    expect(isConnectivityNotice('The amount must be positive.')).toBe(false);
    expect(normalizeActionNotice('The amount must be positive.','en',false)).toBe('The amount must be positive.');
  });
});
