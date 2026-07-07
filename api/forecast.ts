import type express from 'express';
import { createApp } from '../server.js';

let appPromise: Promise<express.Express> | null = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = createApp({ serveClient: false });
  }
  const app = await appPromise;
  return app(req as any, res as any);
}
