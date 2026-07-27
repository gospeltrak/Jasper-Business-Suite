export const SAFE_ERROR_CODES = [
  'AUTH_ERROR',
  'PERMISSION_ERROR',
  'VALIDATION_ERROR',
  'NETWORK_ERROR',
  'NOT_FOUND',
  'DUPLICATE_ERROR',
  'PAYMENT_ERROR',
  'FILE_UPLOAD_ERROR',
  'SAVE_ERROR',
  'DELETE_ERROR',
  'LOAD_ERROR',
  'TIMEOUT_ERROR',
  'UNKNOWN_ERROR',
] as const;

export type SafeErrorCode = (typeof SAFE_ERROR_CODES)[number];
export type SafeErrorLanguage = 'en' | 'sw';
export type SafeErrorContext = 'default' | 'registration' | 'session' | 'sign_in';

export interface SafeErrorPayload {
  code: SafeErrorCode;
  message: string;
  reference?: string;
}

export interface SafeErrorResponse extends SafeErrorPayload {
  success: false;
  /**
   * Temporary compatibility field for existing Jasper API consumers.
   * It must always contain the same sanitized text as `message`.
   */
  error: string;
}

const SAFE_ERROR_CODE_SET = new Set<string>(SAFE_ERROR_CODES);
const SAFE_REFERENCE_PATTERN = /^ERR-[A-Z0-9]{6,16}$/;

const SAFE_ERROR_MESSAGES: Record<SafeErrorLanguage, Record<SafeErrorCode, string>> = {
  en: {
    AUTH_ERROR: 'Your session has expired. Please sign in again.',
    PERMISSION_ERROR: 'You do not have permission to perform this action.',
    VALIDATION_ERROR: 'Please check the information entered and try again.',
    NETWORK_ERROR: 'Please check your internet connection and try again.',
    NOT_FOUND: 'The requested information could not be found.',
    DUPLICATE_ERROR: 'This record already exists. Please review the information and try again.',
    PAYMENT_ERROR: 'Payment could not be completed. Please verify the details and try again.',
    FILE_UPLOAD_ERROR: 'The file could not be uploaded. Check its type and size, then try again.',
    SAVE_ERROR: 'Changes could not be saved. Please try again.',
    DELETE_ERROR: 'The item could not be deleted. Please try again.',
    LOAD_ERROR: 'The information could not be loaded. Please try again.',
    TIMEOUT_ERROR: 'The request took too long. Please try again.',
    UNKNOWN_ERROR: 'Something went wrong. Please try again.',
  },
  sw: {
    AUTH_ERROR: 'Muda wa kuingia umeisha. Tafadhali ingia tena.',
    PERMISSION_ERROR: 'Huna ruhusa ya kufanya kitendo hiki.',
    VALIDATION_ERROR: 'Tafadhali hakiki taarifa ulizoingiza kisha ujaribu tena.',
    NETWORK_ERROR: 'Tafadhali hakiki muunganisho wa intaneti kisha ujaribu tena.',
    NOT_FOUND: 'Taarifa ulizoomba hazikupatikana.',
    DUPLICATE_ERROR: 'Taarifa hii tayari ipo. Tafadhali ihakiki kisha ujaribu tena.',
    PAYMENT_ERROR: 'Malipo hayajakamilika. Tafadhali hakiki taarifa kisha ujaribu tena.',
    FILE_UPLOAD_ERROR: 'Faili halijapakiwa. Hakiki aina na ukubwa wake kisha ujaribu tena.',
    SAVE_ERROR: 'Mabadiliko hayajahifadhiwa. Tafadhali ujaribu tena.',
    DELETE_ERROR: 'Taarifa haijafutwa. Tafadhali ujaribu tena.',
    LOAD_ERROR: 'Taarifa hazijapakiwa. Tafadhali ujaribu tena.',
    TIMEOUT_ERROR: 'Ombi limechukua muda mrefu. Tafadhali ujaribu tena.',
    UNKNOWN_ERROR: 'Hitilafu imetokea. Tafadhali ujaribu tena.',
  },
};

