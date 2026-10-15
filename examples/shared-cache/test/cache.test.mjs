import assert from "node:assert/strict";
import test from "node:test";
import { createListingCache, generationKey } from "../cache.mjs";

const listing = (name) => ({ version: 1, directory: "", offset: 0, total: 1, entries: [{ name }] });
function memoryRedis() {
  const values = new Map();
  return {
    isReady: true,
    values,
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value, options = {}) {
      if (options.NX && values.has(key)) return null;
      values.set(key, value);
      return "OK";
    },
  };
}

test("an invalid record or unavailable Redis uses a fresh listing", async () => {
  const redis = memoryRedis();
  const versionKey = generationKey("public");
  await redis.set(versionKey, "generation-a");
  await redis.set(`${versionKey}:generation-a:root`, "not-json");
  let reads = 0;
  const read = createListingCache({
    redis,
    dataset: "public",
    handler: async () => {
      reads++;
      return Response.json(listing("current.txt"));
    },
  });
  assert.equal((await read()).cache, "bypass");
  redis.isReady = false;
  assert.deepEqual((await read()).data, listing("current.txt"));
  assert.equal(reads, 2);
});

test("a failed cache write preserves the successful source response", async () => {
  const redis = memoryRedis();
  await redis.set(generationKey("public"), "generation-a");
  redis.set = async () => {
    throw new Error("Redis disconnected");
  };
  const read = createListingCache({
    redis,
    dataset: "public",
    handler: async () => Response.json(listing("current.txt")),
  });
  assert.deepEqual(await read(), { data: listing("current.txt"), cache: "bypass", sourceReads: 1 });
});

test("a late old fill cannot replace the current generation", async () => {
  const redis = memoryRedis();
  const versionKey = generationKey("public");
  await redis.set(versionKey, "old");
  let release, started;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const oldRead = createListingCache({
    redis,
    dataset: "public",
    handler: async () => {
      started();
      await held;
      return Response.json(listing("old.txt"));
    },
  });
  const pending = oldRead();
  await entered;
  await redis.set(versionKey, "new");
  const newRead = createListingCache({
    redis,
    dataset: "public",
    handler: async () => Response.json(listing("new.txt")),
  });
  assert.equal((await newRead()).cache, "miss");
  release();
  assert.equal((await pending).data.entries[0].name, "old.txt");
  const next = await oldRead();
  assert.equal(next.cache, "hit");
  assert.equal(next.data.entries[0].name, "new.txt");
});

test("simultaneous cold misses are allowed to perform two source reads", async () => {
  const redis = memoryRedis();
  const releases = [];
  let bothEntered;
  const entered = new Promise((resolve) => {
    bothEntered = resolve;
  });
  const handler = async () => {
    await new Promise((resolve) => {
      releases.push(resolve);
      if (releases.length === 2) bothEntered();
    });
    return Response.json(listing("current.txt"));
  };
  const a = createListingCache({ redis, dataset: "public", handler });
  const b = createListingCache({ redis, dataset: "public", handler });
  const pending = Promise.all([a(), b()]);
  await entered;
  releases.forEach((release) => release());
  assert.deepEqual(
    (await pending).map(({ cache }) => cache),
    ["miss", "miss"],
  );
});
