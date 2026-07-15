import { getSecureDataBridgeClient } from '../secureDataBridge';

const deviceStorageKey = 'jasper_device_id';
const sessionStorageKey = 'jasper_cloud_session_id';
let memoryDeviceId: string | null = null;
let memorySessionId: string | null = null;

const withSessionTimeout = <T>(operation: PromiseLike<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('Session service timed out.')), timeoutMs))
  ]);

const getDeviceId = () => {
  let deviceId = memoryDeviceId;
  try {
    deviceId = deviceId || sessionStorage.getItem(deviceStorageKey);
  } catch { /* use the in-memory ID below */ }
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    memoryDeviceId = deviceId;
    try {
      sessionStorage.setItem(deviceStorageKey, deviceId);
    } catch { /* memory ID remains valid for this tab */ }
  }
  memoryDeviceId = deviceId;
  return deviceId;
};

const getStoredSessionId = () => {
  if (memorySessionId) return memorySessionId;
  try { return sessionStorage.getItem(sessionStorageKey); } catch { return null; }
};

const saveSessionId = (sessionId: string) => {
  memorySessionId = sessionId;
  try { sessionStorage.setItem(sessionStorageKey, sessionId); } catch { /* login is still valid in this tab */ }
};

const clearSessionId = () => {
  memorySessionId = null;
  try { sessionStorage.removeItem(sessionStorageKey); } catch { /* nothing else to clear */ }
};

const getDeviceLabel = () => {
  const width = window.innerWidth;
  return width < 768 ? 'Mobile browser' : width < 1024 ? 'Tablet browser' : 'Desktop browser';
};

const getAccessToken = async (provided?: string) => {
  if (provided) return provided;
  const client: any = await getSecureDataBridgeClient();
  const result: any = await withSessionTimeout(client.auth.getSession(), 4000);
  return result?.data?.session?.access_token || '';
};

const sessionRequest = async (path: 'start' | 'touch' | 'end', token: string, body: Record<string, unknown>) => {
  const response = await withSessionTimeout(fetch(`/api/auth/session/${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  }), 8000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.reasonCode) throw new Error(payload?.reason || 'Session service unavailable.');
  return payload;
};

export async function startCloudSession(accessToken?: string): Promise<{ allowed: boolean; reason?: string; reasonCode?: string }> {
  // Record the session in background (fire-and-forget) — never block login
  try {
    let token = '';
    try { token = await getAccessToken(accessToken); } catch { /* ignore */ }

    if (token) {
      const previousSessionId = getStoredSessionId();
      if (previousSessionId) {
        sessionRequest('end', token, { sessionId: previousSessionId }).catch(() => null);
        clearSessionId();
      }

      sessionRequest('start', token, {
        deviceId: getDeviceId(),
        deviceLabel: getDeviceLabel(),
        userAgent: navigator.userAgent.slice(0, 500)
      }).then(data => {
        if (data?.sessionId) saveSessionId(data.sessionId);
      }).catch(() => null);
    }
  } catch { /* never block login due to session errors */ }

  // Always allow login — no device limit
  return { allowed: true };
}

export async function touchCloudSession() {
  const sessionId = getStoredSessionId();
  if (!sessionId) return;
  try {
    const token = await getAccessToken();
    if (token) await sessionRequest('touch', token, { sessionId });
  } catch {
    // A later heartbeat or reconnect will retry without blocking the user.
  }
}

export async function endCloudSession() {
  const sessionId = getStoredSessionId();
  if (!sessionId) return;
  try {
    const token = await getAccessToken();
    if (token) await sessionRequest('end', token, { sessionId });
  } finally {
    clearSessionId();
  }
}
