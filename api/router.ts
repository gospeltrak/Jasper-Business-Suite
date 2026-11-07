import type express from 'express';
import { createApp } from '../server.js';

// Temporary preview-only trace to identify which bundled dependency still calls
// Node's deprecated url.parse(). No production logging or behavior changes.
if (process.env.VERCEL_ENV === 'preview') {
  process.on('warning', (warning: Error & { code?: string }) => {
    if (warning.code === 'DEP0169') {
      console.warn('[DEP0169 preview diagnostic] ' + warning.stack);
    }
  });
}

let appPromise: Promise<express.Express> | null = null;

const getForwardedPath = (value: unknown) => {
  if (Array.isArray(value)) return value.map(String).join('/');
  return String(value || '').replace(/^\/+/, '');
};

export default async function handler(req: any, res: any) {
  if (!appPromise) appPromise = createApp({ serveClient: false });

  // Vercel's req.query getter calls Node's deprecated url.parse() in its runtime.
  // Read the raw URL using the WHATWG API instead, preserving query parameters.
  const incomingUrl = new URL(req.url || '/', 'http://localhost');
  const forwardedPathParam = incomingUrl.searchParams.getAll('path');
  const forwardedPath = getForwardedPath(
    forwardedPathParam.length
      ? forwardedPathParam
      : incomingUrl.pathname.replace(/^\/api\/(?:router\/?|)/, '')
  );
  incomingUrl.searchParams.delete('path');
  req.url = `/api/${forwardedPath}${incomingUrl.search}`;

  // Vercel also installs a legacy req.query getter which Express 4's query
  // middleware reads before our route handlers. Shadow it with an own data
  // property so neither Vercel nor Express invokes deprecated url.parse().
  // Preserve Vercel/querystring-style duplicate keys as string arrays.
  const query: Record<string, string | string[]> = Object.create(null);
  incomingUrl.searchParams.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      const current = query[key];
      query[key] = Array.isArray(current) ? [...current, value] : [current, value];
    } else {
      query[key] = value;
    }
  });
  Object.defineProperty(req, 'query', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: query,
  });

  const app = await appPromise;
  return app(req as any, res as any);
}
