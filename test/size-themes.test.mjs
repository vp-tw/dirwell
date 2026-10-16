import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  generateExplorer,
  compareEntries,
  createDirectoryService,
} from "../packages/core/dist/index.mjs";
import { formatBytes } from "../packages/core/dist/format.mjs";
import { createPlainTheme } from "../packages/theme-plain/dist/index.mjs";
import { createLedgerTheme } from "../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../packages/theme-crosswave/dist/index.mjs";
import { build } from "esbuild";

for (const creator of [createPlainTheme, createLedgerTheme, createCrosswaveTheme]) {
  for (const mode of ["ssg", "mpa"])
    test(`${creator.name} ${mode}: shared defaults, size options and raw bytes`, async (t) => {
      const root = await mkdtemp(path.join(tmpdir(), "dirwell-size-theme-"));
      t.after(() => rm(root, { recursive: true, force: true }));
      const sourceDir = path.join(root, "source");
      await mkdir(sourceDir);
      await writeFile(path.join(sourceDir, "file.bin"), Buffer.alloc(1536));
      await writeFile(path.join(sourceDir, "medium.bin"), Buffer.alloc(100));
      await symlink("file.bin", path.join(sourceDir, "alias"));
      await symlink("missing", path.join(sourceDir, "broken"));
      for (const [suffix, options] of [
        ["default", {}],
        ["decimal", { size: { units: "decimal", exact: "none", symlink: "target" } }],
        ["bytes", { size: { units: "bytes", symlink: "entry" } }],
      ]) {
        const outputDir = path.join(root, suffix);
        await generateExplorer({
          sourceDir,
          outputDir,
          mode,
          theme: creator(options),
          sort: { field: "targetSize" },
        });
        const html = await readFile(path.join(outputDir, "index.html"), "utf8");
        assert.match(
          html,
          suffix === "decimal" ? /1.54 kB/ : suffix === "bytes" ? /1,536 B/ : /1.5 KiB/,
        );
        if (suffix === "default") {
          assert.match(html, /size-label">Target/);
          assert.match(html, /size-label">Link/);
          assert.match(html, /Unavailable/);
        }
        if (suffix === "decimal") assert.doesNotMatch(html, /<details class="dw-size"/);
        if (creator === createPlainTheme) assert.doesNotMatch(html, /<script/);
      }
      const directory = await (await createDirectoryService({ root: sourceDir })).listDirectory("");
      const alias = directory.entries.find((e) => e.name === "alias");
      const file = directory.entries.find((e) => e.name === "file.bin");
      assert.equal(alias.symlink.targetSize, 1536);
      assert.equal(file.metadata.size, 1536);
      assert(compareEntries(alias, file, { field: "size", directoriesFirst: false }) < 0);
      for (const direction of ["asc", "desc"]) {
        const sorted = await (
          await createDirectoryService({
            root: sourceDir,
            sort: { field: "targetSize", direction, directoriesFirst: false },
          })
        ).listDirectory("");
        assert.equal(sorted.entries.at(-1).name, "broken");
        assert.equal(
          sorted.entries.findIndex((e) => e.name === "medium.bin") <
            sorted.entries.findIndex((e) => e.name === "alias"),
          direction === "asc",
        );
      }
    });
}

test("public formatter bundles for browsers without Node modules", async () => {
  const result = await build({
    stdin: {
      contents:
        'import {formatBytes} from "@dirwell/core/format"; globalThis.formatted= formatBytes(1536);',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "browser",
    write: false,
    metafile: true,
  });
  assert.equal(
    Object.keys(result.metafile.inputs).some(
      (name) => name.includes("filesystem") || name.includes("generator"),
    ),
    false,
  );
  assert.equal(formatBytes(1536), "1.5 KiB");
});
