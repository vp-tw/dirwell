import { cp, rm } from "node:fs/promises";
await rm(new URL("../packages/share-image/dist/fonts", import.meta.url), {
  recursive: true,
  force: true,
});
await cp(
  new URL("../packages/share-image/src/fonts", import.meta.url),
  new URL("../packages/share-image/dist/fonts", import.meta.url),
  { recursive: true },
);
