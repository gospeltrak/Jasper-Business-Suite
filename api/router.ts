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

  const forwardedPath = getForwardedPath(req.query?.path);
  const incomingUrl = new URL(req.url || '/', 'http://localhost');
  incomingUrl.searchParams.delete('path');
  req.url = `/api/${forwardedPath}${incomingUrl.search}`;

  const app = await appPromise;
  return app(req as any, res as any);
}
