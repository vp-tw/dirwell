import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateExplorer } from "../packages/core/dist/index.mjs";

test("favicon guide snippets create usable themes from their documented local inputs", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-favicon-guide-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const originalCwd = process.cwd();
  t.after(() => process.chdir(originalCwd));
  await mkdir(path.join(root, "files"));
  await mkdir(path.join(root, "brand"));
  const png = await readFile(new URL("../docs/public/brand/favicon-32.png", import.meta.url));
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14"/></svg>';
  await writeFile(path.join(root, "favicon.png"), png);
  await writeFile(path.join(root, "brand/favicon.png"), png);
  for (const name of ["light", "dark"]) await writeFile(path.join(root, `brand/${name}.svg`), svg);
  const markdown = await readFile(
    new URL("../docs/src/content/docs/themes.md", import.meta.url),
    "utf8",
  );
  const section = markdown.slice(
    markdown.indexOf("### Favicons"),
    markdown.indexOf("## Crosswave options"),
  );
  const snippets = [...section.matchAll(/```js\n([\s\S]*?)\n```/g)].map((match) => match[1]);
  assert.equal(snippets.length, 5);
  process.chdir(root);
  for (const [index, snippet] of snippets.entries()) {
    const script = `import { createLedgerTheme as factory } from ${JSON.stringify(new URL("../packages/theme-ledger/dist/index.mjs", import.meta.url).href)};\nexport const themes = [];\nconst createLedgerTheme = (options) => { const theme = factory(options); themes.push(theme); return theme; };\n${snippet.replace(/import \{ createLedgerTheme \} from "@dirwell\/theme-ledger";\n/, "")}`;
    const modulePath = path.join(root, `example-${index}.mjs`);
    await writeFile(modulePath, script);
    const { themes } = await import(pathToFileURL(modulePath).href);
    assert.ok(themes.length > 0);
    for (const theme of themes) {
      await generateExplorer({ sourceDir: "files", outputDir: "generated", theme });
      const html = await readFile(path.join(root, "generated/index.html"), "utf8");
      for (const [, href] of html.matchAll(/<link rel="icon" href="([^"]+)"/g)) {
        if (href.startsWith("/")) continue;
        assert.ok((await readFile(path.join(root, "generated", href))).length > 0);
      }
    }
  }
});
