import { randomUUID } from "node:crypto";

export function generationKey(dataset) {
  return `dirwell:public-listing:v1:${encodeURIComponent(dataset)}:generation`;
}

/** Cache the public root listing, independently of HTTP response caching. */
export function createListingCache({ handler, redis, dataset, ttlMs = 10000 }) {
  const versionKey = generationKey(dataset);
  let sourceReads = 0;

  const fresh = async () => {
    sourceReads++;
    const response = await handler(new Request("http://dirwell/downloads/listing"));
    if (!response.ok) throw new Error(`Listing failed with status ${response.status}`);
    return response.json();
  };
  const valid = (value) =>
    value?.version === 1 &&
    value.directory === "" &&
    value.offset === 0 &&
    Number.isSafeInteger(value.total) &&
    Array.isArray(value.entries);

  return async () => {
    let key;
    if (redis.isReady) {
      try {
        let generation = await redis.get(versionKey);
        if (generation === null) {
          await redis.set(versionKey, randomUUID(), { NX: true });
          generation = await redis.get(versionKey);
        }
        if (!generation) throw new Error("Cache generation is unavailable");
        key = `${versionKey}:${generation}:root`;
        const stored = await redis.get(key);
        if (stored !== null) {
          const data = JSON.parse(stored);
          if (valid(data)) return { data, cache: "hit", sourceReads };
        }
      } catch {
        // Redis failures and invalid records use the same fresh-read path.
        key = undefined;
      }
    }

    const data = await fresh();
    if (key) {
      try {
        await redis.set(key, JSON.stringify(data), { PX: ttlMs });
        return { data, cache: "miss", sourceReads };
      } catch {
        // A failed cache write does not discard a successful filesystem read.
      }
    }
    return { data, cache: "bypass", sourceReads };
  };
}
