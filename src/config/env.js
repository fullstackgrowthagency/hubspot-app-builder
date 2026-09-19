import path from 'node:path';
import { loadDotEnv } from '../lib/env-file.js';

export function getEnv() {
  loadDotEnv();
  const cwd = process.cwd();
  const dataDir = path.resolve(cwd, process.env.HAB_DATA_DIR || './data');

  return {
    cwd,
    dataDir,
    secretKey: process.env.HAB_SECRET_KEY || null,
    // Passenger-style hosting (Hostinger's Node.js app hosting included) assigns
    // its own port via the standard PORT env var and proxies to it — HAB_PORT is
    // only an override for environments that don't set PORT themselves.
    host: process.env.HAB_HOST || '0.0.0.0',
    port: Number(process.env.PORT || process.env.HAB_PORT || 4173),
    basicAuthUser: process.env.HAB_BASIC_AUTH_USER || null,
    basicAuthPassword: process.env.HAB_BASIC_AUTH_PASSWORD || null
  };
}
