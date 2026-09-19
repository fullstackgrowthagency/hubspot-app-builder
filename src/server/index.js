import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { getEnv } from '../config/env.js';
import { clientsRouter } from './routes/clients.js';
import { appsRouter } from './routes/apps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = getEnv();
if (!env.secretKey) {
  console.error('HAB_SECRET_KEY is not set — copy .env.example to .env and set it before starting the server.');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'views')));
app.use('/api/clients', clientsRouter);
app.use('/api/apps', appsRouter);

app.listen(env.port, env.host, () => {
  console.log(`hubspot-app-builder listening on http://${env.host}:${env.port}`);
});
