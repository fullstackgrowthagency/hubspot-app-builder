import crypto from 'node:crypto';
import path from 'node:path';
import { getEnv } from '../config/env.js';
import { readJson, writeJson } from '../lib/fs.js';
import { getPortalCredentials } from '../portals/service.js';
import { uploadProject } from './hs-cli.js';

function deployPath(deployId) {
  const env = getEnv();
  return path.join(env.dataDir, 'deploys', `${deployId}.json`);
}

export async function getDeploy(deployId) {
  return readJson(deployPath(deployId));
}

// Starts the deploy and returns immediately with the deployId; the upload itself
// keeps running and the caller polls getDeploy() (or GET /api/deploys/:id) for
// status and accumulated log output.
export function startDeploy({ portalSlug, appSlug, projectDir }) {
  const deployId = crypto.randomUUID();
  const record = {
    deployId,
    portalSlug,
    appSlug,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    log: ''
  };

  (async () => {
    await writeJson(deployPath(deployId), record);

    let credentials;
    try {
      credentials = await getPortalCredentials(portalSlug);
    } catch (error) {
      record.status = 'failed';
      record.finishedAt = new Date().toISOString();
      record.log += `\n[deploy setup failed] ${error.message}\n`;
      await writeJson(deployPath(deployId), record);
      return;
    }

    // Chain writes through a single promise so concurrent stdout/stderr chunks
    // can't race each other and clobber the on-disk log with a stale snapshot.
    let writeQueue = Promise.resolve();
    const appendLog = (chunk) => {
      record.log += chunk;
      writeQueue = writeQueue.then(() => writeJson(deployPath(deployId), record));
    };

    const { exitCode, error } = await uploadProject({
      projectDir,
      hubspotAccountId: credentials.hubspotAccountId,
      personalAccessKey: credentials.personalAccessKey,
      onLog: appendLog
    });
    await writeQueue;

    record.exitCode = exitCode;
    record.finishedAt = new Date().toISOString();
    record.status = exitCode === 0 ? 'succeeded' : 'failed';
    if (error) record.log += `\n[error] ${error}\n`;
    await writeJson(deployPath(deployId), record);
  })();

  return deployId;
}
