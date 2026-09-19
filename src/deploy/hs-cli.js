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
export function uploadProject({ projectDir, hubspotAccountId, personalAccessKey, onLog }) {
  return new Promise((resolve) => {
    const child = spawn('hs', ['project', 'upload', '--use-env', '--no-color'], {
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
      onLog?.(`\n[hs project upload failed to start] ${error.message}\n`);
      resolve({ exitCode: null, error: error.message });
    });

    // 'close' (not 'exit') guarantees the stdout/stderr 'data' listeners above have
    // already fired for all output — 'exit' can land before stdio is fully flushed.
    child.on('close', (code) => {
      resolve({ exitCode: code, error: null });
    });
  });
}
