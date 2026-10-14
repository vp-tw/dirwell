# Private downloads with an application-owned session

This Node recipe composes `@dirwell/server` with a current session resolver and a fresh nonce CSP. It demonstrates a fixed approved root; it does not implement login, issue cookies or provide a session store.

Install `@dirwell/server` and the desired theme. Copy `handler.mjs` and `bridge.mjs` into your Node project. Integrate your existing application session:

```js
import { createLedgerTheme } from "@dirwell/theme-ledger";
import { createPrivateDownloads } from "./handler.mjs";
import { startPrivateDownloads } from "./bridge.mjs";
const handler = await createPrivateDownloads({
  root: "./approved-downloads",
  theme: createLedgerTheme(),
  getSession: async (request) => {
    const session = await yourApp.resolveSession(request);
    return session
      ? {
          canDownload: session.canAccessApprovedDownloads,
          expiresAt: session.expiresAt,
        }
      : null;
  },
});
const server = await startPrivateDownloads(handler);
console.log(`${server.url}/downloads/browse/`);
// Await server.close() during host shutdown.
```

Install `@dirwell/theme-ledger` for this sample. `yourApp` represents your existing trusted session service; the resolver must bind the capability to this root and return current expiry/revocation state, with `expiresAt` in epoch milliseconds. Browser clients require the host's normal same-origin session cookie. This recipe never places credentials in URLs or public records.

The outer gate covers documents, JSON, blocks, theme assets, byte ranges, conditional requests and SSE. The same resolver is called by Dirwell while an SSE connection is active. Allowing a parent listing reveals its selected child names: isolate tenants/roles in separate approved roots or select only approved files. This is not row-level redaction. Do not put private-target aliases in an approved tree. Existing downloads and content already delivered to a client cannot be retracted by later revocation.

CSP uses a fresh nonce with `strict-dynamic` for scripts and blocks inline event handlers/eval. Stylesheet elements are nonced; measured row positions still require inline style attributes. That explicit style permission grants no script permission. The recipe supports official production HTML, not arbitrary untrusted HTML or Vite's development client. Use a root URL strategy rather than `html-base`, because `base-uri 'none'` rejects base elements. Extend image/font directives only for deliberately configured external brand assets. See [W3C CSP3](https://www.w3.org/TR/CSP3/#strict-dynamic-usage) and [style attribute rules](https://www.w3.org/TR/CSP3/#directive-style-src-attr).

Run `pnpm exec playwright test test/browser/private-downloads.spec.mjs --browser chromium` from the repository for the executable synthetic-session acceptance. No real credentials or production folder are used.

## Add document styles without source compilation

`branding.mjs` wraps the official typed `render(context)` contract, adds a stylesheet asset through `RenderedPage.assets`, and links it with `context.assetHref`. It preserves the theme name, public data projection, client and navigation. Add `@dirwell/core` when importing this helper.

```js
import { withApplicationBranding } from "./branding.mjs";
const theme = withApplicationBranding(
  createLedgerTheme({
    brand: { name: "Approved downloads", footerText: "Project files" },
    cssVariables: { "--dw-font-family": "system-ui" },
  }),
);
```

Shared brand/CSS inputs are available in `0.0.1`. Use source snippets/slots for advanced body structure. The added document head and stylesheet belong to the application; they are constant for the theme and stay present during enhanced folder navigation. Choose an asset name that cannot collide with selected source files. For static generation prefer `urlStrategy: 'base'` with the deployed root so application resources keep stable rooted URLs; serve the complete generated tree. Nonces are a response-composition concern for private live HTML, not a serializable theme setting or a credential.
