import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnv } from '../config/env.js';
import { ensureDir, writeJson } from '../lib/fs.js';
import { slugify } from '../lib/slug.js';
import { renderTemplateString } from './render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, '../../templates/iframe-app');
const PLATFORM_VERSION = '2026.09';

const TEXT_EXTENSIONS = new Set(['.json', '.jsx', '.js', '.md']);

function assertValidTargetUrl(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error(`targetUrl must be a valid absolute URL: ${targetUrl}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('targetUrl must use https:// — HubSpot will not permit iframing an http:// URL.');
  }
  return parsed;
}

// Template values get substituted directly into JSON string literals, single-quoted
// JS string literals, and raw JSX text — not just one syntax. Rather than writing a
// context-aware escaper for all three, reject characters that would break any of
// them; these are display labels, so plain text is all they ever need to be.
const UNSAFE_TEXT_CHARS = /["'\\<>{}]/;

function assertSafeText(label, value) {
  if (UNSAFE_TEXT_CHARS.test(value)) {
    throw new Error(`${label} cannot contain quotes, backslashes, or angle/curly brackets: ${value}`);
  }
}

async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath, base)));
    } else {
      files.push(path.relative(base, fullPath));
    }
  }
  return files;
}

export async function buildProject({
  clientSlug,
  appName,
  navLabel,
  targetUrl,
  description,
  supportEmail
}) {
  if (!clientSlug) throw new Error('clientSlug is required.');
  if (!appName) throw new Error('appName is required.');
  if (!navLabel) throw new Error('navLabel is required.');
  const targetUrlOrigin = assertValidTargetUrl(targetUrl).origin;

  const appSlug = slugify(appName);
  if (!appSlug) throw new Error('appName must contain at least one alphanumeric character.');

  assertSafeText('appName', appName);
  assertSafeText('navLabel', navLabel);
  if (description) assertSafeText('description', description);
  if (supportEmail) assertSafeText('supportEmail', supportEmail);

  const vars = {
    appName,
    appSlug,
    navLabel,
    targetUrl,
    targetUrlOrigin,
    description: description || `Opens ${navLabel} inside HubSpot.`,
    supportEmail: supportEmail || 'support@example.com',
    platformVersion: PLATFORM_VERSION
  };

  const env = getEnv();
  const projectDir = path.join(env.dataDir, 'generated-apps', clientSlug, appSlug);
  await ensureDir(projectDir);

  const files = await walk(TEMPLATE_DIR);
  for (const relativePath of files) {
    const srcPath = path.join(TEMPLATE_DIR, relativePath);
    const destPath = path.join(projectDir, relativePath);
    await ensureDir(path.dirname(destPath));

    const ext = path.extname(relativePath);
    if (TEXT_EXTENSIONS.has(ext)) {
      const raw = await readFile(srcPath, 'utf8');
      await writeFile(destPath, renderTemplateString(raw, vars), 'utf8');
    } else {
      await cp(srcPath, destPath);
    }
  }

  await writeJson(path.join(projectDir, '.generated-by-hab.json'), {
    clientSlug,
    appSlug,
    appName,
    navLabel,
    targetUrl,
    createdAt: new Date().toISOString(),
    platformVersion: PLATFORM_VERSION
  });

  return { projectDir, appSlug, clientSlug };
}
