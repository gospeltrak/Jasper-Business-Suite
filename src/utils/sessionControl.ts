import { getSecureDataBridgeClient } from '../secureDataBridge';

const deviceStorageKey = 'jasper_device_id';
const sessionStorageKey = 'jasper_cloud_session_id';

const withSessionTimeout = <T>(operation: PromiseLike<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('Session service timed out.')), timeoutMs))
  ]);

const getDeviceId = () => {
  let deviceId = localStorage.getItem(deviceStorageKey) || sessionStorage.getItem(deviceStorageKey);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    try {
      localStorage.setItem(deviceStorageKey, deviceId);
    } catch (error) {
      // A large tenant workspace can fill localStorage. The device check must
      // still work, so keep this tab's ID in sessionStorage without deleting data.
      console.warn('Local storage is full; using a tab device ID.', error);
      sessionStorage.setItem(deviceStorageKey, deviceId);
    }
  }
  return deviceId;
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
  let token = '';
  try {
    token = await getAccessToken(accessToken);
  } catch {
    return { allowed: false, reasonCode: 'service_unavailable', reason: 'Could not check active devices. Please try again.' };
  }
  if (!token) return { allowed: false, reasonCode: 'not_authenticated', reason: 'Please sign in again.' };

  const previousSessionId = sessionStorage.getItem(sessionStorageKey);
  if (previousSessionId) {
    await sessionRequest('end', token, { sessionId: previousSessionId }).catch(() => null);
    sessionStorage.removeItem(sessionStorageKey);
  }

  try {
    const data = await sessionRequest('start', token, {
      deviceId: getDeviceId(),
      deviceLabel: getDeviceLabel(),
      userAgent: navigator.userAgent.slice(0, 500)
    });
    if (!data?.allowed) return { allowed: false, reasonCode: data?.reasonCode, reason: data?.reason || 'Unable to start this session.' };
    sessionStorage.setItem(sessionStorageKey, data.sessionId);
    return { allowed: true };
  } catch {
    return { allowed: false, reasonCode: 'service_unavailable', reason: 'Could not check active devices. Please try again.' };
  }
}

export async function touchCloudSession() {
  const sessionId = sessionStorage.getItem(sessionStorageKey);
  if (!sessionId) return;
  try {
    const token = await getAccessToken();
    if (token) await sessionRequest('touch', token, { sessionId });
  } catch {
    // A later heartbeat or reconnect will retry without blocking the user.
  }
}

export async function endCloudSession() {
  const sessionId = sessionStorage.getItem(sessionStorageKey);
  if (!sessionId) return;
  try {
    const token = await getAccessToken();
    if (token) await sessionRequest('end', token, { sessionId });
  } finally {
    sessionStorage.removeItem(sessionStorageKey);
  }
}
