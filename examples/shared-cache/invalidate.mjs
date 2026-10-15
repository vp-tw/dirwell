import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { generationKey } from "./cache.mjs";

const dataset = process.env.DATASET_ID ?? "shared-cache-example";
const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6380",
  socket: { connectTimeout: 1000, reconnectStrategy: false },
  commandOptions: { timeout: 1000 },
});
redis.on("error", () => {});
try {
  await redis.connect();
  await redis.set(generationKey(dataset), randomUUID());
  console.log(`Invalidated the public listing for ${dataset}. The next request reads the files.`);
} finally {
  if (redis.isOpen) redis.destroy();
}
