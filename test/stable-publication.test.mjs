import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, access } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { runCli, defineConfig } from "../packages/cli/dist/index.mjs";
import { generateExplorer, createDirectoryService } from "../packages/core/dist/index.mjs";
import { createPlainTheme } from "../packages/theme-plain/dist/index.mjs";
import { publishOutput } from "../packages/core/src/publication.ts";

async function fixture(context) {
  const cwd = await mkdtemp(path.join(tmpdir(), "dirwell-stable-"));
  context.after(() => rm(cwd, { recursive: true, force: true }));
  const source = path.join(cwd, "files");
  await mkdir(source);
  await writeFile(path.join(source, "public.txt"), "public");
  await writeFile(path.join(source, "private.txt"), "dummy fixture only");
  return { cwd, source, output: path.join(cwd, "output") };
}

test("nested exclusion typos fail in both modes before replacing output", async (context) => {
  const { cwd, output } = await fixture(context);
  await mkdir(output);
  await writeFile(path.join(output, "sentinel"), "previous output");
  const cases = [
    [{ build: { exlcude: ["private.txt"] } }, /build.exlcude.*build.exclude/],
    [{ server: { exlcude: ["private.txt"] } }, /server.exlcude.*server.exclude/],
    [{ server: { live: { interval: 30 } } }, /server.live.interval/],
    [{ build: { mirror: "false" } }, /build.mirror must be/],
    [{ build: { symlinks: { onCyle: "skip" } } }, /build.symlinks.onCyle/],
    [
      { listing: { html: { strategy: "paged", pageSzie: 2 }, data: { strategy: "all" } } },
      /listing.html.pageSzie/,
    ],
  ];
  for (const [i, [config, error]] of cases.entries()) {
    const filename = `config-${i}.mjs`;
    await writeFile(path.join(cwd, filename), `export default ${JSON.stringify(config)};`);
    for (const mode of ["build", "server"])
      await assert.rejects(
        runCli(
          [mode, "files", "--config", filename, ...(mode === "build" ? ["--out", "output"] : [])],
          cwd,
          () => {},
        ),
        error,
      );
    assert.equal(await readFile(path.join(output, "sentinel"), "utf8"), "previous output");
  }
  assert.throws(() => defineConfig({ build: { exlcude: [] } }), /build.exlcude/);
  assert.equal(
    typeof defineConfig({ server: { authorize: async () => true } }).server.authorize,
    "function",
  );
});

test("CLI uses optional cwd gitignore, explicit empty config disables it, and API discovers nothing", async (context) => {
  const { cwd, source, output } = await fixture(context);
  await writeFile(path.join(cwd, ".gitignore"), "/files/private.txt\n");
  await runCli(["build", "files", "--out", "output"], cwd, () => {});
  await assert.rejects(access(path.join(output, "private.txt")));
  await writeFile(path.join(cwd, "empty.mjs"), "export default {ignoreFiles: []};");
  await runCli(["build", "files", "--out", "output", "--config", "empty.mjs"], cwd, () => {});
  assert.equal(await readFile(path.join(output, "private.txt"), "utf8"), "dummy fixture only");
  await runCli(["build", "files", "--out", "output", "--no-ignore"], cwd, () => {});
  await generateExplorer({ sourceDir: source, outputDir: output, theme: createPlainTheme() });
  assert.equal(await readFile(path.join(output, "private.txt"), "utf8"), "dummy fixture only");
  await assert.rejects(
    runCli(["build", "files", "--out", "output", "--ignore-file", "missing"], cwd, () => {}),
    /ENOENT/,
  );
});

test("ordered ignore rules, base overrides and glob exclusions select the same static/live files", async (context) => {
  const { cwd, source, output } = await fixture(context);
  await mkdir(path.join(source, "drafts"));
  await writeFile(path.join(source, "drafts", "hidden.txt"), "hidden");
  await writeFile(path.join(source, "keep.log"), "keep");
  await writeFile(path.join(source, "drop.log"), "drop");
  const first = path.join(cwd, "shared.ignore"),
    second = path.join(cwd, "override.ignore");
  await writeFile(first, "*.log\ndrafts/\nprivate.txt\n");
  await writeFile(second, "!keep.log\n!drafts/hidden.txt\n");
  const ignoreFiles = [first, second].map((filename) => ({ path: filename, baseDir: source }));
  await generateExplorer({
    sourceDir: source,
    outputDir: output,
    theme: createPlainTheme(),
    ignoreFiles,
    exclude: ["keep.log"],
  });
  assert.deepEqual(
    (await readdir(output)).filter((name) => name !== "__dirwell"),
    ["index.html", "public.txt"],
  );
  const service = await createDirectoryService({
    root: source,
    ignoreFiles,
    exclude: ["keep.log"],
  });
  assert.deepEqual(
    (await service.listDirectory("")).entries.map((entry) => entry.name),
    ["public.txt"],
  );
  await assert.rejects(service.openFile("private.txt"), /Unavailable/);
  await writeFile(first, "");
  assert((await service.listDirectory("")).entries.some((entry) => entry.name === "private.txt"));
});

