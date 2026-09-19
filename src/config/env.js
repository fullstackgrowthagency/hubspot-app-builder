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
    host: process.env.HAB_HOST || '127.0.0.1',
    port: Number(process.env.HAB_PORT || 4173)
  };
}
