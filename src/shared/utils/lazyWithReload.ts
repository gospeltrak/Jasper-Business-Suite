import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const LAZY_RELOAD_PREFIX = 'jasper_lazy_reload:';
const RELOAD_ATTEMPT_TTL_MS = 2 * 60 * 1000;

const getErrorText = (error: unknown): string => {
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase();
  return String(error || '').toLowerCase();
};

export const isLazyChunkLoadError = (error: unknown): boolean => {
  const text = getErrorText(error);
  return [
    'chunkloaderror',
    'loading chunk',
    'failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'importing a module script failed',
    'failed to load module script',
  ].some(pattern => text.includes(pattern));
};

const shouldReloadOnce = (moduleName: string): boolean => {
  if (typeof window === 'undefined') return false;
  const key = `${LAZY_RELOAD_PREFIX}${moduleName}`;

  try {
    const previousAttempt = Number(window.sessionStorage.getItem(key) || 0);
    if (previousAttempt && Date.now() - previousAttempt < RELOAD_ATTEMPT_TTL_MS) return false;
    window.sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
};

const clearReloadAttempt = (moduleName: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(`${LAZY_RELOAD_PREFIX}${moduleName}`);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
};

/**
 * Recovers from a stale deployment chunk exactly once. Reloading fetches the
 * current manifest while authentication and tenant records stay untouched.
 */
export const lazyWithReload = <T extends ComponentType<any>>(
  moduleName: string,
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> => lazy(async () => {
  try {
    const loadedModule = await importer();
    clearReloadAttempt(moduleName);
    return loadedModule;
  } catch (error) {
    if (isLazyChunkLoadError(error) && shouldReloadOnce(moduleName) && typeof window !== 'undefined') {
      // Schedule the refresh, but still reject this lazy import so the shared
      // boundary remains actionable if a browser blocks or delays the reload.
      window.setTimeout(() => window.location.reload(), 0);
    }
    throw error;
  }
});
