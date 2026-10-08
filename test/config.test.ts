import assert from "node:assert/strict";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { renderUsage } from "citty";
import { buildCommand, mainCommand } from "../src/cli.ts";
import { loadDirwellConfig, resolveGenerateOptions, validateConfig } from "../src/config.ts";

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "dirwell-config-"));
}

test("loads zero-config defaults", async (context) => {
  const cwd = await temporaryDirectory();
  context.after(() => rm(cwd, { recursive: true, force: true }));

  const loaded = await loadDirwellConfig(cwd, "build");
  const resolved = resolveGenerateOptions(cwd, loaded.config);

  assert.equal(loaded.configFile, null);
  assert.equal(resolved.sourceDir, cwd);
  assert.equal(resolved.outputDir, path.join(cwd, "dist"));
});

test("loads TypeScript function configs and local extends", async (context) => {
  const cwd = await temporaryDirectory();
  context.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(
    path.join(cwd, "base.config.ts"),
    'export default { mode: "mpa", mirror: false };\n',
  );
  await writeFile(
    path.join(cwd, "dirwell.config.ts"),
    `export default (context) => ({
      extends: "./base.config.ts",
      root: context.command === "serve" ? "preview" : "public",
      outDir: "site",
    });\n`,
  );

  const loaded = await loadDirwellConfig(cwd, "serve");

  assert.equal(loaded.config.root, "preview");
  assert.equal(loaded.config.outDir, "site");
  assert.equal(loaded.config.mode, "mpa");
  assert.equal(loaded.config.mirror, false);
  assert.equal(loaded.configFile, path.join(await realpath(cwd), "dirwell.config.ts"));
});

test("rejects invalid runtime config", async (context) => {
  const cwd = await temporaryDirectory();
  context.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(path.join(cwd, "dirwell.config.ts"), 'export default { mode: "spa" };\n');

  await assert.rejects(() => loadDirwellConfig(cwd, "build"), /mode must be either/);
});

test("validates and resolves URL configuration", async (context) => {
  const cwd = await temporaryDirectory();
  context.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(
    path.join(cwd, "dirwell.config.ts"),
    'export default { base: "/repo/", urls: "html-base" };\n',
  );
  const loaded = await loadDirwellConfig(cwd, "build");
  const resolved = resolveGenerateOptions(cwd, loaded.config);
  assert.equal(resolved.base, "/repo/");
  assert.equal(resolved.urlStrategy, "html-base");

  await writeFile(path.join(cwd, "dirwell.config.ts"), 'export default { urls: "magic" };\n');
  await assert.rejects(() => loadDirwellConfig(cwd, "build"), /urls must be/);
});

test("validates and resolves sorting configuration", async (context) => {
  const cwd = await temporaryDirectory();
  context.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(
    path.join(cwd, "dirwell.config.ts"),
    'export default { sort: { field: "modified", direction: "desc", directoriesFirst: false } };\n',
  );
  const loaded = await loadDirwellConfig(cwd, "build");
  assert.deepEqual(resolveGenerateOptions(cwd, loaded.config).sort, {
    direction: "desc",
    directoriesFirst: false,
    field: "modified",
  });

  await writeFile(
    path.join(cwd, "dirwell.config.ts"),
    'export default { sort: { nameMode: "magic" } };\n',
  );
  await assert.rejects(() => loadDirwellConfig(cwd, "build"), /sort.nameMode must be/);
});

test("include and exclude accept source-relative globs and reject ambiguous patterns", async () => {
  const config = { include: ["**/*.md", "docs/**"], exclude: ".env" };
  validateConfig(config);
  assert.deepEqual(resolveGenerateOptions("/project", config).include, config.include);
  assert.equal(resolveGenerateOptions("/project", config).exclude, ".env");
  for (const invalid of [
    "",
    "/absolute/**",
    "C:/secret/**",
    "../secret",
    "docs\\**",
    "!private/**",
    42,
  ]) {
    assert.throws(() => validateConfig({ include: invalid }), /root-relative glob patterns/);
  }
  assert.throws(
    () => validateConfig({ exclude: ["*.md", "../private/**"] }),
    /root-relative glob patterns/,
  );
});

test("CLI help exposes zero-config usage and primary commands", async () => {
  const usage = await renderUsage(mainCommand);
  assert.match(usage, /dirwell build\|daemon\|serve\|dev/);
  assert.match(usage, /Build and serve a static file explorer/);
  assert.match(usage, /Generate a deployable static file explorer/);
  assert.match(usage, /Watch files and serve the explorer with live reload/);
  assert.match(usage, /Manage a detached file explorer server/);
  const buildUsage = await renderUsage(buildCommand);
  assert.match(buildUsage, /--base/);
  assert.match(buildUsage, /--urls/);
});
