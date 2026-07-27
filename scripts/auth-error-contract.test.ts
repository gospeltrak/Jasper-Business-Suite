import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getSafeErrorMessage } from '../shared/safeErrors';
import { createSafeServerError } from '../serverSafeErrors';
import { toUserFacingError } from '../src/utils/safeError';

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('sign-in errors are actionable and localized without technical language', () => {
  const english = getSafeErrorMessage('AUTH_ERROR', 'en', 'sign_in');
  const swahili = getSafeErrorMessage('AUTH_ERROR', 'sw', 'sign_in');
  assert.match(english, /email|phone/i);
  assert.match(swahili, /barua pepe|simu/i);
  assert.doesNotMatch(english, /jwt|supabase|database|token/i);
  assert.doesNotMatch(swahili, /jwt|supabase|database|token/i);
  assert.match(getSafeErrorMessage('PERMISSION_ERROR', 'en', 'sign_in'), /correct business/i);
});

test('registration provider failures are mapped to safe categories', () => {
  const duplicate = createSafeServerError(
    { code: 'user_already_exists', message: 'User with this email already registered in auth.users' },
    { context: 'registration', fallbackCode: 'SAVE_ERROR', logger: false },
  );
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'DUPLICATE_ERROR');
  assert.doesNotMatch(duplicate.body.message, /auth\.users|provider|supabase/i);

  const databaseFailure = createSafeServerError(
    new Error('relation tenant_workspaces does not exist'),
    { context: 'registration', fallbackCode: 'SAVE_ERROR', logger: false },
  );
  assert.equal(databaseFailure.body.code, 'SAVE_ERROR');
  assert.doesNotMatch(databaseFailure.body.message, /relation|tenant_workspaces|database/i);
});

test('authentication logging redacts credentials and personal identifiers', () => {
  const entries: any[] = [];
  createSafeServerError(
    new Error('User owner@example.com phone +255712345678 tenant 9c7a2c19-67c0-4f45-8a4f-182857c9f238 failed'),
    {
      context: 'sign_in',
      fallbackCode: 'LOAD_ERROR',
      logger: entry => entries.push(entry),
    },
  );
  const serialized = JSON.stringify(entries[0]);
  assert.doesNotMatch(serialized, /owner@example\.com/);
  assert.doesNotMatch(serialized, /255712345678/);
  assert.doesNotMatch(serialized, /9c7a2c19-67c0-4f45-8a4f-182857c9f238/);
  assert.match(serialized, /\[REDACTED_(?:EMAIL|PHONE|ID)\]/);
});

test('frontend auth mapping never renders raw provider messages', () => {
  const authError = toUserFacingError(
    { status: 401, message: 'Invalid JWT: refresh_token_not_found' },
    { language: 'en', context: 'sign_in', fallbackCode: 'AUTH_ERROR' },
  );
  assert.equal(authError.code, 'AUTH_ERROR');
  assert.doesNotMatch(authError.message, /jwt|refresh_token/i);

  const timeout = toUserFacingError(
    { name: 'AbortError', message: 'profile request timed out at /auth/v1/user' },
    { language: 'sw', context: 'sign_in', fallbackCode: 'LOAD_ERROR' },
  );
  assert.equal(timeout.code, 'TIMEOUT_ERROR');
  assert.doesNotMatch(timeout.message, /auth\/v1|abort/i);
});

test('authentication API routes do not return raw exception messages', () => {
  const source = readProjectFile('server.ts');
  const profileBlock = source.slice(
    source.indexOf("app.get('/api/auth/profile'"),
    source.indexOf('const getAuthenticatedBackendUser'),
  );
  const sessionBlock = source.slice(
    source.indexOf("app.post('/api/auth/session/start'"),
    source.indexOf("app.get('/api/auth/config'"),
  );
  const registrationBlock = source.slice(
    source.indexOf("app.post('/api/auth/register'"),
    source.indexOf('// API Route: Fetch tenant logo by specific tenantId'),
  );

  for (const [label, block] of [
    ['profile', profileBlock],
    ['session', sessionBlock],
    ['registration', registrationBlock],
  ] as const) {
    assert.ok(block.length > 100, `${label} route block could not be inspected`);
    assert.doesNotMatch(block, /(?:error|reason)\s*:\s*(?:error|err)\??\.message/, `${label} exposes error.message`);
    assert.doesNotMatch(block, /json\(\{\s*error\s*:\s*(?:error|err)\??\.message/, `${label} returns a raw exception`);
  }
});

test('LoginPage no longer displays auth infrastructure details or raw catch messages', () => {
  const source = readProjectFile('src/components/LoginPage.tsx');
  assert.doesNotMatch(source, /setError\(\s*(?:err|error)\??\.message/);
  assert.doesNotMatch(source, /profile JWT/);
  assert.doesNotMatch(source, /protected database environment keys/);
  assert.doesNotMatch(source, /Usajili unahitaji mtandao[\s\S]*Registration requires an internet connection/);
  assert.match(source, /toUserFacingError/);
  assert.match(source, /X-Jasper-Language/);
});
