import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SAFE_ERROR_CODES,
  getSafeErrorMessage,
  makeSafeErrorResponse,
  normalizeSafeErrorReference,
} from '../shared/safeErrors';
import {
  PublicSafeError,
  classifyServerError,
  createSafeServerError,
} from '../serverSafeErrors';
import { toUserFacingError } from '../src/utils/safeError';

const FORBIDDEN_USER_TEXT = /\b(?:supabase|postgres(?:ql)?|sql|rls|jwt|stack|schema|constraint|service[_ -]?role|api[_ -]?key|environment variable|tenant[_ -]?id)\b/i;

test('every safe category has non-technical English and Swahili messages', () => {
  for (const code of SAFE_ERROR_CODES) {
    const english = getSafeErrorMessage(code, 'en');
    const swahili = getSafeErrorMessage(code, 'sw');
    assert.ok(english.length >= 20, `${code} English message is incomplete`);
    assert.ok(swahili.length >= 20, `${code} Swahili message is incomplete`);
    assert.equal(FORBIDDEN_USER_TEXT.test(english), false, `${code} English message leaks technical language`);
    assert.equal(FORBIDDEN_USER_TEXT.test(swahili), false, `${code} Swahili message leaks technical language`);
    assert.notEqual(english, swahili, `${code} is not localized`);
  }
});

test('compatibility error field contains only the safe localized message', () => {
  const response = makeSafeErrorResponse('NETWORK_ERROR', 'sw', 'ERR-ABC12345');
  assert.equal(response.success, false);
  assert.equal(response.error, response.message);
  assert.equal(response.reference, 'ERR-ABC12345');
  assert.equal(FORBIDDEN_USER_TEXT.test(response.error), false);
});

test('unsafe support references are discarded', () => {
  assert.equal(normalizeSafeErrorReference('<script>alert(1)</script>'), undefined);
  assert.equal(normalizeSafeErrorReference('tenant-123'), undefined);
  assert.equal(normalizeSafeErrorReference('ERR-ABC12345'), 'ERR-ABC12345');
});

test('frontend mapper never returns raw Supabase or PostgreSQL messages', () => {
  const duplicate = toUserFacingError({
    code: '23505',
    message: 'duplicate key value violates unique constraint users_email_key in PostgreSQL',
  }, { language: 'en', operation: 'save' });

  assert.equal(duplicate.code, 'DUPLICATE_ERROR');
  assert.equal(FORBIDDEN_USER_TEXT.test(duplicate.message), false);
  assert.equal(duplicate.message.includes('users_email_key'), false);
});

test('frontend mapper handles network, timeout, auth, and operation fallbacks', () => {
  assert.equal(toUserFacingError(new TypeError('Failed to fetch')).code, 'NETWORK_ERROR');
  assert.equal(toUserFacingError({ name: 'AbortError', message: 'request aborted' }).code, 'TIMEOUT_ERROR');
  assert.equal(toUserFacingError({ status: 401, message: 'invalid JWT' }).code, 'AUTH_ERROR');
  assert.equal(toUserFacingError(new Error('provider exploded'), { operation: 'upload' }).code, 'FILE_UPLOAD_ERROR');
  assert.equal(toUserFacingError(new Error('provider exploded'), { operation: 'delete' }).code, 'DELETE_ERROR');
});

test('server classifier maps provider codes without exposing provider messages', () => {
  assert.equal(classifyServerError({ code: '42501', message: 'RLS policy denied table tenants' }), 'PERMISSION_ERROR');
  assert.equal(classifyServerError({ code: '23505', message: 'unique constraint violation' }), 'DUPLICATE_ERROR');
  assert.equal(classifyServerError({ code: '22P02', message: 'invalid UUID input syntax' }), 'VALIDATION_ERROR');
});

test('explicit public errors still use catalogue messages instead of arbitrary text', () => {
  const result = createSafeServerError(
    new PublicSafeError('PAYMENT_ERROR', 422),
    { language: 'sw', logger: false },
  );
  assert.equal(result.status, 422);
  assert.equal(result.body.code, 'PAYMENT_ERROR');
  assert.equal(result.body.message, getSafeErrorMessage('PAYMENT_ERROR', 'sw'));
  assert.match(result.body.reference || '', /^ERR-[A-Z0-9]{10}$/);
});

test('server response and structured logs redact secrets', () => {
  const entries: any[] = [];
  const rawError = Object.assign(
    new Error('Supabase rejected password=hunter2 Authorization: Bearer abc.def.ghi api_key=secret-value'),
    { code: '42501', status: 403 },
  );
  const result = createSafeServerError(rawError, {
    operation: 'tenant settings save',
    logger: entry => entries.push(entry),
    metadata: {
      route: '/api/tenant/settings',
      accessToken: 'must-not-be-logged',
      password: 'must-not-be-logged',
    },
  });

  assert.equal(result.body.code, 'PERMISSION_ERROR');
  assert.equal(result.body.message.includes('Supabase'), false);
  assert.equal(result.body.message.includes('hunter2'), false);
  assert.equal(entries.length, 1);
  const serialized = JSON.stringify(entries[0]);
  assert.equal(serialized.includes('hunter2'), false);
  assert.equal(serialized.includes('secret-value'), false);
  assert.equal(serialized.includes('must-not-be-logged'), false);
  assert.match(serialized, /\[REDACTED\]/);
});
