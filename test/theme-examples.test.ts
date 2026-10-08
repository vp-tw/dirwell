import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import catppuccinConfig from "../examples/default-theme-override/dirwell.config.ts";
import customConfig from "../examples/custom-theme/dirwell.config.ts";
import { generateExplorer } from "../src/generator.ts";

const examples = path.resolve(import.meta.dirname, "../examples");

test("release catalog theme owns HTML, CSS, and safe navigation", async (context) => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "dirwell-custom-theme-"));
  context.after(() => rm(outputDir, { recursive: true, force: true }));
  for (const mode of ["ssg", "mpa"] as const) {
    await generateExplorer({
      sourceDir: path.join(examples, "custom-theme/files"),
      outputDir,
      mode,
      theme: customConfig.theme,
    });
    const html = await readFile(path.join(outputDir, "index.html"), "utf8");
    assert.match(html, /Northstar release catalog/);
    assert.match(html, /href="stable\/"/);
    assert.doesNotMatch(html, /dirwell\.runtime\.js|data-search-input|file-icon/);
    const assetDir = path.join(outputDir, mode === "mpa" ? "__dirwell" : "");
    assert.match(await readFile(path.join(assetDir, "release-catalog.css"), "utf8"), /\.eyebrow/);
    const nested = await readFile(path.join(outputDir, "stable/index.html"), "utf8");
    assert.match(nested, /northstar-linux-x64\.tar\.gz/);
    assert.match(nested, /target="_blank" rel="noopener"/);
  }
});

test("Catppuccin override emits paired icons and palettes in SSG and MPA", async (context) => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "dirwell-catppuccin-"));
  context.after(() => rm(outputDir, { recursive: true, force: true }));
  for (const mode of ["ssg", "mpa"] as const) {
    await generateExplorer({
      sourceDir: path.join(examples, "default-theme-override/files"),
      outputDir,
      mode,
      theme: catppuccinConfig.theme,
    });
    const html = await readFile(path.join(outputDir, "index.html"), "utf8");
    assert.match(html, /Catppuccin explorer/);
    assert.match(html, /--paper: #e6e9ef/);
    assert.match(html, /--paper: #1e2030/);
    assert.match(html, /file-icon--light/);
    assert.match(html, /file-icon--dark/);
    assert.match(html, /&quot;icons&quot;:\{&quot;light&quot;:/);
    assert.match(html, /&quot;dark&quot;:\{&quot;file&quot;:/);
    const assetDir = path.join(outputDir, mode === "mpa" ? "__dirwell" : "");
    const assets = await readdir(assetDir);
    assert.ok(assets.some((asset) => asset.startsWith("theme-icon-") && asset.endsWith(".svg")));
    assert.equal(
      assets.some((asset) => asset.startsWith("vscode-")),
      false,
    );
    assert.match(
      await readFile(path.join(assetDir, "theme-icons-NOTICE.txt"), "utf8"),
      /MIT License/,
    );
  }
});
