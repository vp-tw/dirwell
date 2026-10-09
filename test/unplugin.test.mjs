import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createCrosswaveTheme } from "../src/theme-crosswave.ts";
import unplugin from "../src/unplugin.ts";

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
      key === "theme" && value?.name === "crosswave" ? "__crosswave__" : value,
    );
    const source = `import { createCrosswaveTheme } from ${JSON.stringify(new URL("../src/theme-crosswave.ts", import.meta.url).pathname)};
      import unplugin from ${JSON.stringify(new URL("../src/unplugin.ts", import.meta.url).pathname)};
      const result = await Bun.build({entrypoints: [${JSON.stringify(entry)}], outdir: ${JSON.stringify(out)}, plugins: [unplugin.bun(JSON.parse(${JSON.stringify(serialized)}, (key, value) => value === "__crosswave__" ? createCrosswaveTheme() : value))]});
      if (!result.success) throw new Error(result.logs.join("\\n"));`;
    await promisify(execFile)("bun", ["--eval", source]);
  }
}

for (const host of [
  "rollup",
  "rolldown",
  "webpack",
  "rspack",
  "rsbuild",
  "esbuild",
  "farm",
  "bun",
]) {
  test(`${host}: real build publishes SSG/MPA assets alongside the host bundle`, async (context) => {
    const root = await fixture(context);
    await mkdir(path.join(root, "files", "nested"));
    await writeFile(path.join(root, "files", "nested", "inside.txt"), "nested");
    await compile(host, root, [
      {
        cwd: root,
        root: "files",
        outputPath: "wave-ssg",
        mode: "ssg",
        theme: createCrosswaveTheme(),
      },
      {
        cwd: root,
        root: "files",
        outputPath: "wave-mpa",
        mode: "mpa",
        theme: createCrosswaveTheme(),
      },
      { cwd: root, root: "files", outputPath: "catalog", mode: "ssg" },
      { cwd: root, root: "files", outputPath: "downloads", mode: "mpa" },
    ]);
    const html = await readFile(path.join(root, "dist/catalog/index.html"), "utf8");
    assert.match(html, /note\.txt/);
    assert.equal(await readFile(path.join(root, "dist/catalog/note.txt"), "utf8"), "original\n");
    assert.match(await readFile(path.join(root, "dist/downloads/index.html"), "utf8"), /__dirwell/);
    assert.ok(
      (await readFile(path.join(root, "dist/downloads/__dirwell/dirwell.runtime.js"))).length > 0,
    );
    for (const mode of ["ssg", "mpa"]) {
      const wave = path.join(root, `dist/wave-${mode}`);
      const html = await readFile(path.join(wave, "nested/index.html"), "utf8");
      assert.match(html, /data-cw-page=/);
      const attribute = html.match(/<main[^>]*data-cw-page=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/);
      const asset = attribute?.[1] ?? attribute?.[2] ?? attribute?.[3];
      assert.ok(asset);
      const assetPath =
        mode === "ssg"
          ? path.join(wave, "nested", path.basename(asset))
          : path.join(wave, "__dirwell", path.basename(asset));
      const data = await readFile(assetPath, "utf8");
      assert.match(data, /dirwell:crosswave-page/);
      assert.match(data, /inside\.txt/);
      assert.equal(data.includes(root), false);
    }
    await writeFile(path.join(root, "files", "added.txt"), "new file\n");
    await rm(path.join(root, "files", "note.txt"));
    await compile(host, root, { cwd: root, root: "files", outputPath: "catalog" });
    await assert.rejects(readFile(path.join(root, "dist/catalog/note.txt")), { code: "ENOENT" });
    assert.match(await readFile(path.join(root, "dist/catalog/index.html"), "utf8"), /added\.txt/);
  });
}

