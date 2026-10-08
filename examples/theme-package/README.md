# External theme package proof

This private example is packed and installed separately from the Dirwell
tarball by `pnpm verify:package`. Its peer dependency pins the alpha version it
is tested against. It imports only `@vp-tw/dirwell`; there are no repository
source imports or inherited design tokens.

```ts
import { defineConfig } from "@vp-tw/dirwell";
import { createExampleTheme } from "dirwell-example-theme";

export default defineConfig({
  root: "files",
  theme: createExampleTheme({ title: "Downloads" }),
});
```

The factory owns its options and validates its title. It escapes entry names,
uses the prepared navigation helpers, handles skipped/unavailable destinations,
and owns a stylesheet referenced with `assetHref()`. The same renderer works
with SSG, MPA, relative URLs, and an HTML base.

The example is private to prevent accidental publication. A real theme package
should choose its own package name and publish configuration, test against each
supported Dirwell version, and carry its own license and asset notices. See
[the alpha package contract](../../THEME_PACKAGE_CONTRACT.md).
