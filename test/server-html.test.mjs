import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createPlainTheme } from "../packages/theme-plain/dist/index.mjs";
import { createLedgerTheme } from "../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../packages/theme-crosswave/dist/index.mjs";
import { loadListing } from "../packages/core/dist/client.mjs";
import { startExplorerServer } from "../packages/server/src/node.ts";

for (const [name, creator] of [
  ["plain", createPlainTheme],
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
]) {
  test(`${name}: live HTML, mounted assets, native pagination and complete listing share one theme`, async (context) => {
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-live-html-"));
    context.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "nested.txt"), "nested");
    for (const file of ["one.txt", "two.txt", "three.txt", "active.html"])
      await writeFile(path.join(root, file), "data");
    const server = await startExplorerServer({
      root,
      theme: creator(),
      mountPath: "/downloads",
      pageSize: 2,
      blockSize: 2,
    });
    context.after(() => server.close());
    const base = server.url + "/downloads";
    const redirect = await fetch(base + "/", { redirect: "manual" });
    assert.equal(redirect.status, 307);
    assert.equal(redirect.headers.get("location"), "/downloads/browse/");
    const first = await fetch(base + "/browse/");
    assert.equal(first.status, 200);
    const html = await first.text();
    assert.match(html, /Page 1 of 3/);
    assert.ok(!html.includes(root));
    const next = await fetch(base + "/browse/?page=2");
    assert.equal(next.status, 200);
    assert.match(await next.text(), /Page 2 of 3/);
    assert.equal((await fetch(base + "/browse/?page=4")).status, 404);
    const manifest = base + "/__dirwell/listing/manifest?path=";
    const loaded = await loadListing(manifest);
    assert.equal(loaded.entries.length, 5);
    assert.ok(loaded.entries.every((entry) => entry.href.startsWith(base)));
    if (name !== "plain") {
      const snapshot = await (await fetch(base + "/__dirwell/page?path=docs&page=1")).json();
      assert.equal(snapshot.entries[0].name, "nested.txt");
      assert.equal(snapshot.parentDataHref, "/downloads/__dirwell/page?path=&page=1");
      const client = html.match(/<script defer src="([^"]+)"/)[1].replaceAll("&amp;", "&");
      const asset = await fetch(server.url + client);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get("content-type"), /javascript/);
      assert.ok((await asset.text()).length > 100);
    } else assert.ok(!/<script/.test(html));
    const old = await (await fetch(manifest)).json();
    await writeFile(path.join(root, "new.txt"), "new");
    assert.equal((await fetch(server.url + old.blocks[0].href)).status, 410);
    assert.equal((await loadListing(manifest)).entries.length, 6);
    const active = await fetch(base + "/files/active.html");
    assert.match(active.headers.get("content-disposition"), /^attachment/);
    await active.text();
    const head = await fetch(base + "/files/active.html", {
      method: "HEAD",
      headers: { range: "bytes=1-2" },
    });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), "4");
  });
}

test("live HTML and private snapshots authorize before validators and filesystem reads", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-live-auth-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "private.txt"), "private");
  const server = await startExplorerServer({
    root,
    theme: createPlainTheme(),
    authorize: (request) => request.headers.get("x-access") === "yes",
  });
  context.after(() => server.close());
  const response = await fetch(server.url + "/browse/", { headers: { "x-access": "yes" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /private/);
  await response.text();
  for (const route of [
    "/browse/",
    "/__dirwell/listing/manifest?path=",
    "/__dirwell/page?path=&page=1",
    "/__dirwell/asset?path=&name=missing",
  ])
    assert.equal(
      (await fetch(server.url + route, { headers: { "if-none-match": "*" } })).status,
      403,
    );
  assert.equal(
    (
      await fetch(server.url + "/browse/", {
        headers: { "x-access": "yes", "if-none-match": response.headers.get("etag") },
      })
    ).status,
    304,
  );
});

test("live data defaults to a complete block and explicit block sizes remain available", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-live-data-plan-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(
    Array.from({ length: 5 }, (_, index) => writeFile(path.join(root, `${index}.txt`), "file")),
  );
  const { createExplorerHandler } = await import("../packages/server/dist/index.mjs");
  for (const [options, expected] of [
    [{}, [5]],
    [{ blockSize: 2 }, [2, 2, 1]],
  ]) {
    const handler = await createExplorerHandler({ root, theme: createPlainTheme(), ...options });
    const response = await handler(new Request("http://test/__dirwell/listing/manifest?path="));
    assert.equal(response.status, 200);
    assert.deepEqual(
      (await response.json()).blocks.map((block) => block.count),
      expected,
    );
  }
});
