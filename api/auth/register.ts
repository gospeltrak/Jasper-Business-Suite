import type express from 'express';
import { createApp } from '../../server.js';

let appPromise: Promise<express.Express> | null = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = createApp({ serveClient: false });
  }

  // Reuse this auth function for tenant staff login so Hobby deployments stay
  // within Vercel's serverless-function limit.
  if (req.query?.mode === 'staff-login') {
    req.url = '/api/auth/staff-login';
  }

  const app = await appPromise;
  return app(req, res);
}
