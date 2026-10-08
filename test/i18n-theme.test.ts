import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { generateExplorer } from "../src/index.ts";
import { internationalTheme } from "../examples/i18n/theme.ts";

test("i18n theme preserves safe links and complete static HTML in SSG and MPA", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-i18n-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, "files");
  await mkdir(path.join(sourceDir, "empty"), { recursive: true });
  await writeFile(path.join(sourceDir, '<unsafe "name">.txt'), "contents");
  for (const mode of ["ssg", "mpa"] as const) {
    const outputDir = path.join(root, mode);
    await generateExplorer({ sourceDir, outputDir, mode, theme: internationalTheme });
    const html = await readFile(path.join(outputDir, "index.html"), "utf8");
    assert.match(html, /<html lang="en">/);
    assert.match(html, /&lt;unsafe &quot;name&quot;&gt;\.txt/);
    assert.doesNotMatch(html, /<unsafe/);
    assert.match(html, /2 entries/);
    assert.match(html, / UTC<\/time>/);
    assert.match(html, /target="_blank" rel="noopener"/);
    assert.match(
      await readFile(path.join(outputDir, "empty/index.html"), "utf8"),
      /This directory is empty/,
    );
    const asset = path.join(outputDir, mode === "mpa" ? "__dirwell/i18n.js" : "i18n.js");
    assert.match(await readFile(asset, "utf8"), /Intl\.PluralRules/);
    assert.match(await readFile(asset, "utf8"), /element\.textContent/);
  }
});
