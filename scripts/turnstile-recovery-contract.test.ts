import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const widget = fs.readFileSync('src/shared/components/TurnstileWidget.tsx','utf8');
const affiliate = fs.readFileSync('src/modules/affiliate/components/AffiliatePortal.tsx','utf8');
const login = fs.readFileSync('src/modules/auth/LoginPage.tsx','utf8');
const server = fs.readFileSync('server.ts','utf8');

test('Cloudflare renders explicitly and never doubles with implicit widget scanning', () => {
  assert.match(widget, /api\.js\?render=explicit/);
  assert.match(widget, /window\.turnstile\.render\(containerRef\.current/);
  assert.doesNotMatch(widget, /className="cf-turnstile"/);
  assert.match(widget, /window\.turnstile\.remove\(widgetIdRef\.current\)/);
});

test('Cloudflare challenge is manually retryable after load, error, timeout and expiry', () => {
  assert.match(widget, /'error-callback'/);
  assert.match(widget, /'timeout-callback'/);
  assert.match(widget, /'expired-callback'/);
  assert.match(widget, /scriptLoadPromise = null/);
  assert.match(widget, /setAttempt\(value => value \+ 1\)/);
  assert.match(widget, />\s*Jaribu tena\s*</);
  assert.match(widget, /resetKey = 0/);
  assert.match(widget, /size: 'flexible'/);
});

test('affiliate email login and Google login use server verification and reset consumed tokens', () => {
  assert.match(affiliate, /verifyAffiliateTurnstile/);
  assert.match(affiliate, /\/api\/auth\/turnstile/);
  assert.match(affiliate, /finally \{\s*resetTurnstile\(\);\s*\}/);
  assert.match(affiliate, /if \(!\(await verifyAffiliateTurnstile\(\)\)\) return;/);
  assert.match(affiliate, /resetKey=\{turnstileResetKey\}/);
  assert.match(affiliate, /if \(!usingGoogle && \(import\.meta as any\)\.env\?\.VITE_TURNSTILE_SITE_KEY && !turnstileToken\)/);
  assert.match(affiliate, /googleRegistration: usingGoogle/);
  assert.match(server, /googleRegistration \? true : await verifyTurnstileToken/);
  assert.match(server, /getGoogleRequestUser\(req\)/);
});

test('business login and registration discard single-use tokens and avoid redundant email-choice challenges', () => {
  assert.match(login, /verifyLoginTurnstile/);
  assert.match(login, /finally \{[\s\S]{0,260}resetTurnstile\(\)/);
  assert.match(login, /resetKey=\{turnstileResetKey\}/);
  const emailChoice = login.slice(login.indexOf('!showEmailRegisterForm ? ('),login.indexOf('<form className="space-y-5" onSubmit={handleRegisterSubmit}'));
  assert.doesNotMatch(emailChoice, /TurnstileWidget/);
  assert.match(login, /turnstileToken,/);
});

test('server keeps Turnstile fail-closed and limits stalled Cloudflare requests', () => {
  assert.match(server, /return !isProduction/);
  assert.match(server, /signal: AbortSignal\.timeout\(10000\)/);
  assert.match(server, /res\.ok/);
  assert.match(server, /data\?\.success !== true/);
  assert.match(server, /verifyTurnstileToken\(turnstileToken, req\.ip\)/);
  assert.match(server, /app\.post\('\/api\/auth\/turnstile'/);
});
