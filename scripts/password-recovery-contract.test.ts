import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const bridgeSource = readFileSync(new URL('../src/shared/dataBridge/secureDataBridge.ts', import.meta.url), 'utf8');
const loginSource = readFileSync(new URL('../src/modules/auth/LoginPage.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

// Run the real bridge with simulated Supabase events and browser storage.
// No network calls, credentials or customer accounts are used by these tests.
function loadBridge({ configured = true, search = '', hash = '', storage = new Map<string, string>(), deniedStorage = false } = {}) {
  const clients: any[] = [];
  const context: any = {
    URLSearchParams,
    Response,
    __testEnv: configured ? { VITE_SUPABASE_URL: 'https://auth.example.test', VITE_SUPABASE_ANON_KEY: 'test-key' } : {},
    window: {
      location: { search, hash },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      sessionStorage: {
        getItem(key: string) { if (deniedStorage) throw new Error('denied'); return storage.get(key) ?? null; },
        setItem(key: string, value: string) { if (deniedStorage) throw new Error('denied'); storage.set(key, value); },
        removeItem(key: string) { if (deniedStorage) throw new Error('denied'); storage.delete(key); },
      },
    },
    fetch: async () => ({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ supabaseUrl: 'https://auth.example.test', supabaseAnonKey: 'test-key' }) }),
    createClient(url: string) {
      const listeners: Array<(event: string, session?: unknown) => void> = [];
      const client = {
        url,
        auth: { onAuthStateChange(listener: (event: string, session?: unknown) => void) { listeners.push(listener); return { data: { subscription: { unsubscribe() {} } } }; } },
        emit(event: string, session?: unknown) { for (const listener of listeners) listener(event, session); },
      };
      clients.push(client);
      return client;
    },
  };
  const code = bridgeSource
    .replace(/^import .*from '@supabase\/supabase-js';\n/m, '')
    .replaceAll('(import.meta as any).env', '__testEnv')
    .replace(/^export /gm, '');
  runInNewContext(stripTypeScriptTypes(code) + '\nglobalThis.api = { getSecureDataBridgeClient, isPasswordRecoverySessionActive, subscribeToPasswordRecoverySession, hasPendingSupabaseAuthCallback };', context);
  return { api: context.api, clients, context, storage };
}

test('captures a recovery link before Supabase consumes its URL', () => {
  const { api, context } = loadBridge({ hash: '#access_token=test&type=recovery' });
  assert.equal(api.isPasswordRecoverySessionActive(), true);
  context.window.location.hash = '';
  assert.equal(api.isPasswordRecoverySessionActive(), true);
});

test('a late-mounted login form can read recovery after the event already fired', () => {
  const { api, clients } = loadBridge();
  clients[0].emit('PASSWORD_RECOVERY', { user: { id: 'owner' } });
  assert.equal(api.isPasswordRecoverySessionActive(), true);
});

test('observes recovery on the real client loaded from runtime config', async () => {
  const { api, clients } = loadBridge({ configured: false });
  const client = await api.getSecureDataBridgeClient();
  assert.notEqual(client, clients[0]);
  client.emit('PASSWORD_RECOVERY', { user: { id: 'owner' } });
  assert.equal(api.isPasswordRecoverySessionActive(), true);
  clients[0].emit('INITIAL_SESSION', null);
  assert.equal(api.isPasswordRecoverySessionActive(), true, 'placeholder cannot clear the real recovery session');
});

test('publishes recovery changes to routing and login and supports unsubscribe', () => {
  const { api, clients } = loadBridge();
  let notifications = 0;
  const unsubscribe = api.subscribeToPasswordRecoverySession(() => notifications++);
  clients[0].emit('PASSWORD_RECOVERY', {});
  clients[0].emit('SIGNED_OUT');
  assert.equal(notifications, 2);
  unsubscribe();
  clients[0].emit('PASSWORD_RECOVERY', {});
  assert.equal(notifications, 2);
});

test('keeps recovery active through user updates and token refresh', () => {
  const { api, clients } = loadBridge();
  clients[0].emit('PASSWORD_RECOVERY', {});
  for (const event of ['SIGNED_IN', 'USER_UPDATED', 'TOKEN_REFRESHED', 'INITIAL_SESSION']) {
    clients[0].emit(event, { user: { id: 'owner' } });
    assert.equal(api.isPasswordRecoverySessionActive(), true, event);
  }
});

test('survives a refresh after URL tokens have been consumed and clears on sign-out', () => {
  const first = loadBridge();
  first.clients[0].emit('PASSWORD_RECOVERY', {});
  const refreshed = loadBridge({ storage: first.storage });
  assert.equal(refreshed.api.isPasswordRecoverySessionActive(), true);
  refreshed.clients[0].emit('SIGNED_OUT');
  assert.equal(refreshed.api.isPasswordRecoverySessionActive(), false);
  assert.equal(loadBridge({ storage: first.storage }).api.isPasswordRecoverySessionActive(), false);
});

test('does not lock the recovery screen when the stored session has expired', () => {
  const { api, clients } = loadBridge({ storage: new Map([['jasper_password_recovery_active', 'true']]) });
  clients[0].emit('INITIAL_SESSION', null);
  assert.equal(api.isPasswordRecoverySessionActive(), false);
});

