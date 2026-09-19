import { spawn } from 'node:child_process';

export function checkCliAvailable() {
  return new Promise((resolve) => {
    const child = spawn('hs', ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

// Every invocation carries its own HUBSPOT_ACCOUNT_ID / HUBSPOT_PERSONAL_ACCESS_KEY
// via --use-env, scoped to this one child_process's environment. This deliberately
// avoids ever touching the shared ~/.hscli config file (hs account add/init), so
// concurrent deploys to different client portals can never see each other's
// credentials or race on a shared config write.
function runHsCommand({ args, label, projectDir, hubspotAccountId, personalAccessKey, onLog }) {
  return new Promise((resolve) => {
    const child = spawn('hs', args, {
      cwd: projectDir,
      env: {
        ...process.env,
        HUBSPOT_ACCOUNT_ID: hubspotAccountId,
        HUBSPOT_PERSONAL_ACCESS_KEY: personalAccessKey
      }
    });

    child.stdout.on('data', (chunk) => onLog?.(chunk.toString('utf8')));
    child.stderr.on('data', (chunk) => onLog?.(chunk.toString('utf8')));

    child.on('error', (error) => {
      onLog?.(`\n[${label} failed to start] ${error.message}\n`);
      resolve({ exitCode: null, error: error.message });
    });

    // 'close' (not 'exit') guarantees the stdout/stderr 'data' listeners above have
    // already fired for all output — 'exit' can land before stdio is fully flushed.
    child.on('close', (code) => {
      resolve({ exitCode: code, error: null });
    });
  });
}

// --force skips the "project doesn't exist yet, create it?" interactive prompt
// on a portal's first deploy of a given app — required here since this runs
// with no TTY attached and would otherwise hang indefinitely.
export function uploadProject({ projectDir, hubspotAccountId, personalAccessKey, onLog }) {
  return runHsCommand({
    args: ['project', 'upload', '--use-env', '--force', '--no-color'],
    label: 'hs project upload',
    projectDir,
    hubspotAccountId,
    personalAccessKey,
    onLog
  });
}

// Uploading only creates a build in the developer account's Projects list — it
// does NOT make a static-auth private app usable anywhere. It has to be
// separately installed into the target account, which is what makes it show up
// under Connected Apps / the apps nav icon instead of just the dev Projects view.
export function installApp({ projectDir, hubspotAccountId, personalAccessKey, onLog }) {
  return runHsCommand({
    args: ['project', 'install-app', '--use-env', '--force', '--no-color'],
    label: 'hs project install-app',
    projectDir,
    hubspotAccountId,
    personalAccessKey,
    onLog
  });
}
