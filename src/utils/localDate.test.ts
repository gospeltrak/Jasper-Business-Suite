import { describe, expect, it } from 'vitest';
import { formatLocalDate, localDateToIso, parseLocalDate, timestampToLocalDate } from './localDate';

describe('local calendar date safety', () => {
  it('keeps a late-night sale on the selected local calendar day', () => {
    const lateNight = new Date(2026, 7, 26, 23, 45, 30);
    expect(formatLocalDate(localDateToIso('2026-08-26', lateNight))).toBe('2026-08-26');
  });

  it('keeps date-only expense records on their selected local day', () => {
    expect(timestampToLocalDate(localDateToIso('2026-08-26', new Date(), 12))).toBe('2026-08-26');
  });

  it('parses report boundaries as local dates instead of UTC midnight', () => {
    expect(formatLocalDate(parseLocalDate('2026-08-26'))).toBe('2026-08-26');
  });
});