test("ownership requires force only for foreign outputs; dry-run writes nothing; force cannot replace source", async (context) => {
  const { cwd, source, output } = await fixture(context);
  await mkdir(output);
  await writeFile(path.join(output, "foreign.txt"), "retain");
  await assert.rejects(
    runCli(["build", "files", "--out", "output"], cwd, () => {}),
    /not owned.*--force/,
  );
  assert.equal(await readFile(path.join(output, "foreign.txt"), "utf8"), "retain");
  await runCli(["build", "files", "--out", "output", "-f"], cwd, () => {});
  await runCli(["build", "files", "--out", "output"], cwd, () => {});
  const messages = [];
  await runCli(["build", "files", "--out", "not-created/deep", "--dry-run"], cwd, (message) =>
    messages.push(message),
  );
  const plan = JSON.parse(messages[0]);
  assert.equal(plan.dryRun, true);
  assert.equal(plan.pages[0].outputName, "index.html");
  assert(plan.selectedPaths.includes("public.txt"));
  await assert.rejects(access(path.join(cwd, "not-created")));
  await assert.rejects(
    runCli(["build", "files", "--out", "files", "--force"], cwd, () => {}),
    /must not contain/,
  );
  assert.equal(await readFile(path.join(source, "public.txt"), "utf8"), "public");
});

test("failed rendering and failed final rename retain previous output", async (context) => {
  const { source, output, cwd } = await fixture(context);
  await generateExplorer({ sourceDir: source, outputDir: output, theme: createPlainTheme() });
  const previous = await readFile(path.join(output, "index.html"), "utf8");
  await assert.rejects(
    generateExplorer({
      sourceDir: source,
      outputDir: output,
      theme: {
        name: "bad",
        render() {
          throw new Error("render failed");
        },
      },
    }),
    /render failed/,
  );
  assert.equal(await readFile(path.join(output, "index.html"), "utf8"), previous);
  await assert.rejects(publishOutput(path.join(cwd, "missing-stage"), output, source), /ENOENT/);
  assert.equal(await readFile(path.join(output, "index.html"), "utf8"), previous);
  assert(!(await readdir(cwd)).some((name) => name.includes("-previous-")));
});

test("concurrent writers to one output fail clearly without bypassing a lock with force", async (context) => {
  const { source, output, cwd } = await fixture(context);
  let started, finish;
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const proceed = new Promise((resolve) => {
    finish = resolve;
  });
  const first = generateExplorer({
    sourceDir: source,
    outputDir: output,
    theme: {
      name: "blocking",
      async render() {
        started();
        await proceed;
        return { html: "<!doctype html><title>Complete</title>" };
      },
    },
  });
  await entered;
  try {
    await assert.rejects(
      generateExplorer({
        sourceDir: source,
        outputDir: output,
        theme: createPlainTheme(),
        outputPolicy: "replace",
      }),
      /locked by another build/,
    );
  } finally {
    finish();
    await first;
  }
  assert.match(await readFile(path.join(output, "index.html"), "utf8"), /Complete/);
  assert(!(await readdir(cwd)).some((name) => name.endsWith("-dirwell.lock")));
});

test("explicit missing ignore files fail before live startup; excluding the source root cannot be undone by a child", async (context) => {
  const { cwd, source } = await fixture(context);
  await assert.rejects(
    runCli(["server", "files", "--ignore-file", "missing"], cwd, () => {}),
    /ENOENT/,
  );
  await writeFile(path.join(cwd, ".gitignore"), "files/\n!files/public.txt\n");
  const messages = [];
  await runCli(["build", "files", "--out", "output", "--dry-run"], cwd, (message) =>
    messages.push(message),
  );
  assert.deepEqual(JSON.parse(messages[0]).selectedPaths, []);
  const service = await createDirectoryService({
    root: source,
    ignoreFiles: [path.join(cwd, ".gitignore")],
  });
  assert.deepEqual((await service.listDirectory("")).entries, []);
});
