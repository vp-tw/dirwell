import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const sources = {
  "@dirwell/core": "../packages/core/dist/index.mjs",
  "@dirwell/theme-plain": "../packages/theme-plain/dist/index.mjs",
  "@dirwell/theme-ledger": "../packages/theme-ledger/dist/index.mjs",
  "@dirwell/server": "../packages/server/dist/index.mjs",
  "@dirwell/server/node": "../packages/server/dist/node.mjs",
};
test("SDK guide code exercises threshold pagination, server shutdown and handler configuration", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-doc-example-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "files"));
  await Promise.all(
    Array.from({ length: 501 }, (_, index) =>
      writeFile(path.join(root, "files", `${index}.txt`), "file"),
    ),
  );
  const guide = await readFile(new URL("../docs/src/content/docs/sdk.md", import.meta.url), "utf8");
  const snippets = [...guide.matchAll(/```js\n([\s\S]*?)\n```/g)].map((match) => match[1]);
  assert.equal(snippets.length, 3);
  for (let snippet of snippets) {
    for (const [name, source] of Object.entries(sources))
      snippet = snippet.replaceAll(
        JSON.stringify(name),
        JSON.stringify(new URL(source, import.meta.url).href),
      );
    if (snippet.includes("const server = await startExplorerServer"))
      snippet += `\ntry {
        const page = await fetch(server.url + '/browse/');
        if (page.status !== 200 || !(await page.text()).includes('data-dirwell-theme'))
          throw new Error('The running guide server did not return its HTML');
        const response = await fetch(server.url + '/__dirwell/search?q=0.txt');
        const data = await response.json();
        if (response.status !== 200 || data.version !== 1 || !data.results.some(result => result.path === '0.txt'))
          throw new Error('The running guide server did not return its live query');
      } finally { await server.close(); }`;
    execFileSync(process.execPath, ["--input-type=module", "--eval", snippet], {
      cwd: root,
      timeout: 20000,
    });
  }
  const html = await readFile(path.join(root, "public/downloads/index.html"), "utf8");
  assert.match(html, /Page 1 of 6/);
  assert.doesNotMatch(html, /<script|og:image/);
});
