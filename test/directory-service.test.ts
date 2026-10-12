import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createPlainTheme } from "../packages/theme-plain/src/index.ts";
import { createDirectoryService, DirectoryAccessError } from "../packages/core/src/service.ts";
import { createExplorerHandler } from "../packages/server/src/index.ts";
import { startExplorerServer } from "../packages/server/src/node.ts";
import { generateExplorer } from "../packages/core/src/generator.ts";
import type { GenerateOptions } from "../packages/core/src/model.ts";

async function fixture() {
  const temp = await mkdtemp(path.join(tmpdir(), "dirwell-service-")),
    root = path.join(temp, "root");
  await mkdir(path.join(root, "docs"), { recursive: true });
  for (const name of ["a.txt", "b.txt", "secret.txt"])
    await writeFile(path.join(root, name), "text");
  await writeFile(path.join(root, "docs", "nested.txt"), "nested");
  await mkdir(path.join(temp, "outside"));
  await writeFile(path.join(temp, "outside", "private.txt"), "private");
  await symlink("../outside", path.join(root, "external"));
  await symlink("docs", path.join(root, "alias"));
  return { temp, root };
}

test("directory service is live, filtered, and rejects paths outside the selected root", async (context) => {
  const f = await fixture();
  context.after(() => rm(f.temp, { recursive: true, force: true }));
  const service = await createDirectoryService({ root: f.root, exclude: "secret.txt" });
  assert.equal((await service.listDirectory("")).entries.length, 5);
  await writeFile(path.join(f.root, "new.txt"), "new");
  assert.equal((await service.listDirectory("")).entries.length, 6);
  for (const name of [
    "../outside",
    "docs/../a.txt",
    "/a.txt",
    "C:/a.txt",
    "docs\\nested.txt",
    "__dirwell",
    "secret.txt",
  ])
    await assert.rejects(service.getEntry(name), DirectoryAccessError);
  await assert.rejects(service.getEntry("external/private.txt"), DirectoryAccessError);
  assert.equal((await service.getEntry("external")).symlink?.isOutsideRoot, true);
  assert.equal((await service.listDirectory("docs")).entries[0]?.name, "nested.txt");
  await mkdir(path.join(f.root, "..notes"));
  await writeFile(path.join(f.root, "..notes", "readme.txt"), "valid child");
  assert.equal((await service.listDirectory("..notes")).entries[0]?.name, "readme.txt");
});

test("core does not install an implicit theme", async (context) => {
  const f = await fixture();
  context.after(() => rm(f.temp, { recursive: true, force: true }));
  await assert.rejects(
    generateExplorer({
      sourceDir: f.root,
      outputDir: path.join(f.temp, "output"),
    } as GenerateOptions),
    /explicit theme/,
  );
});

