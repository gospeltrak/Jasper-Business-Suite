import { getSecureDataBridgeClient } from '../secureDataBridge';

const deviceStorageKey = 'jasper_device_id';
const sessionStorageKey = 'jasper_cloud_session_id';

const withSessionTimeout = <T>(operation: PromiseLike<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('Session service timed out.')), timeoutMs))
  ]);

const getDeviceId = () => {
  let deviceId = localStorage.getItem(deviceStorageKey);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(deviceStorageKey, deviceId);
  }
  return deviceId;
};

const getDeviceLabel = () => {
  const width = window.innerWidth;
  return width < 768 ? 'Mobile browser' : width < 1024 ? 'Tablet browser' : 'Desktop browser';
};

export async function startCloudSession(): Promise<{ allowed: boolean; reason?: string }> {
  const client: any = await getSecureDataBridgeClient();
  const previousSessionId = sessionStorage.getItem(sessionStorageKey);
  if (previousSessionId) {
    await withSessionTimeout(client.rpc('end_user_session', { p_session_id: previousSessionId }), 4000).catch(() => null);
    sessionStorage.removeItem(sessionStorageKey);
  }

  let result: any;
  try {
    result = await withSessionTimeout(client.rpc('start_user_session', {
      p_device_id: getDeviceId(),
      p_device_label: getDeviceLabel(),
      p_user_agent: navigator.userAgent.slice(0, 500)
    }), 8000);
  } catch (error) {
    // Password and profile have already been verified. Session tracking is an
    // audit feature and must never leave a valid user stuck on the login page.
    console.warn('Session tracking was unavailable; login will continue.', error);
    return { allowed: true };
  }
  const { data, error } = result || {};
  if (error) throw error;
  if (!data?.allowed) return { allowed: false, reason: data?.reason || 'Unable to start this session.' };
  sessionStorage.setItem(sessionStorageKey, data.session_id);
  return { allowed: true };
}

export async function touchCloudSession() {
  const sessionId = sessionStorage.getItem(sessionStorageKey);
  if (!sessionId) return;
  try {
    const client: any = await getSecureDataBridgeClient();
    await withSessionTimeout(client.rpc('touch_user_session', { p_session_id: sessionId }), 4000);
  } catch {
    // A later heartbeat or reconnect will retry without blocking the user.
  }
}

export async function endCloudSession() {
  const sessionId = sessionStorage.getItem(sessionStorageKey);
  if (!sessionId) return;
  try {
    const client: any = await getSecureDataBridgeClient();
    await withSessionTimeout(client.rpc('end_user_session', { p_session_id: sessionId }), 4000);
  } finally {
    sessionStorage.removeItem(sessionStorageKey);
  }
}
