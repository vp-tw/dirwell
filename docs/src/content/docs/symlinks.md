---
title: Symlinks
description: Follow symlinks without hiding cycles, broken targets, or root boundaries.
---

Symlink traversal is opt-in. Every symlink remains visible and shows its declared
target.

```ts
export default defineConfig({
  symlinks: {
    follow: true,
    boundary: "root",
    onCycle: "skip",
  },
});
```

## Cycles

Dirwell identifies cycles from the real paths of the current ancestor chain. It
stops recursive generation at the cycle but links the entry to its canonical,
already generated target. The cycle is therefore supported navigation rather
than a dead item.

## Broken links

Broken targets stay in the list with a status badge and their raw target text.
Selecting one opens that raw `readlink()` text as a plain-text document in a
new tab. It does not attempt to navigate to the missing target.

## Outside the root

With `boundary: "root"`, an outside target is visible but unavailable. Dirwell
does not expose the resolved absolute machine path in generated HTML.
The CLI does not mirror absolute symlinks or relative symlinks that would point
outside the copied output. The Vite adapter rejects included links of those
types when mirroring is enabled. Filters never copy a symlink whose target was
excluded.
