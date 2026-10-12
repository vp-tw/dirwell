import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createExplorerHandler } from "../packages/server/src/index.ts";
import { startExplorerServer } from "../packages/server/src/node.ts";

async function event(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let text = "";
  const timeout = setTimeout(() => void reader.cancel(), 3000);
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Stream closed before revision");
      text += new TextDecoder().decode(chunk.value);
      const match = /data: (.+)\n\n/.exec(text);
      if (match?.[1]) return JSON.parse(match[1]) as { revision: string; version: number };
    }
  } finally {
    clearTimeout(timeout);
  }
}

test("opt-in SSE publishes public revisions, enforces client limits, rechecks auth and cancels", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-sse-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "one.txt"), "one");
  let allowed = true;
  const handler = await createExplorerHandler({
    root,
    live: { intervalMs: 25, maxClients: 1 },
    authorize: () => allowed,
  });
  const url = "http://test/__dirwell/updates?path=";
  const response = await handler(new Request(url));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control")!, /private, no-store/);
  const reader = response.body!.getReader();
  try {
    const initial = await event(reader);
    assert.equal(initial.version, 1);
    assert.equal((await handler(new Request(url))).status, 429);
    await writeFile(path.join(root, "two.txt"), "two");
    const next = await event(reader);
    assert.notEqual(next.revision, initial.revision);
    assert.deepEqual(Object.keys(next).sort(), ["revision", "version"]);
    allowed = false;
    assert.equal((await reader.read()).done, true);
    assert.equal((await handler(new Request(url))).status, 403);
  } finally {
    await reader.cancel();
  }
  allowed = true;
  const reopened = await handler(new Request(url));
  assert.equal(reopened.status, 200);
  await reopened.body!.cancel();
  const disabled = await createExplorerHandler({ root });
  assert.equal((await disabled(new Request(url))).status, 404);
});

test("Node shutdown closes active SSE connections and their polling tasks", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-sse-close-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const server = await startExplorerServer({ root, live: { intervalMs: 25 } });
  const response = await fetch(server.url + "/__dirwell/updates?path=");
  const reader = response.body!.getReader();
  await event(reader);
  await server.close();
  await reader.cancel().catch(() => {});
});

test("subscribers to the same canonical directory share polling work", async (context) => {
  const { createDirectoryService } = await import("../packages/core/src/service.ts");
  const { createUpdatesHandler } = await import("../packages/server/src/updates.ts");
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-sse-shared-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const source = await createDirectoryService({ root });
  let reads = 0;
  const handler = createUpdatesHandler(
    { root, live: { intervalMs: 1000 } },
    {
      ...source,
      listDirectory: async (path) => {
        reads++;
        return source.listDirectory(path);
      },
    },
    async (_request, headers) => headers,
  );
  const first = await handler(new Request("http://test/__dirwell/updates?path=")),
    second = await handler(new Request("http://test/__dirwell/updates?path="));
  const a = first.body!.getReader(),
    b = second.body!.getReader();
  try {
    const [one, two] = await Promise.all([event(a), event(b)]);
    assert.equal(one.revision, two.revision);
    assert.equal(reads, 1);
  } finally {
    await a.cancel();
    await b.cancel();
  }
});
