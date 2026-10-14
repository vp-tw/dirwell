import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, rename, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createExplorerHandler } from "../packages/server/dist/index.mjs";
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "dirwell-live-search-"));
  try {
    await mkdir(join(root, "nested"));
    await mkdir(join(root, "private"));
    await writeFile(join(root, "nested", "日本語 #%.txt"), "download");
    await writeFile(join(root, "private", "secret.txt"), "private");
    await writeFile(join(root, "hidden.txt"), "excluded");
    await symlink("nested", join(root, "alias"));
    await symlink("/etc", join(root, "outside"));
    await symlink(".", join(root, "cycle"));
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const request = (query = "", options = {}) =>
  new Request("http://localhost/__dirwell/search" + query, options);
test("live queries are opt-in and validate request bounds", () =>
  fixture(async (root) => {
    assert.equal((await (await createExplorerHandler({ root }))(request("?q=txt"))).status, 404);
    const handler = await createExplorerHandler({ root, search: {} });
    for (const query of [
      "",
      "?q=",
      "?q=x&limit=0",
      "?q=x&limit=101",
      "?q=" + "x".repeat(257),
      "?q=x&unknown=y",
    ])
      assert.equal((await handler(request(query))).status, 400);
    assert.equal((await handler(request("?q=x", { method: "POST" }))).status, 405);
  }));
test("fresh encoded results exclude denied/ignored paths and canonical aliases", () =>
  fixture(async (root) => {
    await writeFile(join(root, ".gitignore"), "hidden.txt\n");
    const paths = [];
    const handler = await createExplorerHandler({
      root,
      files: "media",
      ignoreFiles: [join(root, ".gitignore")],
      search: {},
      authorize: (_, path) => {
        paths.push(path);
        return !path.startsWith("private");
      },
    });
    const response = await handler(request("?q=txt"));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(
      data.results.map((x) => x.path),
      ["nested/日本語 #%.txt"],
    );
    assert.equal(data.results[0].href, "/files/nested/%E6%97%A5%E6%9C%AC%E8%AA%9E%20%23%25.txt");
    assert(!JSON.stringify(data).includes(root));
    assert(!paths.includes("private/secret.txt"));
    await writeFile(join(root, "nested", "new.txt"), "new");
    assert.equal((await (await handler(request("?q=new"))).json()).results.length, 1);
    await rename(join(root, "nested", "new.txt"), join(root, "nested", "renamed.txt"));
    assert.equal((await (await handler(request("?q=new"))).json()).results.length, 0);
    assert.equal(
      (await (await handler(request("?q=renamed&path=nested"))).json()).results.length,
      1,
    );
    await rm(join(root, "nested", "renamed.txt"));
    assert.equal((await (await handler(request("?q=renamed"))).json()).results.length, 0);
    assert.equal((await handler(request("?q=secret&path=private"))).status, 403);
  }));
test("scan budget errors never masquerade as complete results; result limits are explicit", () =>
  fixture(async (root) => {
    const bounded = await createExplorerHandler({ root, search: { maxEntries: 1 } });
    const response = await bounded(request("?q=txt"));
    assert.equal(response.status, 503);
    assert.match(await response.text(), /budget/);
    const handler = await createExplorerHandler({ root, search: { maxResults: 1 } });
    const data = await (await handler(request("?q=txt"))).json();
    assert.equal(data.results.length, 1);
    assert.equal(data.truncated, true);
  }));
test("capacity rejects overload and releases on cancellation", () =>
  fixture(async (root) => {
    let release;
    let hold = false;
    const gate = new Promise((resolve) => (release = resolve));
    const handler = await createExplorerHandler({
      root,
      search: { maxConcurrent: 1 },
      authorize: async (_, path) => {
        if (hold && path === "nested") await gate;
        return true;
      },
    });
    hold = true;
    const controller = new AbortController();
    const first = handler(request("?q=txt", { signal: controller.signal }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal((await handler(request("?q=txt"))).status, 429);
    controller.abort();
    assert.equal((await first).status, 503);
    release();
    hold = false;
    assert.equal((await handler(request("?q=txt"))).status, 200);
  }));

test("CLI configuration enables bounded queries and timeout releases capacity", () =>
  fixture(async (root) => {
    const { runCli } = await import("../packages/cli/dist/index.mjs");
    await writeFile(
      join(root, "dirwell.config.mjs"),
      "export default {server:{search:{maxResults:5}}};\n",
    );
    const server = await runCli(["server", root], root, () => {});
    try {
      const response = await fetch(server.url + "/__dirwell/search?q=日本語");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).results[0].path, "nested/日本語 #%.txt");
    } finally {
      await server.close();
    }
    let slow = true;
    const handler = await createExplorerHandler({
      root,
      search: { timeoutMs: 1000, maxConcurrent: 1 },
      authorize: async () => {
        if (slow) await new Promise((resolve) => setTimeout(resolve, 1500));
        return true;
      },
    });
    const timed = await handler(request("?q=txt"));
    assert.equal(timed.status, 503);
    assert.match(await timed.text(), /timed out/);
    slow = false;
    assert.equal((await handler(request("?q=txt"))).status, 200);
  }));

test("cancelling an async header hook immediately releases query capacity", () =>
  fixture(async (root) => {
    let entered, release;
    const reached = new Promise((resolve) => (entered = resolve));
    const gate = new Promise((resolve) => (release = resolve));
    let first = true;
    const handler = await createExplorerHandler({
      root,
      search: { maxConcurrent: 1 },
      headers: async () => {
        if (first) {
          first = false;
          entered();
          await gate;
        }
        return {};
      },
    });
    const controller = new AbortController();
    const pending = handler(request("?q=txt", { signal: controller.signal }));
    await reached;
    controller.abort();
    try {
      assert.equal((await pending).status, 503);
      assert.equal((await handler(request("?q=txt"))).status, 200);
    } finally {
      release();
    }
  }));