const SAFE_CONTEXT_MESSAGES: Record<
  SafeErrorLanguage,
  Partial<Record<SafeErrorContext, Partial<Record<SafeErrorCode, string>>>>
> = {
  en: {
    sign_in: {
      AUTH_ERROR: 'The email, phone number, or password is incorrect. Please try again.',
      LOAD_ERROR: 'Sign in is temporarily unavailable. Please try again shortly.',
      PERMISSION_ERROR: 'This account cannot access this business. Please use the correct business sign-in.',
      TIMEOUT_ERROR: 'Sign in took too long. Please check your connection and try again.',
    },
    registration: {
      DUPLICATE_ERROR: 'An account with these details already exists. Please sign in or use different details.',
      SAVE_ERROR: 'Your account could not be created. Please check the information and try again.',
      TIMEOUT_ERROR: 'Account creation took too long. Please check your connection and try again.',
    },
    session: {
      AUTH_ERROR: 'Your session has expired. Please sign in again.',
      LOAD_ERROR: 'Your secure session could not be updated. Please try again.',
    },
  },
  sw: {
    sign_in: {
      AUTH_ERROR: 'Barua pepe, namba ya simu, au nenosiri si sahihi. Tafadhali ujaribu tena.',
      LOAD_ERROR: 'Huduma ya kuingia haipatikani kwa muda. Tafadhali ujaribu tena baada ya muda mfupi.',
      PERMISSION_ERROR: 'Akaunti hii haina ruhusa ya kufungua biashara hii. Tafadhali tumia taarifa sahihi za kuingia.',
      TIMEOUT_ERROR: 'Kuingia kumechukua muda mrefu. Hakiki intaneti kisha ujaribu tena.',
    },
    registration: {
      DUPLICATE_ERROR: 'Akaunti yenye taarifa hizi tayari ipo. Tafadhali ingia au tumia taarifa tofauti.',
      SAVE_ERROR: 'Akaunti haijatengenezwa. Tafadhali hakiki taarifa kisha ujaribu tena.',
      TIMEOUT_ERROR: 'Kutengeneza akaunti kumechukua muda mrefu. Hakiki intaneti kisha ujaribu tena.',
    },
    session: {
      AUTH_ERROR: 'Muda wa kuingia umeisha. Tafadhali ingia tena.',
      LOAD_ERROR: 'Muda wako salama wa kutumia mfumo haujasasishwa. Tafadhali ujaribu tena.',
    },
  },
};

export function normalizeSafeErrorLanguage(language: unknown): SafeErrorLanguage {
  return String(language || '').trim().toLowerCase().startsWith('sw') ? 'sw' : 'en';
}

export function isSafeErrorCode(value: unknown): value is SafeErrorCode {
  return typeof value === 'string' && SAFE_ERROR_CODE_SET.has(value);
}

export function getSafeErrorMessage(
  code: SafeErrorCode,
  language: unknown = 'en',
  context: SafeErrorContext = 'default',
): string {
  const normalizedLanguage = normalizeSafeErrorLanguage(language);
  return SAFE_CONTEXT_MESSAGES[normalizedLanguage][context]?.[code]
    || SAFE_ERROR_MESSAGES[normalizedLanguage][code];
}

export function normalizeSafeErrorReference(reference: unknown): string | undefined {
  if (typeof reference !== 'string') return undefined;
  const normalized = reference.trim().toUpperCase();
  return SAFE_REFERENCE_PATTERN.test(normalized) ? normalized : undefined;
}

export function makeSafeErrorPayload(
  code: SafeErrorCode,
  language: unknown = 'en',
  reference?: unknown,
  context: SafeErrorContext = 'default',
): SafeErrorPayload {
  const safeReference = normalizeSafeErrorReference(reference);
  return {
    code,
    message: getSafeErrorMessage(code, language, context),
    ...(safeReference ? { reference: safeReference } : {}),
  };
}

export function makeSafeErrorResponse(
  code: SafeErrorCode,
  language: unknown = 'en',
  reference?: unknown,
  context: SafeErrorContext = 'default',
): SafeErrorResponse {
  const payload = makeSafeErrorPayload(code, language, reference, context);
  return {
    success: false,
    ...payload,
    error: payload.message,
  };
}