test("fetch handler authorizes before conditional responses and keeps page revisions coherent", async (context) => {
  const f = await fixture();
  context.after(() => rm(f.temp, { recursive: true, force: true }));
  const handler = await createExplorerHandler({
    root: f.root,
    exclude: "secret.txt",
    pageSize: 2,
    authorize: (request) => request.headers.get("authorization") === "allowed",
    headers: () => ({ "x-custom": "yes", "cache-control": "private, max-age=10" }),
  });
  const get = (query = "", headers: HeadersInit = { authorization: "allowed" }, method = "GET") =>
    handler(new Request(`http://test/listing${query}`, { method, headers }));
  const first = await get();
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-custom"), "yes");
  assert.equal(first.headers.get("cache-control"), "private, max-age=10");
  const data = await first.json();
  assert.equal(data.total, 5);
  assert.equal(data.entries.length, 2);
  assert.equal(data.offset, 0);
  assert.equal(JSON.stringify(data).includes(f.root), false);
  assert.equal((await get("", { "if-none-match": first.headers.get("etag")! })).status, 403);
  assert.equal(
    (await get("", { authorization: "allowed", "if-none-match": `W/${first.headers.get("etag")}` }))
      .status,
    304,
  );
  const second = await (await get("?offset=2")).json();
  assert.equal(second.revision, data.revision);
  assert.equal(second.offset, 2);
  await writeFile(path.join(f.root, "new.txt"), "new");
  const refreshed = await get("", {
    authorization: "allowed",
    "if-none-match": first.headers.get("etag")!,
  });
  assert.equal(refreshed.status, 200);
  assert.notEqual((await refreshed.json()).revision, data.revision);
  assert.equal((await get("?path=../outside")).status, 404);
  assert.equal((await get("?limit=1001")).status, 400);
  assert.equal((await get("", { authorization: "allowed" }, "POST")).status, 405);
  const head = await get("", { authorization: "allowed" }, "HEAD");
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("standalone Node adapter handles live requests and closes its listener", async (context) => {
  const f = await fixture();
  context.after(() => rm(f.temp, { recursive: true, force: true }));
  const server = await startExplorerServer({ root: f.root, pageSize: 2 });
  try {
    const response = await fetch(`${server.url}/listing`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).entries.length, 2);
  } finally {
    await server.close();
  }
  await assert.rejects(fetch(`${server.url}/listing`));
});

test("file transport previews safe media, downloads active content, honors ranges and denies target alias bypass", async (context) => {
  const f = await fixture();
  context.after(() => rm(f.temp, { recursive: true, force: true }));
  await writeFile(path.join(f.root, "image.png"), new Uint8Array([1, 2, 3, 4]));
  await writeFile(path.join(f.root, "page.html"), "<p>content</p>");
  await writeFile(path.join(f.root, "vector.svg"), "<svg></svg>");
  await writeFile(path.join(f.root, "large.bin"), new Uint8Array(512 * 1024));
  await symlink("secret.txt", path.join(f.root, "public-alias"));
  const handler = await createExplorerHandler({
    root: f.root,
    files: "media",
    authorize: (_request, name) => name !== "secret.txt",
  });
  const get = (name: string, headers: HeadersInit = {}, method = "GET") =>
    handler(new Request(`http://test/files/${encodeURIComponent(name)}`, { headers, method }));
  const image = await get("image.png");
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.match(image.headers.get("content-disposition")!, /^inline/);
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [1, 2, 3, 4]);
  for (const name of ["page.html", "vector.svg"]) {
    const response = await get(name);
    assert.match(response.headers.get("content-disposition")!, /^attachment/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    await response.arrayBuffer();
  }
  const ranged = await get("image.png", { range: "bytes=1-2" });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get("content-range"), "bytes 1-2/4");
  assert.deepEqual([...new Uint8Array(await ranged.arrayBuffer())], [2, 3]);
  assert.equal((await get("image.png", { range: "bytes=9-10" })).status, 416);
  assert.equal((await get("public-alias")).status, 403);
  const outside = await get("external");
  assert.equal(await outside.text(), "../outside");
  assert.match(outside.headers.get("content-disposition")!, /^attachment/);
  const head = await get("image.png", {}, "HEAD");
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const notModified = await get("image.png", { "if-none-match": image.headers.get("etag")! });
  assert.equal(notModified.status, 304);
  const partial = await get("large.bin");
  const reader = partial.body!.getReader();
  assert.ok((await reader.read()).value!.byteLength <= 64 * 1024);
  await reader.cancel();
  const standalone = await startExplorerServer({ root: f.root });
  try {
    const response = await fetch(`${standalone.url}/files/image.png`, {
      headers: { range: "bytes=0-1" },
    });
    assert.equal(response.status, 206);
    assert.equal((await response.arrayBuffer()).byteLength, 2);
  } finally {
    await standalone.close();
  }
});

test("directory aliases cannot bypass canonical target authorization for nested paths", async (context) => {
  const f = await fixture();
  context.after(() => rm(f.temp, { recursive: true, force: true }));
  await mkdir(path.join(f.root, "docs", "sub"));
  await writeFile(path.join(f.root, "docs", "sub", "inside.txt"), "fixture private");
  const handler = await createExplorerHandler({
    root: f.root,
    theme: createPlainTheme(),
    live: { intervalMs: 25 },
    files: "media",
    authorize: (_request, logical) => !logical.startsWith("docs"),
  });
  for (const route of [
    "/files/alias/nested.txt",
    "/listing?path=alias/sub",
    "/__dirwell/updates?path=alias/sub",
    "/browse/alias/sub/",
    "/__dirwell/listing/manifest?path=alias/sub",
  ]) {
    const response = await handler(new Request("http://test" + route));
    try {
      assert.equal(response.status, 403, route);
    } finally {
      await response.body?.cancel();
    }
  }
});
