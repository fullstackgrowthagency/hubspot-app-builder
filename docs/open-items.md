# Open items

## Confirmed by a real deploy (2026-09-19)

Ran the full pipeline — web form → generate → `POST /api/apps/:slug/deploy` →
`hs project upload --use-env --force` — against a real HubSpot developer test
account (portal 247447337). Result: build succeeded, both components
(`*_app`, `*_pages`) built and deployed cleanly on the very first attempt, no
template corrections needed.

One fix this run surfaced: `hs project upload` prompts interactively ("project
doesn't exist yet, create it?") on a portal's first deploy of a given app. With
no TTY attached (as in a spawned child_process), this would hang forever.
Fixed by adding `--force` to the upload command in `src/deploy/hs-cli.js`
(`--forceCreate` also works but is deprecated in favor of `--force`).

This also confirmed `requiredScopes: ["oauth"]` alone (no CRM scopes) is
sufficient — the template doesn't request any CRM data, so it doesn't need any.

Two test apps (`hab-test-app`, `hab-pipeline-check`) were deployed into that
dev test account as part of this verification and are still live there;
delete them with `hs project delete` if they're not wanted.

## Confirmed (2026-09-19, follow-up): upload alone does not install the app

The user reported the deployed apps showed up under **Projects** in the HubSpot
developer dashboard but not in **Connected Apps** or the **Apps** section of the
regular HubSpot UI. Root cause: `hs project upload` only creates a build in the
developer account — for a static-auth private app, it has to be separately
**installed** into the target account (`hs project install-app`, or "Install now"
under the project's Distribution tab in the HubSpot UI) before it's usable or
visible outside the dev Projects view. `src/deploy/deploy-service.js` now chains
`installApp` after a successful `uploadProject`.

**Also confirmed by hand**: `install-app` run immediately after a successful
upload reliably 404s with `Couldn't find the public app '<id>'`, even though
`hs project info` / `app-install-status` already report that exact app ID as
existing — an eventual-consistency lag in HubSpot's backend between the service
that creates the app record and the one `install-app` queries. An identical
retry seconds later still failed; success only came after ~45-70s. `install-app`
is idempotent (a second call on an already-installed app reports "already
installed" and exits 0), so `installWithRetry` in `deploy-service.js` retries
with backoff (5s, 10s, 20s, 30s, 30s) rather than failing the deploy outright.
Verified end-to-end through the real API (not just raw CLI): a fresh app
deploy recovered automatically after 3 retries (~35s) with no manual
intervention, `status: succeeded`.

## Confirmed (verified against HubSpot's own source, not guessed)

- Inline `<iframe>` is not supported in UI Extensions. Only `openIframeModal()`
  (a modal, not an inline embed) works. Source: `defaultFiles/CLAUDE.md` and
  `defaultFiles/AGENTS.md` in `HubSpot/hubspot-project-components`, and the
  working example at `HubSpot/ui-extensions-examples/display-iframe-modal`.
- App Pages (`type: "page"` component, fixed `src/app/pages/` directory) went GA
  across all hubs/tiers April 14, 2026, and are usable by private, static-auth
  apps — not gated to public/marketplace apps. Source:
  `HubSpot/hubspot-project-components/2026.09/components/pages/`.
- `openIframeModal({ uri, height, width, title, flush })` is the exact call
  signature. Source: `HubSpot/ui-extensions-examples/display-iframe-modal`.
- `hsproject.json` / `app-hsmeta.json` / `pages-hsmeta.json` schemas used in
  `templates/iframe-app/` are copied structurally from HubSpot's own
  `private-app-get-started-template` and `components/pages` at platform version
  `2026.09` (the CLI's current default).
- Non-interactive deploy: `hs project upload --use-env` with `HUBSPOT_ACCOUNT_ID`
  and `HUBSPOT_PERSONAL_ACCESS_KEY` env vars, confirmed via HubSpot Community
  threads on CI/CD deploys and the `hubspot-project-actions` GitHub Action.
- `hs project create` / `hs project validate` both require an authenticated
  account config to run at all — even local scaffolding calls out to HubSpot's
  API — so this tool cannot fully self-verify without a real Personal Access Key
  from at least one HubSpot account (see below).

## Still not verified

- The deploy above confirms the project builds and deploys cleanly, but nobody
  has visually confirmed the App Page actually shows up in HubSpot's nav/apps
  icon and that the modal opens correctly in a browser — do that before
  deploying to a real client.
- Whether `permittedUrls.iframe` is actually enforced for `openIframeModal`
  targets. HubSpot's own `display-iframe-modal` example left it as `[]` while
  successfully opening Wikipedia in a modal, suggesting it may not be enforced
  today — but this template populates it with the target URL's origin anyway,
  since it's documented as the correct field for this purpose and costs nothing
  to include correctly.
- Whether the target URL itself permits being framed (`X-Frame-Options` /
  `Content-Security-Policy: frame-ancestors`). If a target site sets these
  restrictively, `openIframeModal` will show a blank/blocked frame regardless of
  correct HubSpot configuration. Check this for each real target URL before
  deploying.
- Exact PAK scopes required for `hs project upload` beyond the CLI accepting the
  key at all — confirm against a real account.
