import { getDynamicSupabaseClient } from '../supabaseClient';

const apiRequest = async (path: string, init: RequestInit = {}) => {
  const client = await getDynamicSupabaseClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Super Admin login is required.');

  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Platform record request failed.');
  return payload;
};

export async function loadPlatformRecord<T>(recordType: string, scopeId = 'global', fallback: T): Promise<T> {
  const query = new URLSearchParams({ type: recordType, scope: scopeId });
  const payload = await apiRequest(`/api/super-admin/platform-records?${query.toString()}`);
  const record = payload.records?.[0];
  return (record?.payload ?? fallback) as T;
}

export async function savePlatformRecord<T>(recordType: string, scopeId: string, value: T): Promise<T> {
  const payload = await apiRequest(`/api/super-admin/platform-records/${encodeURIComponent(recordType)}/${encodeURIComponent(scopeId || 'global')}`, {
    method: 'PUT',
    body: JSON.stringify({ payload: value })
  });
  return (payload.record?.payload ?? value) as T;
}

export async function deletePlatformRecord(recordType: string, scopeId = 'global') {
  return apiRequest(`/api/super-admin/platform-records/${encodeURIComponent(recordType)}/${encodeURIComponent(scopeId)}`, {
    method: 'DELETE'
  });
}

export const defaultHardwareInventory = [
  { id: 'item-1', name: 'Jasper POS Thermal Printer', category: 'Printer', stock: 0, price: 150000 },
  { id: 'item-2', name: 'Barcode Scanner', category: 'Scanner', stock: 0, price: 80000 },
  { id: 'item-3', name: 'Tablet + Standing Set', category: 'Tablet', stock: 0, price: 250000 },
  { id: 'item-4', name: 'Complete System Set', category: 'Bundle', stock: 0, price: 450000 },
];
