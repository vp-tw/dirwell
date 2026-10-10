import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createExplorerDevServer } from "../src/dev-server.ts";

test("requests arriving during an output rebuild wait for the completed snapshot", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-rebuild-gate-"));
  const sourceDir = path.join(root, "files");
  await mkdir(sourceDir);
  await writeFile(path.join(sourceDir, "first.txt"), "first");
  const started = Promise.withResolvers<void>(),
    gate = Promise.withResolvers<void>();
  let renders = 0;
  const server = await createExplorerDevServer({
    sourceDir,
    outputDir: path.join(root, "output"),
    port: 0,
    theme: {
      name: "gated",
      searchIndex: false,
      async render(context) {
        if (++renders === 2) {
          started.resolve();
          await gate.promise;
        }
        return { html: `<!doctype html><body>${context.directory.entries.length} files</body>` };
      },
    },
  });
  let request: Promise<Response> | undefined;
  try {
    await writeFile(path.join(sourceDir, "second.txt"), "second");
    await started.promise;
    let settled = false;
    request = fetch(server.url).finally(() => {
      settled = true;
    });
    await delay(100);
    assert.equal(settled, false, "A request must not read a snapshot being replaced");
    gate.resolve();
    const response = await request;
    assert.equal(response.status, 200);
    assert.match(await response.text(), /2 files/);
    assert.match(await fetch(server.url).then((r) => r.text()), /2 files/);
  } finally {
    gate.resolve();
    await request?.then((response) => response.arrayBuffer()).catch(() => {});
    await delay(30);
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("an edit queued during a failed async render still rebuilds the latest source", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-rebuild-recovery-"));
  const sourceDir = path.join(root, "files");
  await mkdir(sourceDir);
  await writeFile(path.join(sourceDir, "first.txt"), "first");
  const started = Promise.withResolvers<void>(),
    gate = Promise.withResolvers<void>(),
    recovered = Promise.withResolvers<void>();
  let renders = 0;
  const server = await createExplorerDevServer({
    sourceDir,
    outputDir: path.join(root, "output"),
    port: 0,
    theme: {
      name: "gated-error",
      searchIndex: false,
      async render(context) {
        if (++renders === 2) {
          started.resolve();
          await gate.promise;
          throw new Error("Expected render failure");
        }
        if (renders === 3) recovered.resolve();
        return { html: `<!doctype html><body>${context.directory.entries.length} files</body>` };
      },
    },
  });
  try {
    await writeFile(path.join(sourceDir, "second.txt"), "second");
    await started.promise;
    await writeFile(path.join(sourceDir, "third.txt"), "third");
    await delay(120);
    gate.resolve();
    await Promise.race([
      recovered.promise,
      delay(5000, undefined, { ref: false }).then(() => {
        throw new Error("Queued source edit was lost after a render failure");
      }),
    ]);
    assert.match(await fetch(server.url).then((r) => r.text()), /3 files/);
  } finally {
    gate.resolve();
    await delay(30);
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
