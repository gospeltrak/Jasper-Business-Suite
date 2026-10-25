
import { describe, expect, it } from 'vitest';
import { selectPaymentAccountsForBranch } from './treasuryBranchAccounts';

const primary='branch-primary';
const secondary='branch-secondary';
const rows=[
  { sourceKey:'cash-key', accountId:'cash-secondary', branchId:secondary, currency:'TZS' },
  { sourceKey:'cash-key', accountId:'cash-primary', branchId:primary, currency:'TZS' },
  { sourceKey:'mpesa-key', accountId:'mpesa-primary', branchId:primary, currency:'TZS' },
  { sourceKey:'mpesa-key', accountId:'mpesa-secondary', branchId:secondary, currency:'TZS' },
];

describe('POS payment accounts are scoped to one branch',()=>{
  it('uses the primary Cash AND M-Pesa accounts, not last matching sourceKey globally',()=>{
    const result=selectPaymentAccountsForBranch(rows,['cash-key','mpesa-key'],primary);
    expect(result.branchId).toBe(primary);
    expect(result.accounts.get('cash-key')?.accountId).toBe('cash-primary');
    expect(result.accounts.get('mpesa-key')?.accountId).toBe('mpesa-primary');
  });
  it('uses secondary branch for both payment types when explicitly selected',()=>{
    const result=selectPaymentAccountsForBranch(rows,['cash-key','mpesa-key'],secondary);
    expect(result.accounts.get('cash-key')?.accountId).toBe('cash-secondary');
    expect(result.accounts.get('mpesa-key')?.accountId).toBe('mpesa-secondary');
  });
  it('works in legacy single-branch accounts without an explicit branch',()=>{
    expect(selectPaymentAccountsForBranch(rows.filter(x=>x.branchId===primary),['mpesa-key']).branchId).toBe(primary);
  });
  it('refuses ambiguity instead of posting money in a randomly selected branch',()=>{
    expect(()=>selectPaymentAccountsForBranch(rows,['mpesa-key'])).toThrow(/Select an active branch/);
  });
  it('rejects a selected account missing from the requested branch',()=>{
    expect(()=>selectPaymentAccountsForBranch(rows,['mpesa-key'],'branch-unknown')).toThrow(/not available/);
  });
  it('rejects split payment across different branches',()=>{
    const mixed=rows.filter(x=>x.accountId==='cash-primary'||x.accountId==='mpesa-secondary');
    expect(()=>selectPaymentAccountsForBranch(mixed,['cash-key','mpesa-key'],primary)).toThrow(/not available/);
  });
  it('refuses two accounts with the same sourceKey within one branch',()=>{
    expect(()=>selectPaymentAccountsForBranch([...rows,{sourceKey:'cash-key',accountId:'another',branchId:primary,currency:'USD'}],['cash-key'],primary)).toThrow(/ambiguous/);
  });
  it('never leaks a source key belonging to another branch into the mapped result',()=>{
    const selected=selectPaymentAccountsForBranch(rows,['mpesa-key'],primary);
    expect([...selected.accounts.values()].every(a=>a.branchId===primary)).toBe(true);
  });
});
