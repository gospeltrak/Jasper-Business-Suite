import { getDynamicSupabaseClient } from '../supabaseClient';

const deviceStorageKey = 'jasper_device_id';
const sessionStorageKey = 'jasper_cloud_session_id';

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
  const client: any = await getDynamicSupabaseClient();
  const { data, error } = await client.rpc('start_user_session', {
    p_device_id: getDeviceId(),
    p_device_label: getDeviceLabel(),
    p_user_agent: navigator.userAgent.slice(0, 500)
  });
  if (error) throw error;
  if (!data?.allowed) return { allowed: false, reason: data?.reason || 'Unable to start this session.' };
  sessionStorage.setItem(sessionStorageKey, data.session_id);
  return { allowed: true };
}

export async function touchCloudSession() {
  const sessionId = sessionStorage.getItem(sessionStorageKey);
  if (!sessionId) return;
  try {
    const client: any = await getDynamicSupabaseClient();
    await client.rpc('touch_user_session', { p_session_id: sessionId });
  } catch {
    // A later heartbeat or reconnect will retry without blocking the user.
  }
}

export async function endCloudSession() {
  const sessionId = sessionStorage.getItem(sessionStorageKey);
  if (!sessionId) return;
  try {
    const client: any = await getDynamicSupabaseClient();
    await client.rpc('end_user_session', { p_session_id: sessionId });
  } finally {
    sessionStorage.removeItem(sessionStorageKey);
  }
}
