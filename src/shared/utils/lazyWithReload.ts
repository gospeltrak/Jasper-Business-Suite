import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// A missing deployment chunk should surface in the screen boundary instead
// of restarting an active sale/form. Users can choose the manual Refresh
// action after saving their work. The function name stays for compatibility.
const getErrorText = (error: unknown): string => {
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase();
  return String(error || '').toLowerCase();
};

export const isLazyChunkLoadError = (error: unknown): boolean => {
  const message = getErrorText(error);
  return [
    'chunkloaderror',
    'loading chunk',
    'failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'importing a module script failed',
    'failed to load module script',
  ].some(pattern => message.includes(pattern));
};

/** Import lazily but never refresh the entire running application automatically. */
export const lazyWithReload = <T extends ComponentType<any>>(
  _moduleName: string,
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> => lazy(importer);
