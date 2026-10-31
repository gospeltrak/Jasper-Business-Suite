/**
 * Orvix Pro — deterministic shift cash reconciliation.
 *
 * This is a pure calculation layer, NOT a write path and not a replacement for
 * the server's immutable journals. The server must provide branch/tenant/shift
 * scoped, independently verified POSTED physical-cash movements only. Neither
 * mobile/card payments nor parked sales belong in this input.
 *
 * All money is calculated in integer minor units to avoid floating point
 * variance (0.1 + 0.2) and to reject NaN/Infinity and unsafe values.
 */
export interface ProShiftCashScope {
  tenantId: string;
  branchId: string;
  cashierId: string;
  shiftId: string;
  currency: string;
  /** Cash already present when shift opened, NOT today's revenue. */
  openingFloat: number;
}

export type ProCashMovementSource =
  | 'sale_cash_collection'
  | 'debt_cash_collection'
  | 'cash_float_injection'
  | 'cash_refund'
  | 'petty_cash_expense'
  | 'drawer_cash_transfer_in'
  | 'drawer_cash_transfer_out'
  | 'cash_adjustment';

export interface ProPostedCashMovement {
  id: string;
  tenantId: string;
  branchId: string;
  cashierId: string;
  shiftId: string;
  currency: string;
  source: ProCashMovementSource;
  direction: 'in' | 'out';
  amount: number;
  /** Only posted movements change the calculated cash position. */
  status: 'posted' | 'pending' | 'reversed';
  /** Distinguish two events with the same source ID if required. */
  journalLineId: string;
}

export interface ProShiftCashResult {
  openingFloat: number;
  postedCashIn: number;
  postedCashOut: number;
  expectedCash: number;
  /** Null until the cashier enters a real physical count. */
  actualCounted: number | null;
  discrepancy: number | null;
  postedMovements: number;
  ignoredPendingMovements: number;
}

export const amountToMinor = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) {
    throw new Error(name + ' must be a finite, non-negative safe monetary amount.');
  }
  // The UI currently uses two-decimal monetary precision; do not silently
  // round inputs such as 0.001 into another actual cash amount.
  const rounded = Math.round(value * 100);
  if (Math.abs(value * 100 - rounded) > 1e-7) {
    throw new Error(name + ' has more than two decimal places.');
  }
  return rounded;
};

const minorToAmount = (value: number): number => value / 100;

const SOURCE_DIRECTIONS: Record<ProCashMovementSource, 'in' | 'out' | 'both'> = {
  sale_cash_collection: 'in',
  debt_cash_collection: 'in',
  cash_float_injection: 'in',
  cash_refund: 'out',
  petty_cash_expense: 'out',
  drawer_cash_transfer_in: 'in',
  drawer_cash_transfer_out: 'out',
  cash_adjustment: 'both',
};

export function calculateProShiftCash(
  shift: ProShiftCashScope,
  movements: readonly ProPostedCashMovement[],
  actualCounted?: number | null,
): ProShiftCashResult {
  for (const [key, value] of Object.entries({
    tenantId: shift.tenantId,
    branchId: shift.branchId,
    cashierId: shift.cashierId,
    shiftId: shift.shiftId,
    currency: shift.currency,
  })) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error('Missing verified shift scope: ' + key);
    }
  }
  const openingMinor = amountToMinor(shift.openingFloat, 'Opening float');
  let inflowMinor = 0;
  let outflowMinor = 0;
  let postedMovements = 0;
  let ignoredPendingMovements = 0;
  const seen = new Map<string, string>();
  for (const movement of movements) {
    // Fail closed rather than silently using another teller's or branch's
    // money in today's drawer reconciliation.
    for (const key of ['tenantId', 'branchId', 'cashierId', 'shiftId', 'currency'] as const) {
      if (movement[key] !== shift[key]) {
        throw new Error('Mismatched ' + key + ' in shift cash movement.');
      }
    }
    if (!movement.id || !movement.journalLineId) {
      throw new Error('Posted cash movement needs a traceable journal line and ID.');
    }
    if (!(movement.source in SOURCE_DIRECTIONS) || !['in', 'out'].includes(movement.direction)) {
      throw new Error('Unknown cash movement source or direction.');
    }
    if (SOURCE_DIRECTIONS[movement.source] !== 'both'
      && SOURCE_DIRECTIONS[movement.source] !== movement.direction) {
      throw new Error('Cash movement direction conflicts with its source.');
    }
    if (!['posted', 'pending', 'reversed'].includes(movement.status)) {
      throw new Error('Cash movement status is invalid.');
    }
    const minor = amountToMinor(movement.amount, 'Cash movement');
    // Both ID and journalLineId identify immutable server events; conflicting
    // duplicates indicate integrity failure and must not be summed.
    const fingerprint = [
      movement.journalLineId, movement.source, movement.direction,
      movement.status, minor,
    ].join('|');
    const previous = seen.get(movement.id);
    if (previous !== undefined) {
      if (previous !== fingerprint) throw new Error('Conflicting duplicated cash event ID.');
      continue;
    }
    seen.set(movement.id, fingerprint);
    if (movement.status !== 'posted') {
      ignoredPendingMovements++;
      continue;
    }
    if (movement.direction === 'in') inflowMinor += minor;
    else outflowMinor += minor;
    if (!Number.isSafeInteger(inflowMinor) || !Number.isSafeInteger(outflowMinor)) {
      throw new Error('Cash movement total exceeds supported monetary range.');
    }
    postedMovements++;
  }
  const expectedMinor = openingMinor + inflowMinor - outflowMinor;
  if (!Number.isSafeInteger(expectedMinor)) {
    throw new Error('Expected cash total exceeds supported monetary range.');
  }
  // Never replace a physical count with the expected amount. In particular,
  // zero is a VALID physically counted amount and must not be treated as empty.
  const hasCount = actualCounted !== undefined && actualCounted !== null;
  const actualMinor = hasCount ? amountToMinor(actualCounted, 'Actual counted cash') : null;
  return {
    openingFloat: minorToAmount(openingMinor),
    postedCashIn: minorToAmount(inflowMinor),
    postedCashOut: minorToAmount(outflowMinor),
    expectedCash: minorToAmount(expectedMinor),
    actualCounted: actualMinor === null ? null : minorToAmount(actualMinor),
    discrepancy: actualMinor === null ? null : minorToAmount(actualMinor - expectedMinor),
    postedMovements,
    ignoredPendingMovements,
  };
}
