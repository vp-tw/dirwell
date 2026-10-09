import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createCrosswaveTheme, generateExplorer } from "../src/index.ts";

for (const mode of ["ssg", "mpa"] as const) {
  for (const urlStrategy of ["relative", "base", "html-base"] as const) {
    test(`Crosswave ${mode}/${urlStrategy}: original links, escaped labels, and shared assets`, async (t) => {
      const root = await mkdtemp(path.join(tmpdir(), "dirwell-crosswave-"));
      t.after(() => rm(root, { recursive: true, force: true }));
      const sourceDir = path.join(root, "files");
      const outputDir = path.join(root, "output");
      await mkdir(path.join(sourceDir, "nested"), { recursive: true });
      await writeFile(path.join(sourceDir, "a&<script>.txt"), "source bytes");
      await writeFile(path.join(sourceDir, "nested", "note.md"), "nested bytes");
      await symlink("missing.txt", path.join(sourceDir, "broken"));
      await generateExplorer({
        sourceDir,
        outputDir,
        mode,
        urlStrategy,
        base: "/library/",
        theme: createCrosswaveTheme({ color: "jade", project: { name: "Library <unsafe>" } }),
      });
      const html = await readFile(path.join(outputDir, "index.html"), "utf8");
      assert.match(html, /a&amp;&lt;script&gt;\.txt/);
      assert.doesNotMatch(html, /<script>\.txt/);
      assert.match(html, /Library &lt;unsafe&gt;/);
      assert.match(html, /Broken link · declared target only/);
      assert.match(html, /data-cw-color="jade"/);
      assert.equal(await readFile(path.join(outputDir, "a&<script>.txt"), "utf8"), "source bytes");
      assert.equal(await readFile(path.join(outputDir, "nested/note.md"), "utf8"), "nested bytes");
      const asset = mode === "mpa" ? "__dirwell/crosswave.js" : "crosswave.js";
      assert.match(await readFile(path.join(outputDir, asset), "utf8"), /getGamepads/);
      const nested = await readFile(path.join(outputDir, "nested/index.html"), "utf8");
      assert.match(nested, /data-cw-parent/);
      if (urlStrategy === "html-base") {
        assert.match(nested, /<base href="\/library\/">/);
        assert.match(nested, /class="cw-skip" href="nested\/#cw-panel"/);
      }
      assert.doesNotMatch(html, /search-index\.json/);
      assert.doesNotMatch(html, /source bytes/);
    });
  }
}

test("Crosswave rejects unsafe color and nonboolean runtime options", () => {
  assert.throws(
    () => createCrosswaveTheme({ color: "<script>" as never }),
    /Unknown Crosswave color/,
  );
  assert.throws(
    () => createCrosswaveTheme({ gamepad: "yes" as never }),
    /gamepad must be a boolean/,
  );
});
