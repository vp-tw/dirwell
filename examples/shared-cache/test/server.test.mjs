import assert from "node:assert/strict";
import test from "node:test";
import { fork } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { generationKey } from "../cache.mjs";
import { createApp } from "../app.mjs";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6380";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function untilReady(check) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error(
    "Redis was not ready within ten seconds. Start the example Redis before npm test.",
  );
}
async function processServer(context, root, dataset, id) {
  const child = fork(new URL("../server.mjs", import.meta.url), [], {
    env: {
      ...process.env,
      PORT: "0",
      SERVER_ID: id,
      FILES_DIR: root,
      DATASET_ID: dataset,
      REDIS_URL: redisUrl,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let logs = "";
  child.stderr.on("data", (value) => {
    logs += value;
  });
  context.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
    await exited;
    clearTimeout(timer);
  });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Example server did not start: ${logs}`)),
      10000,
    );
    child.once("error", reject);
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(`Example server exited: ${logs}`));
    });
    child.on("message", (message) => {
      if (message.event === "ready") {
        clearTimeout(timer);
        resolve(message.url);
      }
    });
  });
  await untilReady(async () => (await (await fetch(url + "/health")).json()).cacheReady);
  return { url, pid: child.pid };
}

test("two Node processes share public listings while ordinary explorer routes stay live", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-shared-example-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "first.txt"), "first");
  const dataset = randomUUID();
  const redis = createClient({ url: redisUrl, socket: { reconnectStrategy: false } });
  redis.on("error", () => {});
  await redis.connect();
  context.after(async () => {
    for await (const keys of redis.scanIterator({ MATCH: `${generationKey(dataset)}*` }))
      if (keys.length) await redis.del(keys);
    redis.destroy();
  });
  const a = await processServer(context, root, dataset, "a");
  const b = await processServer(context, root, dataset, "b");
  assert.notEqual(a.pid, b.pid);
  const first = await fetch(a.url + "/api/files");
  assert.equal(first.headers.get("x-listing-cache"), "miss");
  assert.equal(first.headers.get("x-source-reads"), "1");
  const second = await fetch(b.url + "/api/files");
  assert.equal(second.headers.get("x-server-id"), "b");
  assert.equal(second.headers.get("x-listing-cache"), "hit");
  assert.equal(second.headers.get("x-source-reads"), "0");
  assert.deepEqual(await first.json(), await second.json());
  await writeFile(path.join(root, "new.txt"), "new");
  const cached = await (await fetch(b.url + "/api/files")).json();
  assert.equal(
    cached.entries.some(({ name }) => name === "new.txt"),
    false,
  );
  const page = await fetch(b.url + "/downloads/browse/");
  assert.match(await page.text(), /new.txt/);
  await redis.set(generationKey(dataset), randomUUID());
  const refreshed = await fetch(b.url + "/api/files");
  assert.equal(refreshed.headers.get("x-listing-cache"), "miss");
  assert.equal(
    (await refreshed.json()).entries.some(({ name }) => name === "new.txt"),
    true,
  );
  const file = await fetch(a.url + "/downloads/files/new.txt");
  assert.match(file.headers.get("content-disposition"), /^attachment/);
  assert.equal(await file.text(), "new");
  assert.equal((await fetch(a.url + "/api/files?path=private")).status, 400);
});

test("real TTL expires, another dataset stays separate, and disconnected Redis bypasses", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-shared-example-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "first.txt"), "first");
  const dataset = randomUUID();
  const a = await createApp({ root, redisUrl, dataset, serverId: "ttl", ttlMs: 100 });
  const b = await createApp({ root, redisUrl, dataset: dataset + "-other", serverId: "other" });
  context.after(async () => {
    try {
      if (b.redis.isReady) {
        for (const id of [dataset, dataset + "-other"]) {
          for await (const keys of b.redis.scanIterator({ MATCH: `${generationKey(id)}*` }))
            if (keys.length) await b.redis.del(keys);
        }
      }
    } finally {
      a.close();
      b.close();
    }
  });
  await untilReady(() => a.redis.isReady && b.redis.isReady);
  assert.equal((await a.app.request("/api/files")).headers.get("x-listing-cache"), "miss");
  assert.equal((await b.app.request("/api/files")).headers.get("x-listing-cache"), "miss");
  await delay(160);
  assert.equal((await a.app.request("/api/files")).headers.get("x-listing-cache"), "miss");
  a.close();
  const fallback = await a.app.request("/api/files");
  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers.get("x-listing-cache"), "bypass");
});
