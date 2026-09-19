import path from 'node:path';
import express from 'express';
import { getEnv } from '../../config/env.js';
import { buildProject } from '../../generator/build-project.js';
import { getPortal } from '../../portals/service.js';
import { startDeploy, getDeploy } from '../../deploy/deploy-service.js';
import { checkCliAvailable } from '../../deploy/hs-cli.js';

export const appsRouter = express.Router();

appsRouter.post('/', async (req, res) => {
  try {
    const { clientSlug, appName, navLabel, targetUrl, description, supportEmail } = req.body;
    if (!clientSlug) return res.status(400).json({ error: 'clientSlug is required.' });

    const portal = await getPortal(clientSlug);
    if (!portal) return res.status(404).json({ error: 'Unknown client portal.' });

    const result = await buildProject({ clientSlug, appName, navLabel, targetUrl, description, supportEmail });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

appsRouter.post('/:appSlug/deploy', async (req, res) => {
  const { appSlug } = req.params;
  const { clientSlug } = req.body;
  if (!clientSlug) return res.status(400).json({ error: 'clientSlug is required.' });

  const cliAvailable = await checkCliAvailable();
  if (!cliAvailable) {
    return res.status(503).json({
      error: 'The HubSpot CLI (`hs`) is not installed or not on PATH. Run: npm install -g @hubspot/cli'
    });
  }

  const portal = await getPortal(clientSlug);
  if (!portal) return res.status(404).json({ error: 'Unknown client portal.' });

  const env = getEnv();
  const projectDir = path.join(env.dataDir, 'generated-apps', clientSlug, appSlug);

  const deployId = startDeploy({ portalSlug: clientSlug, appSlug, projectDir });
  res.status(202).json({ deployId });
});

appsRouter.get('/deploys/:deployId', async (req, res) => {
  const deploy = await getDeploy(req.params.deployId);
  if (!deploy) return res.status(404).json({ error: 'Unknown deploy.' });
  res.json(deploy);
});
