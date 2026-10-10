import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer } from "vite";
import { exampleDirectoryIndexes } from "../docs/example-index.ts";

test("docs dev serves native example directory links at root and prefixed mounts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-docs-index-"));
  try {
    await mkdir(path.join(root, "public/examples/basic/releases"), { recursive: true });
    await writeFile(
      path.join(root, "public/examples/basic/releases/index.html"),
      "<h1>Sample releases</h1>",
    );
    for (const base of ["/", "/dirwell/"]) {
      const server = await createServer({
        configFile: false,
        root,
        base,
        plugins: [exampleDirectoryIndexes()],
        server: { host: "127.0.0.1", port: 0 },
      });
      try {
        await server.listen();
        const address = server.httpServer!.address();
        assert.ok(address && typeof address !== "string");
        const origin = `http://127.0.0.1:${address.port}`;
        const response = await fetch(`${origin}${base}examples/basic/releases/?view=list`);
        assert.equal(response.status, 200);
        assert.match(await response.text(), /Sample releases/);
        const missing = await fetch(`${origin}${base}examples/basic/missing/`);
        assert.equal(missing.status, 404);
        const outside = await fetch(`${origin}${base}getting-started/`);
        assert.equal(outside.status, 404);
      } finally {
        await server.close();
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
