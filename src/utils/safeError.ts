import {
  type SafeErrorCode,
  type SafeErrorContext,
  type SafeErrorPayload,
  isSafeErrorCode,
  makeSafeErrorPayload,
  normalizeSafeErrorReference,
} from '../../shared/safeErrors';

type UnknownRecord = Record<string, unknown>;

export interface UserFacingErrorOptions {
  fallbackCode?: SafeErrorCode;
  context?: SafeErrorContext;
  language?: unknown;
  operation?: 'delete' | 'load' | 'payment' | 'save' | 'upload';
  status?: number;
}

const toRecord = (value: unknown): UnknownRecord => (
  typeof value === 'object' && value !== null ? value as UnknownRecord : {}
);

const readStatus = (record: UnknownRecord, fallback?: number): number | undefined => {
  const values = [fallback, record.status, record.statusCode, record.httpStatus];
  for (const candidate of values) {
    const status = Number(candidate);
    if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  }
  return undefined;
};

const operationFallback = (operation: UserFacingErrorOptions['operation']): SafeErrorCode | undefined => {
  switch (operation) {
    case 'delete': return 'DELETE_ERROR';
    case 'load': return 'LOAD_ERROR';
    case 'payment': return 'PAYMENT_ERROR';
    case 'save': return 'SAVE_ERROR';
    case 'upload': return 'FILE_UPLOAD_ERROR';
    default: return undefined;
  }
};

const classifyClientError = (
  error: unknown,
  options: UserFacingErrorOptions,
): SafeErrorCode => {
  const record = toRecord(error);
  const declaredCode = record.code || record.errorCode || record.reasonCode;
  if (isSafeErrorCode(declaredCode)) return declaredCode;

  const status = readStatus(record, options.status);
  if (status === 401) return 'AUTH_ERROR';
  if (status === 403) return 'PERMISSION_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 408 || status === 504) return 'TIMEOUT_ERROR';
  if (status === 409) return 'DUPLICATE_ERROR';
  if (status === 400 || status === 422) return options.fallbackCode || operationFallback(options.operation) || 'VALIDATION_ERROR';

  const providerCode = typeof record.code === 'string' ? record.code.toUpperCase() : '';
  if (providerCode === '42501') return 'PERMISSION_ERROR';
  if (providerCode === 'P0002') return 'NOT_FOUND';
  if (providerCode === '23505') return 'DUPLICATE_ERROR';
  if (['22007', '22023', '22P02', '23502', '23514'].includes(providerCode)) return 'VALIDATION_ERROR';
  if (['ETIMEDOUT', 'TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'].includes(providerCode)) return 'TIMEOUT_ERROR';
  if (['ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'ENETDOWN', 'ENETUNREACH', 'ENOTFOUND'].includes(providerCode)) {
    return 'NETWORK_ERROR';
  }

  const name = typeof record.name === 'string' ? record.name.toLowerCase() : '';
  const rawMessage = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  if (name === 'aborterror' || /timed?\s*out|timeout/.test(rawMessage)) return 'TIMEOUT_ERROR';
  if (/failed to fetch|network error|network request failed|load failed/.test(rawMessage)) return 'NETWORK_ERROR';
  if (/jwt|login|session|access token|refresh token|not authenticated|authentication/.test(rawMessage)) return 'AUTH_ERROR';
  if (/permission|access denied|row-level security|rls|not authorized/.test(rawMessage)) return 'PERMISSION_ERROR';
  if (/already (?:exists|registered)|duplicate|user with this email/.test(rawMessage)) return 'DUPLICATE_ERROR';

  return options.fallbackCode || operationFallback(options.operation) || 'UNKNOWN_ERROR';
};

/**
 * Converts any untrusted client, API, or provider error into a localized safe
 * payload. Raw `error.message` is used only for classification and is never
 * copied into the returned user-facing message.
 */
export function toUserFacingError(
  error: unknown,
  options: UserFacingErrorOptions = {},
): SafeErrorPayload {
  const record = toRecord(error);
  const nestedError = toRecord(record.error);
  const category = classifyClientError(
    Object.keys(nestedError).length ? { ...record, ...nestedError } : error,
    options,
  );
  const reference = normalizeSafeErrorReference(record.reference || nestedError.reference);
  return makeSafeErrorPayload(category, options.language, reference, options.context);
}
