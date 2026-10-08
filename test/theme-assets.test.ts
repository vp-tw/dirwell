import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { generateExplorer, type ExplorerTheme } from "../src/index.ts";

test("MPA accepts identical shared bytes across string, Uint8Array, and Buffer forms", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-assets-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "files/a/b"), { recursive: true });
  const contents = "body { color: black; }";
  const values = [contents, new TextEncoder().encode(contents), Buffer.from(contents)];
  const theme: ExplorerTheme = {
    name: "equivalent-assets",
    searchIndex: false,
    render({ directory }) {
      return {
        html: "<!doctype html><p>Files</p>",
        assets: { "theme.css": values[directory.depth]! },
      };
    },
  };
  await generateExplorer({
    sourceDir: path.join(root, "files"),
    outputDir: path.join(root, "output"),
    mode: "mpa",
    theme,
  });
  assert.equal(await readFile(path.join(root, "output/__dirwell/theme.css"), "utf8"), contents);
});

test("distinct binary shared assets fail without replacing the successful output", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-binary-assets-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, "files");
  const outputDir = path.join(root, "output");
  await mkdir(path.join(sourceDir, "nested"), { recursive: true });
  const success: ExplorerTheme = {
    name: "first",
    searchIndex: false,
    render: () => ({ html: "<!doctype html><p>Successful output</p>" }),
  };
  await generateExplorer({ sourceDir, outputDir, mode: "mpa", theme: success });
  const conflict: ExplorerTheme = {
    name: "binary-conflict",
    searchIndex: false,
    render({ directory }) {
      return {
        html: "<!doctype html><p>Replacement</p>",
        assets: { "image.bin": Buffer.from([directory.depth === 0 ? 255 : 254]) },
      };
    },
  };
  await assert.rejects(
    generateExplorer({ sourceDir, outputDir, mode: "mpa", theme: conflict }),
    /conflicting shared asset/,
  );
  assert.match(await readFile(path.join(outputDir, "index.html"), "utf8"), /Successful output/);
});
