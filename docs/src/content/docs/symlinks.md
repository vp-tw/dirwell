---
title: Symlinks
description: Understand link boundaries, cycles and unavailable targets.
---

Dirwell distinguishes files, directories, symlinks and other entries. Link metadata includes the declared target and whether the target is broken, cyclic, outside the root or excluded. Unavailable links must not expose outside-root file bytes or resolved machine paths.

For static builds, configure `build.symlinks` or core `GenerateOptions.symlinks`:

```js
export default {
  build: { symlinks: { follow: true, boundary: "root", onCycle: "skip" } },
};
```

`follow` controls traversal, `boundary` controls whether followed targets may leave the root, and `onCycle` selects error or skip behavior. Keep the root boundary for a bounded archive. Cycles terminate traversal; a theme may still show the declared link and canonical navigation target.

Live server paths stay within the configured physical root and reject unavailable paths. Authorization checks the logical path and canonical target. Selection rules also apply to targets. A parent listing may reveal child names even when a child request is denied.

Custom themes receive private Node-side filesystem entries. Use core public projection before serialization, and escape declared target text before inserting it into HTML. These protections are not a claim of transactional snapshots or resilience to hostile concurrent directory replacement.
