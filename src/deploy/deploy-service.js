import crypto from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { getEnv } from '../config/env.js';
import { readJson, writeJson } from '../lib/fs.js';
import { getPortalCredentials } from '../portals/service.js';
import { uploadProject, installApp } from './hs-cli.js';

// Turns HubSpot CLI's generic "unable to locate a project configuration file"
// into something actionable: shows exactly which path was checked and, if it's
// missing, whether its parent (the client's generated-apps folder) exists at
// all — that distinguishes "never generated"/wrong slug from "existed, then
// the directory disappeared" (e.g. a host wiping ephemeral disk mid-session).
function describeMissingProject(projectDir) {
  const parentDir = path.dirname(projectDir);
  const lines = [`[diagnostic] Expected HubSpot project at: ${projectDir}`];
  if (existsSync(parentDir)) {
    let siblings;
    try {
      siblings = readdirSync(parentDir);
    } catch (error) {
      siblings = [`<could not list: ${error.message}>`];
    }
    lines.push(`[diagnostic] Parent directory exists. Contents: ${siblings.join(', ') || '(empty)'}`);
  } else {
    lines.push(`[diagnostic] Parent directory does not exist either: ${parentDir}`);
  }
  return lines.join('\n') + '\n';
}

function deployPath(deployId) {
  const env = getEnv();
  return path.join(env.dataDir, 'deploys', `${deployId}.json`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Right after a successful upload, HubSpot's backend has a brief propagation lag
// before the newly-built app is visible to the install endpoint: install-app can
// 404 with "Couldn't find the public app '<id>'" for the app it just built, even
// though `hs project info` / `app-install-status` already see it — confirmed by
// hand (failed immediately and on an instant retry, succeeded after ~45-70s).
// install-app is idempotent (a second call on an already-installed app just
// reports "already installed"), so retrying with backoff is safe.
const INSTALL_RETRY_DELAYS_MS = [5000, 10000, 20000, 30000, 30000];

async function installWithRetry({ projectDir, hubspotAccountId, personalAccessKey, onLog }) {
  let attempt = 0;
  for (;;) {
    const result = await installApp({ projectDir, hubspotAccountId, personalAccessKey, onLog });
    if (result.exitCode === 0) return result;
    if (attempt >= INSTALL_RETRY_DELAYS_MS.length) return result;

    const delay = INSTALL_RETRY_DELAYS_MS[attempt];
    attempt += 1;
    onLog(`\n[install-app attempt ${attempt} failed, likely propagation lag — retrying in ${delay / 1000}s]\n`);
    await sleep(delay);
  }
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

    appendLog('=== hs project upload ===\n');

    const hsprojectPath = path.join(projectDir, 'hsproject.json');
    if (!existsSync(hsprojectPath)) {
      appendLog(describeMissingProject(projectDir));
      await writeQueue;
      record.exitCode = 1;
      record.status = 'failed';
      record.finishedAt = new Date().toISOString();
      await writeJson(deployPath(deployId), record);
      return;
    }

    const upload = await uploadProject({
      projectDir,
      hubspotAccountId: credentials.hubspotAccountId,
      personalAccessKey: credentials.personalAccessKey,
      onLog: appendLog
    });

    // Uploading only creates a build; it doesn't install the app anywhere, so a
    // deploy isn't actually done (and the app won't show up in the client's
    // HubSpot UI) until install-app has also run and succeeded.
    let install = { exitCode: null, error: null };
    if (upload.exitCode === 0) {
      appendLog('\n=== hs project install-app ===\n');
      install = await installWithRetry({
        projectDir,
        hubspotAccountId: credentials.hubspotAccountId,
        personalAccessKey: credentials.personalAccessKey,
        onLog: appendLog
      });
    }
    await writeQueue;

    const exitCode = upload.exitCode === 0 ? install.exitCode : upload.exitCode;
    record.exitCode = exitCode;
    record.finishedAt = new Date().toISOString();
    record.status = exitCode === 0 ? 'succeeded' : 'failed';
    if (upload.error) record.log += `\n[error] ${upload.error}\n`;
    if (install.error) record.log += `\n[error] ${install.error}\n`;
    await writeJson(deployPath(deployId), record);
  })();

  return deployId;
}
