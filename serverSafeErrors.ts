import { randomUUID } from 'node:crypto';
import {
  type SafeErrorCode,
  type SafeErrorContext,
  type SafeErrorLanguage,
  type SafeErrorResponse,
  isSafeErrorCode,
  makeSafeErrorResponse,
  normalizeSafeErrorLanguage,
} from './shared/safeErrors';

type UnknownRecord = Record<string, unknown>;

export interface SafeServerErrorOptions {
  fallbackCode?: SafeErrorCode;
  context?: SafeErrorContext;
  language?: SafeErrorLanguage | string;
  operation?: string;
  status?: number;
  logger?: ((entry: SafeServerLogEntry) => void) | false;
  metadata?: Record<string, unknown>;
}

export interface SafeServerErrorResult {
  status: number;
  body: SafeErrorResponse;
}

export interface SafeServerLogEntry {
  level: 'error';
  event: 'safe_server_error';
  reference: string;
  category: SafeErrorCode;
  status: number;
  operation: string;
  technical: {
    name?: string;
    code?: string;
    status?: number;
    message?: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

export class PublicSafeError extends Error {
  readonly safeCode: SafeErrorCode;
  readonly status: number;

  constructor(safeCode: SafeErrorCode, status?: number) {
    super(safeCode);
    this.name = 'PublicSafeError';
    this.safeCode = safeCode;
    this.status = status || statusForSafeError(safeCode);
  }
}

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]'],
  [/\b(api[_-]?key|apikey|service[_-]?role[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\b\s*[:=]\s*["']?[^,\s"']+/gi, '$1=[REDACTED]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]'],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_KEY]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[REDACTED_ID]'],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]'],
  [/(?<!\d)\+?\d{9,15}(?!\d)/g, '[REDACTED_PHONE]'],
];

const NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
]);

const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT']);
const VALIDATION_CODES = new Set(['22007', '22023', '22P02', '23502', '23514']);
const DUPLICATE_CODES = new Set(['23505']);
const PERMISSION_CODES = new Set(['42501']);
const NOT_FOUND_CODES = new Set(['P0002']);

const toRecord = (value: unknown): UnknownRecord => (
  typeof value === 'object' && value !== null ? value as UnknownRecord : {}
);

const readText = (record: UnknownRecord, key: string): string => {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
};

const readStatus = (record: UnknownRecord): number | undefined => {
  const candidates = [record.status, record.statusCode, record.httpStatus];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isInteger(value) && value >= 400 && value <= 599) return value;
  }
  return undefined;
};

const sanitizeLogText = (value: unknown, maxLength = 1_500): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  let output = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  return output.slice(0, maxLength);
};

const sanitizeMetadata = (metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (!metadata) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 20)) {
    const normalizedKey = key.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64);
    if (!normalizedKey || /password|secret|token|key|authorization|cookie/i.test(normalizedKey)) continue;
    if (typeof value === 'string') {
      sanitized[normalizedKey] = sanitizeLogText(value, 240);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[normalizedKey] = value;
    }
  }
  return Object.keys(sanitized).length ? sanitized : undefined;
};

export function statusForSafeError(code: SafeErrorCode): number {
  switch (code) {
    case 'AUTH_ERROR': return 401;
    case 'PERMISSION_ERROR': return 403;
    case 'NOT_FOUND': return 404;
    case 'TIMEOUT_ERROR': return 408;
    case 'DUPLICATE_ERROR': return 409;
    case 'VALIDATION_ERROR': return 400;
    case 'FILE_UPLOAD_ERROR': return 422;
    case 'PAYMENT_ERROR': return 422;
    default: return 500;
  }
}

