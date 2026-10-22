import { Capacitor } from '@capacitor/core';
import { Sale } from '../../types';
import { warnOfflineWriteBlocked } from './onlineOnly';

const DB_NAME = 'jasper-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

// Real offline writes are a native-APK-only feature (see CLAUDE.md /
// capacitor.config.ts notes): the PWA/web build stays 100% online-only.
// Guarding here too means a mistaken call from web code is a safe no-op
// instead of silently creating a browser-only IndexedDB record nobody syncs.
const isNativeOfflineCapable = (): boolean => Capacitor.isNativePlatform();

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
  if (!isNativeOfflineCapable()) {
    warnOfflineWriteBlocked(`savePendingSaleOffline:${sale?.id || 'unknown-sale'}`);
    return;
  }
  if (!sale?.id) throw new Error('Cannot queue an offline sale without an id.');
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
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
  if (!isNativeOfflineCapable()) {
    warnOfflineWriteBlocked(`deletePendingSale:${id}`);
    return;
  }
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function clearPendingSales(): Promise<void> {
  if (!isNativeOfflineCapable()) {
    warnOfflineWriteBlocked('clearPendingSales');
    return;
  }
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
