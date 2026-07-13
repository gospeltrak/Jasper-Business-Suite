import { Sale } from '../types';
import { warnOfflineWriteBlocked } from './onlineOnly';

const DB_NAME = 'jasper-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingSaleOffline(sale: Sale): Promise<void> {
  warnOfflineWriteBlocked(`savePendingSaleOffline:${sale?.id || 'unknown-sale'}`);
}

export async function getPendingSales(): Promise<Sale[]> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to read pending sales from IndexedDB:', err);
    return [];
  }
}

export async function deletePendingSale(id: string): Promise<void> {
  warnOfflineWriteBlocked(`deletePendingSale:${id}`);
}

export async function clearPendingSales(): Promise<void> {
  warnOfflineWriteBlocked('clearPendingSales');
}
