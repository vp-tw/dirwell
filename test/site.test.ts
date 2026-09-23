import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("landing page exposes every live example and source directory", async () => {
  const source = await readFile(path.join(root, "docs/src/pages/index.astro"), "utf8");
  for (const slug of ["basic", "base-path", "custom-theme", "file-icons", "plain"]) {
    assert.match(source, new RegExp(`slug: "${slug}"`));
    assert.match(source, /examples\/\$\{example\.slug\}/);
  }
  assert.match(source, /PUBLIC_REPOSITORY_URL/);
  assert.match(source, /tree\/main\/examples/);
});

test("site build combines docs and examples in one publish directory", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.equal(packageJson.scripts["site:build"], "pnpm run docs:build && pnpm run examples:build");

  const buildScript = await readFile(path.join(root, "scripts/build-examples.ts"), "utf8");
  assert.match(buildScript, /\["basic", "base-path", "custom-theme", "file-icons", "plain"\]/);
  assert.match(buildScript, /"build",\s*"files"/);
});

test("GitHub Pages derives repository URLs and deployment base at build time", async () => {
  const workflow = await readFile(path.join(root, ".github/workflows/pages.yml"), "utf8");
  assert.match(
    workflow,
    /PUBLIC_REPOSITORY_URL: https:\/\/github\.com\/\$\{\{ github\.repository \}\}/,
  );
  assert.match(workflow, /SITE_BASE: \/\$\{\{ github\.event\.repository\.name \}\}\//);
  assert.match(workflow, /path: site/);
});

test("explorer preview build is scoped to the fixture directory", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts["build:explorer"],
    "node src/bin.ts build fixture --out-dir generated",
  );
});
