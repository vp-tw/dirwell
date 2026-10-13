import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createDirectoryService, DirectoryAccessError } from "../packages/core/dist/index.mjs";
import { createExplorerHandler } from "../packages/server/dist/index.mjs";

async function fixture(context) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "dirwell-directory-race-")));
  await fs.writeFile(path.join(root, "removed.txt"), "gone");
  await fs.writeFile(path.join(root, "survivor.txt"), "kept");
  context.after(async () => {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}
function deleteAfterEnumeration(context, root, targetRead = 1) {
  const original = fs.readdir;
  let reads = 0;
  context.mock.method(fs, "readdir", async (...args) => {
    const names = await original(...args);
    if (args[0] === root && ++reads === targetRead) await fs.rm(path.join(root, "removed.txt"));
    return names;
  });
  // Named imports retain the real filesystem, with only the deletion timing controlled.
  syncBuiltinESMExports();
}
async function event(reader) {
  let text = "";
  const timeout = setTimeout(() => void reader.cancel(), 3000);
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Stream closed before revision");
      text += new TextDecoder().decode(chunk.value);
      const match = /data: (.+)\n\n/.exec(text);
      if (match) return JSON.parse(match[1]);
    }
  } finally {
    clearTimeout(timeout);
  }
}

test("a child deleted after enumeration does not make the live directory unavailable", async (context) => {
  const root = await fixture(context);
  const handler = await createExplorerHandler({ root });
  deleteAfterEnumeration(context, root);
  const response = await handler(new Request("http://test/listing"));
  assert.equal(response.status, 200);
  assert.deepEqual(
    (await response.json()).entries.map((entry) => entry.name),
    ["survivor.txt"],
  );
});

test("concurrent child deletion preserves SSE subscription and publishes the next revision", async (context) => {
  const root = await fixture(context);
  const handler = await createExplorerHandler({ root, live: { intervalMs: 25 } });
  deleteAfterEnumeration(context, root, 2);
  const response = await handler(new Request("http://test/__dirwell/updates?path="));
  const reader = response.body.getReader();
  try {
    const first = await event(reader);
    const second = await event(reader);
    assert.notEqual(first.revision, second.revision);
  } finally {
    await reader.cancel();
  }
});

test("live enumeration does not hide permission or containment failures", async (context) => {
  const root = await fixture(context);
  const service = await createDirectoryService({ root });
  const original = fs.lstat;
  context.mock.method(fs, "lstat", async (...args) => {
    if (args[0] === path.join(root, "removed.txt")) {
      const denied = new Error("Denied");
      denied.code = "EACCES";
      throw denied;
    }
    return original(...args);
  });
  syncBuiltinESMExports();
  await assert.rejects(service.listDirectory(""), (error) => error.code === "EACCES");
  await assert.rejects(service.listDirectory("../outside"), DirectoryAccessError);
});
