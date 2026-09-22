---
title: Configuration
description: Configure paths, output, themes, and symlink behavior with TypeScript.
---

Dirwell discovers `dirwell.config.ts` from `--cwd`. Configuration is loaded by
c12 and validated at runtime before filesystem work begins.

```ts
import { defineConfig } from "dirwell";

export default defineConfig({
  root: ".",
  outDir: "dist",
  mode: "ssg",
  mirror: true,
});
```

## Dynamic configuration

The config may be a function. The command is explicit so asynchronous timing
and command-specific behavior are predictable.

```ts
export default defineConfig(({ command }) => ({
  outDir: command === "serve" ? ".dirwell-preview" : "dist",
}));
```

## Extending local configuration

```ts
export default defineConfig({
  extends: "./dirwell.base.ts",
  root: "./downloads",
});
```

Remote extends are intentionally not part of the initial public contract. Local
layers keep builds reproducible and avoid executing configuration fetched over
the network.

## Output filename

`outputName` receives complete `DirectoryData` and returns a filename or
`null`. Returning `null` skips generation for that directory.

```ts
export default defineConfig({
  outputName(directory) {
    return directory.entries.some((entry) => entry.name === "landing.html") ? null : "index.html";
  },
});
```
