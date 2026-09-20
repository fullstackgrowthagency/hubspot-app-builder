import crypto from 'node:crypto';
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

// This app stores real client credentials and triggers real HubSpot deploys, so
// once it's reachable on the open internet (vs. localhost-only dev use) it needs
// a gate. Opt in by setting HAB_BASIC_AUTH_USER/PASSWORD; left unset, the app
// stays open (fine for localhost-only local development).
if (env.basicAuthUser && env.basicAuthPassword) {
  const expectedUser = Buffer.from(env.basicAuthUser);
  const expectedPass = Buffer.from(env.basicAuthPassword);
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, pass] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
      const userBuf = Buffer.from(user || '');
      const passBuf = Buffer.from(pass || '');
      const userMatches = userBuf.length === expectedUser.length && crypto.timingSafeEqual(userBuf, expectedUser);
      const passMatches = passBuf.length === expectedPass.length && crypto.timingSafeEqual(passBuf, expectedPass);
      if (userMatches && passMatches) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="hubspot-app-builder"');
    res.status(401).send('Authentication required.');
  });
}

// Default 100kb is too small for a base64-encoded icon upload (see routes/apps.js).
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'views')));
app.use('/api/clients', clientsRouter);
app.use('/api/apps', appsRouter);

app.listen(env.port, env.host, () => {
  console.log(`hubspot-app-builder listening on http://${env.host}:${env.port}`);
});
