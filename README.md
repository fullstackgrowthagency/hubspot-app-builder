# hubspot-app-builder

Generates and deploys HubSpot apps that open an external URL for a specific client
portal. Fill in a form (client, app name, target URL), it scaffolds a HubSpot
developer project and deploys it directly into that client's HubSpot account.

## How it actually works in HubSpot (read this first)

HubSpot's UI Extensions platform does **not** support an inline `<iframe>`. The
only supported mechanism for showing an external URL is `openIframeModal()`, which
pops the URL in a modal dialog. So a generated app is a full-page **App Page**
(reachable from HubSpot's Marketplace/apps icon in the top nav, not a permanent
sidebar item) that automatically opens the target URL in that modal on load, with
a button to reopen it if the visitor closes it.

Each app is a **private, static-auth app** deployed directly into one client's
HubSpot portal via a Personal Access Key generated in that portal — no OAuth
install flow, no marketplace listing.

## Prerequisites

1. Node.js 18+
2. For each client portal you'll deploy into: a **Personal Access Key** generated
   from that portal's HubSpot developer/private-app settings, plus that portal's
   numeric HubSpot Account ID. You add these through this app's web form — the
   HubSpot CLI itself is never interactively authenticated (`hs init`/`hs account
   auth`) by this tool; every deploy passes credentials via `--use-env` scoped to
   that one deploy, so multiple client portals' credentials never collide.

The HubSpot CLI (`@hubspot/cli`) is a regular project dependency (not a global
install) — `npm install` alone is enough. `src/deploy/hs-cli.js` always spawns
the local `node_modules/.bin/hs`, never a global one, so this works the same way
on a VPS as it does on Passenger-managed shared hosting where global npm
installs and PATH aren't guaranteed.

## Setup

```
cp .env.example .env
# edit .env and set HAB_SECRET_KEY to a random string — this encrypts stored
# client Personal Access Keys at rest. If this will be reachable on the open
# internet (not just localhost), also set HAB_BASIC_AUTH_USER/PASSWORD.
npm install
npm start
```

Open the printed URL (default `http://127.0.0.1:4173`).

## Deploying (Hostinger or any Node hosting)

1. Point your host's Node.js app setup at this repo (Hostinger hPanel: Websites →
   your domain/subdomain → **Node.js**, set the application root to this repo's
   checkout, and the startup file to `src/server/index.js`; connect it to this
   GitHub repo via hPanel's **Git** deploy feature so pushes to `main` redeploy).
2. **Set environment variables in the host's Node.js app config UI, not a `.env`
   file.** `.env` is gitignored on purpose (it holds a secret), so a Git-based
   deploy never puts one on the server — if you rely on it, `HAB_SECRET_KEY` is
   unset and **the app crashes on every startup attempt** (`src/server/index.js`
   exits immediately when it's missing). The symptom is a **403 Forbidden from
   the host's own web server** (e.g. LiteSpeed's stock error page on Hostinger),
   not an error from this app — because there's no running process for it to
   proxy to. Set at least `HAB_SECRET_KEY`, `HAB_BASIC_AUTH_USER`,
   `HAB_BASIC_AUTH_PASSWORD` in that UI, then restart the app. Leave
   `HAB_HOST`/`HAB_PORT` unset — the app now binds to `0.0.0.0` and respects the
   host's own `PORT` env var automatically, which is what Passenger-style hosting
   (Hostinger included) assigns and proxies to.
3. Run `npm install` (most hosts do this automatically on deploy; some have a
   manual "Run NPM Install" button) — this also pulls in `@hubspot/cli` locally.
4. `data/` must be a writable, persistent directory on the host — it holds the
   encrypted client credentials, generated HubSpot projects, and deploy logs.
   Confirm your host doesn't wipe the app directory (other than via git) between
   deploys, or point `HAB_DATA_DIR` at a persistent path outside the repo
   checkout if it does.
5. Once live, set `HAB_BASIC_AUTH_USER`/`PASSWORD` before telling anyone the URL
   — this app manages real client credentials and can trigger real deploys into
   real HubSpot portals.

## Deploying to Render (free live preview)

Vercel-style serverless hosting doesn't fit this app: a deploy keeps running in
the background after `POST /api/apps/:slug/deploy` returns (so the UI can poll
for status), and a single HubSpot deploy can take 20 seconds to ~2 minutes with
the install-step retry backoff — both break under a platform that freezes/kills
the function right after it responds and caps execution at ~10 seconds.
[Render](https://render.com)'s free tier runs a real persistent Node process
instead, so nothing about this app needs to change to run there.

1. Create a free Render account (no credit card required for a free Web
   Service) and connect it to GitHub.
2. **New → Web Service**, pick `fullstackgrowthagency/hubspot-app-builder`.
   Environment: **Node**. Build command: `npm install`. Start command:
   `npm start`.
3. Set environment variables in Render's dashboard (not a `.env` file, same
   reasoning as the Hostinger section above): `HAB_SECRET_KEY`,
   `HAB_BASIC_AUTH_USER`, `HAB_BASIC_AUTH_PASSWORD`. Leave `PORT`/`HAB_HOST`
   alone — Render assigns `PORT` itself and the app already binds to `0.0.0.0`
   and reads it.
4. Render auto-deploys on every push to `main` once the repo is connected.

**Free-tier trade-offs, know these going in:** the service spins down after
~15 minutes idle, so the first request after a quiet period takes 30-60s to
wake it back up. The disk is **not persistent across redeploys or restarts** —
`data/` (the client registry, generated HubSpot projects, deploy history) resets
each time the service restarts, not just each time you push. That makes the
free tier fine for a live functional preview or one-off test session, but not
a durable home for real client credentials — treat anything added there as
temporary until this moves to a host with persistent storage (a paid Render
disk, a VPS, or similar).

## Project layout

- `templates/iframe-app/` — the HubSpot developer-project template (verified
  against HubSpot's own `hubspot-project-components` and `ui-extensions-examples`
  repos for platform version 2026.09).
- `src/generator/` — fills in the template for a given client/app.
- `src/portals/` — encrypted client/portal credential registry
  (`data/secrets/portals.json`, AES-256-GCM, gitignored).
- `src/deploy/` — wraps `hs project upload --use-env` as a child process per
  deploy, streaming logs back to the UI.
- `src/server/` — the Express app and web form (`GET /`, `/api/clients`,
  `/api/apps`).
- `data/` — gitignored: generated per-client HubSpot projects, deploy logs,
  encrypted portal credentials.

## Open items / not yet verified end-to-end

See `docs/open-items.md`. The template schema is confirmed against HubSpot's
official source, but no real deploy against a live HubSpot portal has been run
yet — do that before deploying to an actual client.
