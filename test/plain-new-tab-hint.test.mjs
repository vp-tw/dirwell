import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { generateExplorer } from "../packages/core/dist/index.mjs";
import { createPlainTheme } from "../packages/theme-plain/src/index.ts";
for (const mode of ["ssg", "mpa"])
  test(`Plain ${mode}: keep new tabs and describe them without repeated row captions`, async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-plain-hint-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const sourceDir = path.join(root, "files");
    await mkdir(path.join(sourceDir, "docs"), { recursive: true });
    await writeFile(path.join(sourceDir, "note.txt"), "Native contents");
    for (const columns of [undefined, ["name", "size"]]) {
      const outputDir = path.join(root, columns ? "columns" : "default");
      await generateExplorer({
        sourceDir,
        outputDir,
        mode,
        theme: createPlainTheme({
          columns,
          actions: ["download"],
          labels: { newTab: "New tab <hint>" },
        }),
      });
      const html = await readFile(path.join(outputDir, "index.html"), "utf8");
      assert.match(
        html,
        /aria-describedby="dw-plain-new-tab" href="note.txt" target="_blank" rel="noopener"/,
      );
      assert.match(html, /<span id="dw-plain-new-tab" hidden>New tab &lt;hint&gt;<\/span>/);
      assert.equal(html.match(/New tab &lt;hint&gt;/g)?.length, 1);
      assert.doesNotMatch(html, /<small>[^<]*New tab|<script/);
      assert.match(html, /<a href="docs\/index.html">docs\//);
      assert.match(html, /<a download href="note.txt">Download/);
    }
  });
