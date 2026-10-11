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
    assert.match(html, /<h1>Release catalog<\/h1>/);
    assert.match(html, /href="stable\/"/);
    assert.doesNotMatch(html, /dirwell\.runtime\.js|data-search-input|file-icon/);
    const assetDir = path.join(outputDir, mode === "mpa" ? "__dirwell" : "");
    assert.match(await readFile(path.join(assetDir, "release-catalog.css"), "utf8"), /main/);
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

for (const [slug, name, child, childCounts] of [
  ["basic", "Sample downloads", "releases", "1 folder"],
  ["plain", "Sample downloads", "releases", "1 folder"],
  ["crosswave", "Sample media files", "Photos", "1 file"],
] as const) {
  test(`${slug}: previews identify content and distinguish folder counts from archive totals`, async (context) => {
    const { loadDirwellConfig, resolveGenerateOptions } = await import("../src/config.ts");
    const exampleRoot = path.join(examples, slug);
    const { config } = await loadDirwellConfig(exampleRoot, "build");
    const outputDir = await mkdtemp(path.join(tmpdir(), "dirwell-example-preview-"));
    context.after(() => rm(outputDir, { recursive: true, force: true }));
    for (const mode of ["ssg", "mpa"] as const) {
      await generateExplorer(
        resolveGenerateOptions(exampleRoot, {
          ...config,
          mode,
          outDir: outputDir,
          metadata: { ...config.metadata, siteUrl: `https://example.com/${slug}/` },
        }),
      );
      const root = await readFile(path.join(outputDir, "index.html"), "utf8");
      const nested = await readFile(path.join(outputDir, child, "index.html"), "utf8");
      assert.ok(root.includes(`<title>${name} · `));
      assert.ok(root.includes("Archive totals:"));
      assert.ok(nested.includes(`<title>${child} · ${name}</title>`));
      assert.ok(nested.includes(`This folder: ${childCounts}.`));
      const image = (html: string) => html.match(/property="og:image" content="([^"]+)"/)?.[1];
      assert.ok(image(root)?.startsWith(`https://example.com/${slug}/`));
      assert.equal(image(root), image(nested));
      assert.equal(
        root.match(/property="og:image:alt" content="([^"]+)"/)?.[1],
        nested.match(/property="og:image:alt" content="([^"]+)"/)?.[1],
      );
      assert.equal((await readdir(path.join(outputDir, "__dirwell/metadata"))).length, 1);
    }
  });
}
