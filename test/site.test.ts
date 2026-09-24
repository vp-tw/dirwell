import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("landing page exposes every live example and source directory", async () => {
  const source = await readFile(path.join(root, "docs/src/pages/index.astro"), "utf8");
  for (const slug of ["basic", "base", "custom-theme", "default-theme-override", "plain"]) {
    assert.match(source, new RegExp(`slug: "${slug}"`));
    assert.match(source, /examplePath\(example\.slug\)/);
  }
  assert.match(source, /PUBLIC_REPOSITORY_URL/);
  assert.match(source, /https:\/\/github\.com\/vp-tw\/dirwell/);
  assert.match(source, /tree\/main\/examples/);
});

test("site build combines docs and examples in one publish directory", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.equal(packageJson.scripts["site:build"], "pnpm run examples:build && pnpm run docs:build");
  assert.equal(packageJson.scripts["docs:dev"], "node scripts/dev-docs.ts");

  const buildScript = await readFile(path.join(root, "scripts/build-examples.ts"), "utf8");
  const exampleList = buildScript.match(/const examples = \[([\s\S]*?)\] as const;/)?.[1];
  assert.ok(exampleList);
  assert.deepEqual(
    [...exampleList.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    ["basic", "base", "custom-theme", "default-theme-override", "file-icons", "plain"],
  );
  assert.match(buildScript, /plugins: dirwellVite\(options\)/);
  assert.match(buildScript, /loadDirwellConfig\(exampleRoot, "build"\)/);
  for (const slug of [
    "basic",
    "base",
    "custom-theme",
    "default-theme-override",
    "file-icons",
    "plain",
  ]) {
    const config = await readFile(path.join(root, `examples/${slug}/dirwell.config.ts`), "utf8");
    assert.match(config, new RegExp(`docs/public/examples/${slug}`));
  }
  assert.match(buildScript, /path\.join\(publishedExamples, "\.build-id"\)/);
});

test("landing preview embeds generated default theme instead of duplicate markup", async () => {
  const source = await readFile(path.join(root, "docs/src/pages/index.astro"), "utf8");
  assert.match(source, /src=\{examplePath\("file-icons"\)\}/);
  assert.match(source, /title="Interactive Dirwell default theme preview"/);
  assert.match(source, /data-build-id-url=\{path\("examples\/\.build-id"\)\}/);
  assert.doesNotMatch(source, /class="file-row"/);
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
