import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import Fastify from "fastify";
import { Hono } from "hono";
import { createExpressMiddleware } from "../packages/server/src/express.ts";
import { createFastifyPlugin } from "../packages/server/src/fastify.ts";
import { createExplorerHandler } from "../packages/server/src/index.ts";
import { createPlainTheme } from "../packages/theme-plain/dist/index.mjs";

async function source(context) {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-server-host-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "active.html"), "<script>active</script>");
  return root;
}
async function verify(request) {
  const html = await request("/downloads/browse/index.html");
  assert.equal(html.status, 200);
  assert.match(await html.text(), /active.html/);
  assert.equal(html.headers.get("x-dirwell"), "host");
  const listing = await request("/downloads/listing");
  assert.equal((await listing.json()).entries[0].href, "/downloads/files/active.html");
  const file = await request("/downloads/files/active.html");
  assert.match(file.headers.get("content-disposition"), /^attachment/);
  assert.equal(await file.text(), "<script>active</script>");
  assert.equal((await request("/host")).status, 200);
}

test("Express middleware preserves its mounted original URL and unrelated host routes", async (context) => {
  const root = await source(context),
    app = express();
  app.get("/host", (_request, response) => response.send("host"));
  app.use(
    "/downloads",
    await createExpressMiddleware({
      root,
      theme: createPlainTheme(),
      files: "media",
      mountPath: "/downloads",
      headers: () => ({ "x-dirwell": "host" }),
    }),
  );
  const server = createServer(app);
  context.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  await verify((route) => fetch(`http://127.0.0.1:${server.address().port}${route}`));
});

test("Fastify plugin streams through raw replies inside a dedicated route tree", async (context) => {
  const root = await source(context),
    app = Fastify();
  context.after(() => app.close());
  app.get("/host", async () => "host");
  app.register(
    await createFastifyPlugin({
      root,
      theme: createPlainTheme(),
      files: "media",
      mountPath: "/downloads",
      headers: () => ({ "x-dirwell": "host" }),
    }),
  );
  const url = await app.listen({ host: "127.0.0.1", port: 0 });
  await verify((route) => fetch(url + route));
});

test("Hono forwards its real Request and preserves Dirwell Response headers", async (context) => {
  const root = await source(context),
    app = new Hono(),
    handler = await createExplorerHandler({
      root,
      theme: createPlainTheme(),
      files: "media",
      mountPath: "/downloads",
      headers: () => ({ "x-dirwell": "host" }),
    });
  app.get("/host", (context) => context.text("host"));
  app.all("/downloads/*", (context) => handler(context.req.raw));
  await verify((route) => app.request("http://test" + route));
});