export function classifyServerError(error: unknown, fallbackCode: SafeErrorCode = 'UNKNOWN_ERROR'): SafeErrorCode {
  if (error instanceof PublicSafeError) return error.safeCode;

  const record = toRecord(error);
  const declaredCode = record.safeCode || record.errorCode;
  if (isSafeErrorCode(declaredCode)) return declaredCode;

  const status = readStatus(record);
  if (status === 401) return 'AUTH_ERROR';
  if (status === 403) return 'PERMISSION_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 408 || status === 504) return 'TIMEOUT_ERROR';
  if (status === 409) return 'DUPLICATE_ERROR';
  if (status === 400 || status === 422) return fallbackCode === 'UNKNOWN_ERROR' ? 'VALIDATION_ERROR' : fallbackCode;

  const providerCode = readText(record, 'code').toUpperCase();
  if (['EMAIL_EXISTS', 'PHONE_EXISTS', 'USER_ALREADY_EXISTS'].includes(providerCode)) return 'DUPLICATE_ERROR';
  if (['BAD_JWT', 'EMAIL_NOT_CONFIRMED', 'INVALID_CREDENTIALS', 'REFRESH_TOKEN_NOT_FOUND'].includes(providerCode)) return 'AUTH_ERROR';
  if (PERMISSION_CODES.has(providerCode)) return 'PERMISSION_ERROR';
  if (NOT_FOUND_CODES.has(providerCode)) return 'NOT_FOUND';
  if (DUPLICATE_CODES.has(providerCode)) return 'DUPLICATE_ERROR';
  if (VALIDATION_CODES.has(providerCode)) return 'VALIDATION_ERROR';
  if (TIMEOUT_CODES.has(providerCode)) return 'TIMEOUT_ERROR';
  if (NETWORK_CODES.has(providerCode)) return 'NETWORK_ERROR';

  const name = readText(record, 'name').toLowerCase();
  const message = readText(record, 'message').toLowerCase();
  if (name === 'aborterror' || /timed?\s*out|timeout/.test(message)) return 'TIMEOUT_ERROR';
  if (/failed to fetch|network error|network request failed|socket hang up/.test(message)) return 'NETWORK_ERROR';
  if (/jwt|login|session|access token|refresh token|not authenticated|authentication/.test(message)) return 'AUTH_ERROR';
  if (/permission|access denied|row-level security|rls|not authorized/.test(message)) return 'PERMISSION_ERROR';
  if (/already (?:exists|registered)|duplicate|user with this email/.test(message)) return 'DUPLICATE_ERROR';

  return fallbackCode;
}

export function createSafeServerError(
  error: unknown,
  options: SafeServerErrorOptions = {},
): SafeServerErrorResult {
  const fallbackCode = options.fallbackCode || 'UNKNOWN_ERROR';
  const category = classifyServerError(error, fallbackCode);
  const record = toRecord(error);
  const explicitStatus = options.status || (error instanceof PublicSafeError ? error.status : readStatus(record));
  const status = explicitStatus || statusForSafeError(category);
  const reference = `ERR-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  const language = normalizeSafeErrorLanguage(options.language);

  const technical = {
    name: sanitizeLogText(readText(record, 'name'), 80),
    code: sanitizeLogText(readText(record, 'code'), 80),
    status: readStatus(record),
    message: sanitizeLogText(readText(record, 'message')),
    stack: sanitizeLogText(readText(record, 'stack'), 4_000),
  };

  const entry: SafeServerLogEntry = {
    level: 'error',
    event: 'safe_server_error',
    reference,
    category,
    status,
    operation: sanitizeLogText(options.operation || 'unspecified', 120) || 'unspecified',
    technical,
    metadata: sanitizeMetadata(options.metadata),
  };

  if (options.logger !== false) {
    const logger = options.logger || ((logEntry: SafeServerLogEntry) => console.error(JSON.stringify(logEntry)));
    logger(entry);
  }

  return {
    status,
    body: makeSafeErrorResponse(category, language, reference, options.context),
  };
}

export function sendSafeServerError(
  response: { status: (status: number) => { json: (body: SafeErrorResponse) => unknown } },
  error: unknown,
  options: SafeServerErrorOptions = {},
): unknown {
  const safeError = createSafeServerError(error, options);
  return response.status(safeError.status).json(safeError.body);
}
