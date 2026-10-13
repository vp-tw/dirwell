import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { generateExplorer } from "@dirwell/core";
import { createExampleTheme } from "../examples/theme-package/index.mjs";
import { runCli } from "@dirwell/cli";

test("current guides and public examples use only the SDK family", async () => {
  const docs = new URL("../docs/src/content/docs/", import.meta.url);
  for (const name of await readdir(docs)) {
    const source = await readFile(new URL(name, docs), "utf8");
    assert.doesNotMatch(source, /@vp-tw\/dirwell|createDefaultTheme|defaultThemeComponents/, name);
  }
  for (const file of [
    "../README.md",
    "../docs/src/pages/index.astro",
    "../docs/src/landing-code.ts",
  ]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /@vp-tw\/dirwell|createDefaultTheme/, file);
  }
});

test("README default CLI and independent public theme build and serve real files", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-current-guides-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "downloads/child"), { recursive: true });
  await writeFile(path.join(root, "downloads/child", "a & b.txt"), "proof");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  for (const command of [...readme.matchAll(/^npx @dirwell\/cli@alpha (.+)$/gm)].map(
    (match) => match[1],
  )) {
    const server = await runCli(command.split(" "), root, () => {});
    if (server) {
      try {
        const response = await fetch(server.url + "/browse/child/");
        assert.equal(response.status, 200);
        assert.match(await response.text(), /a &amp; b.txt/);
      } finally {
        await server.close();
      }
    }
  }
  const plain = await readFile(path.join(root, "site-downloads/index.html"), "utf8");
  assert.doesNotMatch(plain, /<script|og:image/);
  for (const mode of ["ssg", "mpa"]) {
    const outputDir = path.join(root, mode);
    await generateExplorer({
      sourceDir: path.join(root, "downloads"),
      outputDir,
      mode,
      theme: createExampleTheme({ title: "SDK & theme" }),
    });
    const html = await readFile(path.join(outputDir, "index.html"), "utf8");
    assert.match(html, /SDK &amp; theme/);
    const child = await readFile(path.join(outputDir, "child/index.html"), "utf8");
    assert.match(child, /a &amp; b.txt/);
    assert.match(child, /Parent directory/);
  }
});
