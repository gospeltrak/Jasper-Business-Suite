const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatLocalDate = (value: Date | string | number = new Date()): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatLocalMonth = (value: Date | string | number = new Date()): string =>
  formatLocalDate(value).slice(0, 7);

export const localDateToIso = (
  dateOnly: string,
  timeSource: Date = new Date(),
  fixedHour?: number,
): string => {
  const match = DATE_ONLY_RE.exec(String(dateOnly || '').trim());
  if (!match) return timeSource.toISOString();
  const [, year, month, day] = match;
  const target = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    fixedHour ?? timeSource.getHours(),
    fixedHour === undefined ? timeSource.getMinutes() : 0,
    fixedHour === undefined ? timeSource.getSeconds() : 0,
    fixedHour === undefined ? timeSource.getMilliseconds() : 0,
  );
  return Number.isFinite(target.getTime()) ? target.toISOString() : timeSource.toISOString();
};

export const parseLocalDate = (dateOnly: string, hour = 0): Date => {
  const match = DATE_ONLY_RE.exec(String(dateOnly || '').trim());
  if (!match) return new Date(Number.NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, 0, 0, 0);
};

export const timestampToLocalDate = (value?: string | null): string =>
  value ? formatLocalDate(value) : '';
