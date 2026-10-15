import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { exampleCatalog, exampleGroups, publishedExampleSlugs } from "../examples/catalog.ts";

const root = path.resolve(import.meta.dirname, "..");

test("landing page distinguishes static demos from local server examples", async () => {
  const source = await readFile(path.join(root, "docs/src/pages/index.astro"), "utf8");
  assert.match(source, /exampleGroups\.map/);
  assert.match(source, /examplePath\(example\.slug\)/);
  assert.equal(new Set(exampleCatalog.map(({ slug }) => slug)).size, exampleCatalog.length);
  assert.deepEqual(
    exampleGroups[0].examples.map(({ name }) => name),
    ["Ledger", "Plain", "Crosswave"],
  );
  assert.equal(
    exampleCatalog.some(({ slug }) => String(slug) === "basic"),
    false,
  );
  assert.equal(publishedExampleSlugs.filter((slug) => slug === "basic").length, 1);
  assert.equal(exampleCatalog.at(-1)?.slug, "shared-cache");
  assert.equal(
    publishedExampleSlugs.some((slug) => String(slug) === "shared-cache"),
    false,
  );
  const serverExample = exampleCatalog.find(({ slug }) => slug === "shared-cache");
  assert.equal(serverExample?.preview, false);
  assert.match(source, /example\.preview/);
  assert.match(source, /path\(example\.guide\)/);
  const examplesDoc = await readFile(path.join(root, "docs/src/content/docs/examples.mdx"), "utf8");
  assert.match(examplesDoc, /exampleGroups\.map/);
  for (const { slug } of exampleCatalog) {
    await readFile(path.join(root, `examples/${slug}/README.md`), "utf8");
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
  assert.match(buildScript, /const examples = publishedExampleSlugs/);
  assert.match(buildScript, /await generateExplorer\(/);
  assert.match(buildScript, /examples\/\$\{example\}\/config\.ts/);
  for (const { slug } of exampleCatalog.filter(({ preview }) => preview)) {
    const config = await readFile(path.join(root, `examples/${slug}/config.ts`), "utf8");
    assert.match(config, new RegExp(`docs/public/examples/${slug}`));
  }
  assert.match(buildScript, /path\.join\(publishedExamples, "\.build-id"\)/);
});

test("landing preview embeds generated default theme instead of duplicate markup", async () => {
  const source = await readFile(path.join(root, "docs/src/pages/index.astro"), "utf8");
  assert.match(source, /src=\{examplePath\("file-icons"\)\}/);
  assert.match(source, /title="Interactive Dirwell Ledger preview"/);
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
    "node packages/cli/dist/bin.mjs build fixture --out generated",
  );
});

test("package metadata and release configuration use the public vp-tw scope", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
    name: string;
    bin: Record<string, string>;
    publishConfig: { access: string };
    repository: { url: string };
  };
  const changesetConfig = JSON.parse(
    await readFile(path.join(root, ".changeset/config.json"), "utf8"),
  ) as { access: string; baseBranch: string };
  assert.equal(packageJson.name, "@vp-tw/dirwell");
  assert.equal(packageJson.bin.dirwell, "./dist/bin.mjs");
  assert.equal(packageJson.repository.url, "git+https://github.com/vp-tw/dirwell.git");
  assert.equal(packageJson.publishConfig.access, "public");
  assert.equal(changesetConfig.access, "public");
  assert.equal(changesetConfig.baseBranch, "main");
});
