import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createPlainTheme } from "../packages/theme-plain/src/index.ts";
import unplugin from "../packages/integrations/src/unplugin.ts";

async function fixture(context) {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-host-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "files"));
  await writeFile(path.join(root, "files", "note.txt"), "original\n");
  await writeFile(path.join(root, "entry.js"), "console.log('host application');\n");
  return root;
}

async function compile(host, root, options) {
  const out = path.join(root, "dist");
  const entry = path.join(root, "entry.js");
  if (host === "rollup" || host === "rolldown") {
    const api = await import(host);
    const bundle = await api[host]({ input: entry, plugins: unplugin[host](options) });
    try {
      await bundle.write({ dir: out, format: "es" });
    } finally {
      await bundle.close();
    }
  } else if (host === "webpack" || host === "rspack") {
    const api = await import(host === "webpack" ? "webpack" : "@rspack/core");
    const compiler = (host === "webpack" ? api.default : api.rspack)({
      mode: "production",
      context: root,
      entry,
      output: { path: out, filename: "host.js" },
      plugins: [unplugin[host](options)],
    });
    try {
      await new Promise((resolve, reject) =>
        compiler.run((error, stats) =>
          error
            ? reject(error)
            : stats.hasErrors()
              ? reject(new Error(stats.toString()))
              : resolve(),
        ),
      );
    } finally {
      await new Promise((resolve, reject) =>
        compiler.close((error) => (error ? reject(error) : resolve())),
      );
    }
  } else if (host === "rsbuild") {
    const { createRsbuild } = await import("@rsbuild/core");
    const rsbuild = await createRsbuild({
      cwd: root,
      rsbuildConfig: {
        performance: { printFileSize: false },
        source: { entry: { index: entry } },
        output: { distPath: { root: out }, cleanDistPath: false },
        plugins: [unplugin.rsbuild(options)],
      },
    });
    await rsbuild.build();
  } else if (host === "esbuild") {
    const { build } = await import("esbuild");
    await build({
      absWorkingDir: root,
      entryPoints: [entry],
      outdir: out,
      bundle: true,
      plugins: [unplugin.esbuild(options)],
    });
  } else if (host === "farm") {
    const { resolveConfig, createCompiler, Logger } = await import("@farmfe/core");
    const logger = new Logger({ level: "error" });
    const config = await resolveConfig(
      {
        root,
        compilation: {
          input: { index: entry },
          output: { path: out },
          persistentCache: false,
          lazyCompilation: false,
        },
        plugins: [unplugin.farm(options)],
      },
      "production",
      logger,
      false,
    );
    const compiler = await createCompiler(config, logger);
    await compiler.compile();
    compiler.writeResourcesToDisk();
  } else if (host === "bun") {
    const serialized = JSON.stringify(options, (key, value) =>
      key === "theme" && value?.name === "plain" ? "__plain__" : value,
    );
    const source = `import { createPlainTheme } from ${JSON.stringify(new URL("../packages/theme-plain/src/index.ts", import.meta.url).pathname)};
      import unplugin from ${JSON.stringify(new URL("../packages/integrations/src/unplugin.ts", import.meta.url).pathname)};
      const result = await Bun.build({entrypoints: [${JSON.stringify(entry)}], outdir: ${JSON.stringify(out)}, plugins: [unplugin.bun(JSON.parse(${JSON.stringify(serialized)}, (key, value) => value === "__plain__" ? createPlainTheme() : value))]});
      if (!result.success) throw new Error(result.logs.join("\\n"));`;
    await promisify(execFile)("bun", ["--eval", source]);
  }
}

for (const host of ["rollup", "rolldown", "webpack", "rspack", "rsbuild", "esbuild", "farm", "bun"])
  test(`new integration package: ${host} builds Plain without a legacy default`, async (context) => {
    const root = await fixture(context);
    await compile(host, root, { cwd: root, root: "files", theme: createPlainTheme() });
    const html = await readFile(path.join(root, "dist/dirwell/index.html"), "utf8");
    assert.match(html, /note.txt/);
    assert.doesNotMatch(html, /<script|og:image|theme-runtime/);
    assert.equal(await readFile(path.join(root, "dist/dirwell/note.txt"), "utf8"), "original\n");
  });

test("new integrations reject missing theme and ignore legacy config discovery", async (context) => {
  const root = await fixture(context);
  await writeFile(
    path.join(root, "dirwell.config.mjs"),
    "throw new Error('legacy config must not load');",
  );
  await assert.rejects(compile("rollup", root, { cwd: root, root: "files" }), /explicit theme/);
  await compile("rollup", root, { cwd: root, root: "files", theme: createPlainTheme() });
});

test("new Vite adapter uses explicit theme and protects an unowned output", async (context) => {
  const root = await fixture(context);
  await writeFile(path.join(root, "index.html"), "<main>Host application</main>");
  const { build } = await import("vite-upstream");
  const { default: dirwell } = await import("../packages/integrations/src/vite.ts");
  const config = {
    root,
    configFile: false,
    base: "/app/",
    logLevel: "silent",
    plugins: [dirwell({ root: "files", theme: createPlainTheme() })],
    build: { outDir: "dist", emptyOutDir: false },
  };
  await build(config);
  assert.match(await readFile(path.join(root, "dist/dirwell/index.html"), "utf8"), /note.txt/);
  await rm(path.join(root, "dist/dirwell/.dirwell-vite-output"));
  await assert.rejects(build(config), /unowned/);
});
