import { describe, expect, it } from 'vitest';

const renewalEnd = (
  now: string,
  currentEnd: string | null,
  activeSamePackage: boolean,
  durationDays = 30,
) => {
  const nowMs = Date.parse(now);
  const currentEndMs = currentEnd ? Date.parse(currentEnd) : 0;
  const baseMs = activeSamePackage && currentEndMs > nowMs ? currentEndMs : nowMs;
  return new Date(baseMs + durationDays * 86_400_000).toISOString();
};

describe('subscription renewal acceptance cases', () => {
  it('preserves ten unused days and appends thirty days', () => {
    expect(renewalEnd(
      '2026-07-01T00:00:00.000Z',
      '2026-07-11T00:00:00.000Z',
      true,
    )).toBe('2026-08-10T00:00:00.000Z');
  });

  it('preserves the final active day', () => {
    expect(renewalEnd(
      '2026-07-01T12:00:00.000Z',
      '2026-07-02T12:00:00.000Z',
      true,
    )).toBe('2026-08-01T12:00:00.000Z');
  });

  it('starts an expired renewal from the authoritative renewal time', () => {
    expect(renewalEnd(
      '2026-07-10T09:15:00.000Z',
      '2026-07-01T00:00:00.000Z',
      true,
    )).toBe('2026-08-09T09:15:00.000Z');
  });

  it('appends multiple early renewals without resetting the accumulated expiry', () => {
    const first = renewalEnd(
      '2026-07-01T00:00:00.000Z',
      '2026-07-11T00:00:00.000Z',
      true,
    );
    expect(renewalEnd('2026-07-02T00:00:00.000Z', first, true))
      .toBe('2026-09-09T00:00:00.000Z');
  });

  it('handles leap-year boundaries as exact elapsed-day periods', () => {
    expect(renewalEnd(
      '2028-02-20T00:00:00.000Z',
      null,
      false,
    )).toBe('2028-03-21T00:00:00.000Z');
  });
});
