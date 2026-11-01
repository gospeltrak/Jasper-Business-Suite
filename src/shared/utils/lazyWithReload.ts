import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

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

/**
 * Keep module imports lazy and cached by React, but NEVER automatically reload
 * the entire app when a deployment has replaced a chunk. That interrupts
 * unsaved product forms, active POS carts, and the Android cashier workflow.
 * Our existing screen error boundary offers an explicit manual Refresh action
 * when the user is ready. The next normal app launch loads the new version.
 */
export const lazyWithReload = <T extends ComponentType<any>>(
  _moduleName: string,
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> => lazy(importer);
