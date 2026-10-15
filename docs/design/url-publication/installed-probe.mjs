// Copy into a disposable project with all nine local SDK tarballs installed.
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { generateExplorer, directoryRoute, resolveDirectoryUrls } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";
import { createLedgerTheme } from "@dirwell/theme-ledger";
import { createCrosswaveTheme } from "@dirwell/theme-crosswave";
import { createExplorerHandler } from "@dirwell/server";
import { runCli } from "@dirwell/cli";

await mkdir("routing-source/folder/nested", { recursive: true });
await writeFile("routing-source/folder/note.txt", "DOWNLOAD");
assert.equal(resolveDirectoryUrls(undefined), "explicit");
let builds = 0;
for (const directoryUrls of ["explicit", "slash", "clean"]) {
  for (const mode of ["ssg", "mpa"])
    for (const urlStrategy of ["relative", "base", "html-base"])
      for (const factory of [createPlainTheme, createLedgerTheme, createCrosswaveTheme]) {
        const report = await generateExplorer({
          sourceDir: "routing-source",
          outputDir: "routing-output",
          routing: { directoryUrls },
          mode,
          urlStrategy,
          base: "/downloads/",
          theme: factory(),
        });
        const expected = directoryRoute("folder", "index.html", directoryUrls);
        const page = report.pages.find((entry) => entry.directory === "folder");
        assert.equal(page.outputPath, expected.outputPath);
        assert.equal(page.publicPath, expected.publicPath);
        assert.match(await readFile("routing-output/" + expected.outputPath, "utf8"), /note.txt/);
        assert.equal(await readFile("routing-output/folder/note.txt", "utf8"), "DOWNLOAD");
        builds++;
      }
  const handler = await createExplorerHandler({
    root: "routing-source",
    mountPath: "/downloads",
    routing: { directoryUrls },
    theme: createPlainTheme(),
  });
  const root =
    "/downloads/browse" +
    (directoryUrls === "explicit" ? "/index.html" : directoryUrls === "slash" ? "/" : "");
  const response = await handler(new Request("https://example.test" + root));
  assert.equal(response.status, 200);
  const alias = await handler(
    new Request(
      "https://example.test/downloads/browse" + (directoryUrls === "clean" ? "/" : "") + "?q=note",
    ),
  );
  assert.equal(alias.status, 307);
  assert.equal(new URL(alias.headers.get("location"), "https://example.test").pathname, root);
  assert.match(alias.headers.get("location"), /\?q=note$/);
}
await writeFile("routing.config.mjs", 'export default {routing:{directoryUrls:"slash"}}');
await runCli(
  [
    "build",
    "routing-source",
    "--out",
    "routing-output",
    "--config",
    "routing.config.mjs",
    "--directory-urls",
    "clean",
  ],
  process.cwd(),
  () => {},
);
assert.match(await readFile("routing-output/folder.html", "utf8"), /note.txt/);
console.log(JSON.stringify({ node: process.version, builds, livePolicies: 3, cliOverride: true }));
await rm("routing-source", { recursive: true });
await rm("routing-output", { recursive: true });
await rm("routing.config.mjs");
