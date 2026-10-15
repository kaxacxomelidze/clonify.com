# Clonyfy Helper (browser extension)

Clones sites that block automated browsers (Cloudflare, PerimeterX/HUMAN, DataDome…) by
capturing the page **in the user's own browser**, where they already see it, and sending
it to Clonyfy. Clonyfy's servers never try to get past a bot check.

## Flow

1. The user starts a clone on clonyfy.com as usual. The server crawl hits bot protection and
   the job ends in status `needs_helper` (with a one-time capture token).
2. The dashboard shows the "Protected site" card. If the helper is installed (detected
   through `bridge.js`), it skips the card and starts the capture.
3. The first time per site, a small Clonyfy Helper window asks to **Allow** reading that
   site (Chrome's permission prompt needs a click inside the extension). Optionally:
   "Allow on every site I clone" for a standing allow.
4. The helper opens the page (or uses the user's open tab). If the site shows its human
   check, **the user** completes it in that tab; the capture continues on its own.
5. It reads the rendered DOM, the server HTML, the page's files and the public data the
   page rendered from, strips every credential (`sanitize.js`), and uploads to
   `POST /api/helper/capture`. The server builds the clone with the normal pipeline.

## What leaves the browser

Only the public front-end layer. Never cookies, `Set-Cookie`/`Authorization` headers,
tokens, localStorage/sessionStorage, form secrets or request bodies. Data requests are
re-fetched **without cookies**, so account-scoped responses can't be included. The server
strips again and refuses any bundle that still carries credentials. Both strippers are
covered by `backend/packages/cloner/src/__tests__/helperSanitize.test.ts`.

## Permissions

- `scripting` — read the page the user asked to clone.
- `host_permissions`: Clonyfy's own API only (to upload the capture).
- `optional_host_permissions`: requested per site on the user's click (never at install).
- Content script on clonyfy.com only (`bridge.js`), which reads nothing from the page.

## Build and publish

```bash
node extension/build.mjs
```

Creates `extension/dist/clonyfy-helper-<version>.zip` (upload this to the
[Chrome Web Store](https://chrome.google.com/webstore/devconsole) and
[Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge)) and copies it to
`frontend/public/clonyfy-helper.zip` (download fallback until the listing is live).

Once published, set the store link in the frontend build so "Install" is one click:

```
VITE_HELPER_INSTALL_URL=https://chromewebstore.google.com/detail/clonyfy-helper/<id>
```

Without it, the dashboard offers the zip with "Load unpacked" instructions (developer mode).

## Local development

Load `extension/` unpacked in `chrome://extensions` (developer mode). It talks to the
dashboard on `localhost:8080` and the API on `localhost:5000`.
