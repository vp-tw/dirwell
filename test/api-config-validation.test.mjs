import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateExplorer, createDirectoryService } from "../packages/core/dist/index.mjs";
import { createPlainTheme } from "../packages/theme-plain/dist/index.mjs";
import { createExplorerHandler } from "../packages/server/dist/index.mjs";
import { startExplorerServer } from "../packages/server/dist/node.mjs";

async function fixture(context) {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-api-config-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, "files");
  await mkdir(sourceDir);
  await writeFile(path.join(sourceDir, "public.txt"), "fixture");
  return { root, sourceDir, outputDir: path.join(root, "out"), theme: createPlainTheme() };
}

test("direct Core rejects unknown and invalid nested options before any output write", async (context) => {
  const { root, ...base } = await fixture(context);
  for (const [change, diagnostic] of [
    [{ exlcude: ["private.txt"] }, /options\.exlcude.*options\.exclude/],
    [{ mirror: "false" }, /options\.mirror/],
    [{ dryRun: "true" }, /options\.dryRun/],
    [{ mode: "spa" }, /options\.mode/],
    [{ urlStrategy: "reltaive" }, /options\.urlStrategy/],
    [{ sort: { nameMod: "natural" } }, /options\.sort\.nameMod.*nameMode/],
    [{ sort: { directoriesFirst: "false" } }, /options\.sort\.directoriesFirst/],
    [{ symlinks: { follow: "false" } }, /options\.symlinks\.follow/],
    [
      { listing: { html: { strategy: "all", pageSize: 1 }, data: { strategy: "all" } } },
      /listing\.html\.pageSize/,
    ],
    [{ theme: { name: "broken", render: "html" } }, /options\.theme\.render/],
  ]) {
    await assert.rejects(generateExplorer({ ...base, ...change }), diagnostic);
    assert.deepEqual(await readdir(root), ["files"]);
  }
});

test("DirectoryService and Server validate before attempting to read a missing root", async () => {
  const root = path.join(tmpdir(), "dirwell-missing-validation-root");
  await assert.rejects(
    createDirectoryService({ root, exlcude: ["private"] }),
    /options\.exlcude.*exclude/,
  );
  await assert.rejects(
    createDirectoryService({ root, sort: { field: "date" } }),
    /options\.sort\.field/,
  );
  await assert.rejects(
    createExplorerHandler({ root, exlcude: ["private"] }),
    /options\.exlcude.*exclude/,
  );
  await assert.rejects(
    createExplorerHandler({ root, live: { interval: 50 } }),
    /options\.live\.interval.*intervalMs/,
  );
  await assert.rejects(createExplorerHandler({ root, authorize: true }), /options\.authorize/);
  await assert.rejects(startExplorerServer({ root, host: false }), /options\.host/);
  await assert.rejects(startExplorerServer({ root, port: -1 }), /options\.port/);
  await assert.rejects(startExplorerServer({ root, poort: 5000 }), /options\.poort.*port/);
});

test("a listing callback typo fails without replacing a previous successful output", async (context) => {
  const { root: _root, ...base } = await fixture(context);
  await generateExplorer(base);
  const before = await readFile(path.join(base.outputDir, "index.html"), "utf8");
  await assert.rejects(
    generateExplorer({
      ...base,
      listing: () => ({
        html: { strategy: "all" },
        data: { strategy: "blocks", blockSize: 1, blockSzie: 2 },
      }),
    }),
    /listing\.data\.blockSzie/,
  );
  assert.equal(await readFile(path.join(base.outputDir, "index.html"), "utf8"), before);
});

test("custom theme fields and valid callbacks remain usable through static and live boundaries", async (context) => {
  const { root: _root, ...base } = await fixture(context);
  const theme = { ...base.theme, projectExtension: { anything: true } };
  await generateExplorer({
    ...base,
    theme,
    listing: () => ({ html: { strategy: "all" }, data: { strategy: "blocks", blockSize: 1 } }),
    metadata: async () => ({
      assets: new Map(),
      resolve: async () => ({
        title: "Async metadata",
        description: "Fixture",
        head: "<title>Async metadata</title>",
      }),
    }),
    outputName: async () => "index.html",
    entryData: async () => ({ description: "public annotation" }),
    fileHref: (logical) => "https://example.com/" + logical,
  });
  for (const urlStrategy of ["relative", "base", "html-base"])
    await generateExplorer({ ...base, urlStrategy });
  const server = await startExplorerServer({
    root: base.sourceDir,
    theme,
    host: "127.0.0.1",
    port: 0,
    entryData: async () => ({ description: "public annotation" }),
    authorize: async () => true,
    live: { intervalMs: 50, maxClients: 2 },
  });
  try {
    const listing = await fetch(server.url + "/listing");
    assert.equal(listing.status, 200);
    assert.match(await listing.text(), /public annotation/);
  } finally {
    await server.close();
  }
});
