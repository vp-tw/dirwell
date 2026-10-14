import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { generateExplorer } from "../packages/core/src/generator.ts";

test("paginated-capable themes cannot replace archive files with their own assets", async (context) => {
  const temp = await mkdtemp(path.join(tmpdir(), "dirwell-theme-source-"));
  context.after(() => rm(temp, { recursive: true, force: true }));
  const sourceDir = path.join(temp, "source"),
    outputDir = path.join(temp, "out");
  await mkdir(sourceDir);
  await mkdir(outputDir);
  await writeFile(path.join(sourceDir, "page.json"), "archive content");
  await writeFile(path.join(outputDir, "keep.txt"), "previous output");
  await assert.rejects(
    generateExplorer({
      sourceDir,
      outputDir,
      outputPolicy: "replace",
      theme: {
        name: "fixture",
        listing: { pagination: true },
        render: () => ({
          html: "<!doctype html><title>Fixture</title>",
          assets: { "page.json": "generated theme data" },
        }),
      },
    }),
    /conflicts with source entry/,
  );
  assert.equal(await readFile(path.join(outputDir, "keep.txt"), "utf8"), "previous output");
  assert.equal(await readFile(path.join(sourceDir, "page.json"), "utf8"), "archive content");
});