test('ordinary email and Google sessions are not treated as recovery', () => {
  for (const callback of [{}, { search: '?oauth=google&code=test' }, { hash: '#access_token=test&type=signup' }]) {
    const { api, clients } = loadBridge(callback);
    clients[0].emit('SIGNED_IN', { user: { id: 'owner' } });
    assert.equal(api.isPasswordRecoverySessionActive(), false);
  }
});

test('works with denied session storage and checks exact URL parameters', () => {
  const denied = loadBridge({ deniedStorage: true });
  denied.clients[0].emit('PASSWORD_RECOVERY', {});
  assert.equal(denied.api.isPasswordRecoverySessionActive(), true);
  denied.clients[0].emit('SIGNED_OUT');
  assert.equal(denied.api.isPasswordRecoverySessionActive(), false);
  const normal = loadBridge({ search: '?not_type=recovery&xcode=test', hash: '#not_access_token=test' });
  assert.equal(normal.api.isPasswordRecoverySessionActive(), false);
  assert.equal(normal.api.hasPendingSupabaseAuthCallback(), false);
});

function loadPasswordSubmit({ updateError = null as unknown, signOutError = null as unknown, password = 'newPassword123', confirmation = password } = {}) {
  const start = loginSource.indexOf('  const handleSetNewPassword = ');
  const end = loginSource.indexOf('  const handleCheckEmail = ', start);
  const events: string[] = [];
  const context: any = {
    newPassword: password, newPasswordConfirm: confirmation, currentLang: 'en',
    setRecoveryMessage: (message: string) => { if (message) events.push('error'); },
    setIsLoading() {},
    setShowRecovery: (show: boolean) => events.push(show ? 'show-form' : 'hide-form'),
    setResetSent() {}, setNewPassword() {}, setNewPasswordConfirm() {},
    setSuccessMessage: () => events.push('success'),
    toUserFacingError: () => ({ message: 'Password could not be updated.' }),
    getSecureDataBridgeClient: async () => ({ auth: {
      updateUser: async () => { events.push('update-password'); return { error: updateError }; },
      signOut: async () => { events.push('sign-out'); return { error: signOutError }; },
    } }),
  };
  runInNewContext(stripTypeScriptTypes(loginSource.slice(start, end)) + '\nglobalThis.submit = handleSetNewPassword;', context);
  return { events, submit: () => context.submit({ preventDefault() {} }) };
}

test('shows successful login only after password save and sign-out complete', async () => {
  const { events, submit } = loadPasswordSubmit();
  await submit();
  assert.deepEqual(events, ['update-password', 'sign-out', 'hide-form', 'success']);
});

test('a failed password save retains the form and never signs out or reports success', async () => {
  const { events, submit } = loadPasswordSubmit({ updateError: new Error('expired link') });
  await submit();
  assert.deepEqual(events, ['update-password', 'error']);
});

test('a failed sign-out does not hide the recovery form or report completion', async () => {
  const { events, submit } = loadPasswordSubmit({ signOutError: new Error('unavailable') });
  await submit();
  assert.deepEqual(events, ['update-password', 'sign-out', 'error']);
});

test('rejects weak and mismatched passwords before contacting authentication', async () => {
  for (const input of [{ password: 'short' }, { confirmation: 'differentPassword123' }]) {
    const { events, submit } = loadPasswordSubmit(input);
    await submit();
    assert.deepEqual(events, ['error']);
  }
});

async function restoreSession({ recoverDuring = '', recovering = false } = {}) {
  const start = appSource.indexOf('    const restoreCloudSession = ');
  const end = appSource.indexOf('\n    restoreCloudSession();', start);
  const events: string[] = [];
  let recoveryActive = recovering;
  const context: any = {
    cancelled: false,
    isPasswordRecoverySessionActive: () => recoveryActive,
    isPlaceholderSecureDataBridgeClient: () => false,
    getSecureDataBridgeClient: async () => ({
      auth: { getSession: async () => { if (recoverDuring === 'session') recoveryActive = true; return { data: { session: { user: { id: 'owner', email: 'owner@example.test', user_metadata: {} }, access_token: 'test' } } }; } },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { events.push('profile-read'); if (recoverDuring === 'profile') recoveryActive = true; return { data: { id: 'owner', role: 'Admin', tenant_id: 'tenant-a' } }; } }) }) }),
    }),
    resolveProfileRolePermissions: () => ({}),
    startCloudSession: () => events.push('start-session'),
    setUser: () => events.push('restore-user'),
    persistSignedInUser: () => events.push('cache-user'),
    currentPath: '/login', getAuthenticatedRoute: () => '/dashboard',
    window: { history: { replaceState: () => events.push('redirect') } },
    setCurrentPath() {}, console,
  };
  runInNewContext(stripTypeScriptTypes(appSource.slice(start, end)) + '\nglobalThis.restore = restoreCloudSession;', context);
  await context.restore();
  return events;
}

test('never restores a dashboard from a recovery session, including in-flight races', async () => {
  assert.deepEqual(await restoreSession({ recovering: true }), []);
  assert.deepEqual(await restoreSession({ recoverDuring: 'session' }), []);
  assert.deepEqual(await restoreSession({ recoverDuring: 'profile' }), ['profile-read']);
});

test('continues restoring the dashboard for an ordinary authenticated session', async () => {
  assert.deepEqual(await restoreSession(), ['profile-read', 'start-session', 'restore-user', 'cache-user', 'redirect']);
});
