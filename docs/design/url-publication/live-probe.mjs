// Historical pre-routing probe; use the source hashes recorded in baseline-summary.json.
// Current qualification: test/routing.test.mjs and test/browser/routing.spec.mjs.
import { fileURLToPath, pathToFileURL } from "node:url";
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const { createExplorerHandler } = await import(
  pathToFileURL(path.join(repositoryRoot, "packages/server/src/index.ts")).href
);
const { createPlainTheme } = await import(
  pathToFileURL(path.join(repositoryRoot, "packages/theme-plain/src/index.ts")).href
);
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const root = await mkdtemp(path.join(tmpdir(), "dirwell-live-url-"));
try {
  await mkdir(path.join(root, "child"));
  await writeFile(path.join(root, "child", "a.txt"), "a");
  const rows = [];
  for (const portableLinks of [true, false]) {
    const handler = await createExplorerHandler({
      root,
      mountPath: "/downloads",
      theme: createPlainTheme({ portableLinks }),
    });
    for (const route of [
      "/",
      "/browse",
      "/browse/",
      "/browse/index.html",
      "/browse/child",
      "/browse/child/",
      "/browse/child/index.html",
      "/browse/child/?page=1",
    ]) {
      const response = await handler(new Request("https://example.test/downloads" + route));
      const html = await response.text();
      rows.push({
        portableLinks,
        route,
        status: response.status,
        location: response.headers.get("location"),
        links: [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]),
      });
    }
  }
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
