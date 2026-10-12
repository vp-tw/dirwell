import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { generateExplorer } from "@dirwell/core";
import { loadListing, parseListingEntries } from "@dirwell/core/client";
import { createPlainTheme } from "@dirwell/theme-plain";
import { createLedgerTheme } from "@dirwell/theme-ledger";
import { createCrosswaveTheme } from "@dirwell/theme-crosswave";
import { startExplorerServer } from "@dirwell/server/node";
import { runCli } from "@dirwell/cli";
import { createExpressMiddleware } from "@dirwell/server/express";
import { createFastifyPlugin } from "@dirwell/server/fastify";
assert.equal(typeof createExpressMiddleware, "function");
assert.equal(typeof createFastifyPlugin, "function");
assert.equal(typeof loadListing, "function");
assert.equal(typeof parseListingEntries, "function");
await rm("source", { recursive: true, force: true });
await mkdir("source/docs", { recursive: true });
for (const name of ["one.txt", "two.txt", "three.txt", "active.html", "picture.png"])
  await writeFile("source/" + name, "data");
await assert.rejects(generateExplorer({ sourceDir: "source", outputDir: "out" }), /explicit theme/);
for (const [name, theme] of [
  ["plain", createPlainTheme()],
  ["ledger", createLedgerTheme()],
  ["crosswave", createCrosswaveTheme()],
])
  for (const mode of ["ssg", "mpa"]) {
    await generateExplorer({
      sourceDir: "source",
      outputDir: "out-" + name + "-" + mode,
      mode,
      theme,
      listing: {
        html: { strategy: "paged", pageSize: 2 },
        data: { strategy: "blocks", blockSize: 3 },
      },
    });
    const html = await readFile("out-" + name + "-" + mode + "/index.html", "utf8");
    assert.match(html, /Page 1 of 3/);
    if (name === "plain") assert.ok(!/<script|<img|og:image/.test(html));
    else {
      assert.ok(html.includes('data-dirwell-theme="' + name + '"'));
      assert.ok(!html.includes("clientTree"));
    }
  }
await runCli(
  ["build", "source", "--out", "cli-out", "--theme", "@dirwell/theme-plain#createPlainTheme"],
  process.cwd(),
  () => {},
);
const server = await startExplorerServer({
  root: "source",
  pageSize: 2,
  theme: createLedgerTheme(),
  live: { intervalMs: 50 },
});
try {
  const html = await fetch(server.url + "/browse/");
  assert.equal(html.status, 200);
  assert.match(await html.text(), /data-dirwell-theme/);
  const first = await fetch(server.url + "/listing");
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.equal(data.entries.length, 2);
  assert.equal(data.total, 6);
  await writeFile("source/new.txt", "new");
  const changed = await fetch(server.url + "/listing", {
    headers: { "if-none-match": first.headers.get("etag") },
  });
  assert.equal(changed.status, 200);
  assert.notEqual((await changed.json()).revision, data.revision);
  const active = await fetch(server.url + "/files/active.html");
  assert.match(active.headers.get("content-disposition"), /^attachment/);
  await active.text();
  const picture = await fetch(server.url + "/files/picture.png", {
    headers: { range: "bytes=1-2" },
  });
  assert.equal(picture.status, 206);
  assert.match(picture.headers.get("content-disposition"), /^inline/);
  assert.equal(await picture.text(), "at");
} finally {
  await server.close();
}
console.log(
  JSON.stringify({
    node: process.version,
    status: "passed",
    themes: ["plain", "ledger", "crosswave"],
    modes: ["ssg", "mpa"],
    liveListing: true,
    fileTransport: true,
  }),
);
