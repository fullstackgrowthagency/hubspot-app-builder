# Open items

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

## Not yet verified — needs a real deploy against a live portal

- An actual `hs project upload` + `hs project deploy` against a real HubSpot
  developer test account has not been run. Do this before pointing the tool at
  a real client portal.
- Whether `requiredScopes: ["oauth"]` alone (no CRM scopes) is sufficient for an
  app that only opens a modal and makes no CRM API calls — HubSpot's own examples
  always included CRM scopes because their sample apps also touched contacts;
  ours doesn't need to, but this should be confirmed by an actual successful
  validate/upload.
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
