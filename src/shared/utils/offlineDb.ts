import { Capacitor } from '@capacitor/core';
import { Sale, Purchase } from '../../types';
import { warnOfflineWriteBlocked } from './onlineOnly';

const DB_NAME = 'jasper-offline-db';
const DB_VERSION = 2;
const SALES_STORE_NAME = 'pending_sales';
const PURCHASES_STORE_NAME = 'pending_purchases';

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
      if (!db.objectStoreNames.contains(SALES_STORE_NAME)) {
        db.createObjectStore(SALES_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PURCHASES_STORE_NAME)) {
        db.createObjectStore(PURCHASES_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Shared CRUD against one IndexedDB object store -- savePendingSaleOffline
// and savePendingPurchaseOffline etc. below are thin, type-specific names
// over this, so call sites stay self-explanatory without repeating the
// same transaction boilerplate per record type.
async function savePendingRecord<T extends { id: string }>(storeName: string, record: T, label: string): Promise<void> {
  if (!isNativeOfflineCapable()) {
    warnOfflineWriteBlocked(`${label}:${record?.id || 'unknown'}`);
    return;
  }
  if (!record?.id) throw new Error(`Cannot queue an offline ${label} without an id.`);
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getPendingRecords<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error(`Failed to read pending records from IndexedDB store ${storeName}:`, err);
    return [];
  }
}

async function deletePendingRecord(storeName: string, id: string, label: string): Promise<void> {
  if (!isNativeOfflineCapable()) {
    warnOfflineWriteBlocked(`${label}:${id}`);
    return;
  }
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function clearPendingRecords(storeName: string, label: string): Promise<void> {
  if (!isNativeOfflineCapable()) {
    warnOfflineWriteBlocked(label);
    return;
  }
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const savePendingSaleOffline = (sale: Sale) => savePendingRecord(SALES_STORE_NAME, sale, 'savePendingSaleOffline');
export const getPendingSales = () => getPendingRecords<Sale>(SALES_STORE_NAME);
export const deletePendingSale = (id: string) => deletePendingRecord(SALES_STORE_NAME, id, 'deletePendingSale');
export const clearPendingSales = () => clearPendingRecords(SALES_STORE_NAME, 'clearPendingSales');

export const savePendingPurchaseOffline = (purchase: Purchase) => savePendingRecord(PURCHASES_STORE_NAME, purchase, 'savePendingPurchaseOffline');
export const getPendingPurchases = () => getPendingRecords<Purchase>(PURCHASES_STORE_NAME);
export const deletePendingPurchase = (id: string) => deletePendingRecord(PURCHASES_STORE_NAME, id, 'deletePendingPurchase');
export const clearPendingPurchases = () => clearPendingRecords(PURCHASES_STORE_NAME, 'clearPendingPurchases');