test("adapters reject overlapping or escaping output paths before a build", () => {
  assert.throws(() => unplugin.rollup([]), /must not be empty/);
  assert.throws(
    () => unplugin.rollup([{ outputPath: "files" }, { outputPath: "files/nested" }]),
    /overlapping/,
  );
  for (const outputPath of ["", "/", "../files", "files/../other", "files\\other"]) {
    assert.throws(() => unplugin.rollup({ outputPath }), /dedicated relative path/);
  }
});

test("adapter refuses to overwrite unrelated files beneath its output path", async (context) => {
  const root = await fixture(context);
  await mkdir(path.join(root, "dist/dirwell"), { recursive: true });
  await writeFile(path.join(root, "dist/dirwell", "user.txt"), "preserve\n");
  await assert.rejects(compile("rollup", root, { cwd: root, root: "files" }), /unowned outputPath/);
  assert.equal(await readFile(path.join(root, "dist/dirwell/user.txt"), "utf8"), "preserve\n");
});

for (const host of ["rollup", "rolldown", "webpack", "rspack", "esbuild"]) {
  test(
    `${host}: watch rebuilds for created and deleted source files`,
    { timeout: 20_000 },
    async (context) => {
      const root = await fixture(context);
      const options = { cwd: root, root: "files" };
      let changed;
      let next = () =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`${host} did not rebuild`)), 10_000);
          changed = (error) => {
            clearTimeout(timer);
            if (error) reject(error);
            else resolve();
          };
        });
      let ready = next();
      if (host === "rollup" || host === "rolldown") {
        const api = await import(host);
        const watcher = api.watch({
          input: path.join(root, "entry.js"),
          output: { dir: path.join(root, "dist") },
          plugins: unplugin[host](options),
        });
        context.after(() => watcher.close());
        watcher.on("event", async (event) => {
          if (event.code === "ERROR") changed(event.error);
          if (event.code === "BUNDLE_END") {
            await event.result.close();
            if (host !== "rolldown") changed();
          }
          if (host === "rolldown" && event.code === "END") changed();
        });
      } else if (host === "webpack" || host === "rspack") {
        const api = await import(host === "webpack" ? "webpack" : "@rspack/core");
        const compiler = (host === "webpack" ? api.default : api.rspack)({
          mode: "development",
          context: root,
          entry: "./entry.js",
          output: { path: path.join(root, "dist") },
          plugins: [unplugin[host](options)],
        });
        const watcher = compiler.watch({}, (error, stats) =>
          changed(error ?? (stats.hasErrors() ? new Error(stats.toString()) : undefined)),
        );
        context.after(async () => {
          await new Promise((resolve) => watcher.close(resolve));
          await new Promise((resolve) => compiler.close(resolve));
        });
      } else {
        const { context: createContext } = await import("esbuild");
        const build = await createContext({
          absWorkingDir: root,
          entryPoints: ["entry.js"],
          bundle: true,
          outdir: "dist",
          plugins: [
            unplugin.esbuild(options),
            {
              name: "readback",
              setup(build) {
                build.onEnd((result) => {
                  changed(result.errors.length ? new Error(result.errors[0].text) : undefined);
                });
              },
            },
          ],
        });
        context.after(() => build.dispose());
        await build.watch();
      }
      await ready;
      for (let cycle = 0; cycle < (host === "rolldown" ? 3 : 1); cycle++) {
        ready = next();
        await writeFile(path.join(root, "files", "created.txt"), "watch addition\n");
        await ready;
        assert.match(
          await readFile(path.join(root, "dist/dirwell/index.html"), "utf8"),
          /created\.txt/,
        );
        ready = next();
        await rm(path.join(root, "files", "created.txt"));
        await ready;
        assert.doesNotMatch(
          await readFile(path.join(root, "dist/dirwell/index.html"), "utf8"),
          /created\.txt/,
        );
        await assert.rejects(readFile(path.join(root, "dist/dirwell/created.txt")), {
          code: "ENOENT",
        });
      }
    },
  );
}
