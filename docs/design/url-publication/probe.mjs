// Historical pre-routing probe; use the source hashes recorded in baseline-summary.json.
// Current qualification: test/routing.test.mjs and test/browser/routing.spec.mjs.
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const destination = process.argv[2];
if (!destination) throw new Error("Usage: node probe.mjs <output-json-path>");
const { generateExplorer } = await import(
  pathToFileURL(path.join(repositoryRoot, "packages/core/src/index.ts")).href
);
const { createPlainTheme } = await import(
  pathToFileURL(path.join(repositoryRoot, "packages/theme-plain/src/index.ts")).href
);
const { createLedgerTheme } = await import(
  pathToFileURL(path.join(repositoryRoot, "packages/theme-ledger/dist/index.mjs")).href
);
const { createCrosswaveTheme } = await import(
  pathToFileURL(path.join(repositoryRoot, "packages/theme-crosswave/dist/index.mjs")).href
);
const temp = await mkdtemp(path.join(tmpdir(), "dirwell-url-probe-"));
const sourceDir = path.join(temp, "source");
await mkdir(path.join(sourceDir, "child", "deep"), { recursive: true });
await mkdir(path.join(sourceDir, "owned"), { recursive: true });
await writeFile(path.join(sourceDir, "one.txt"), "one");
await writeFile(path.join(sourceDir, "two.txt"), "two");
await writeFile(path.join(sourceDir, "child", "note #%.txt"), "child");
await writeFile(path.join(sourceDir, "owned", "index.html"), "<title>Owned site</title>");
const rows = [];
try {
  for (const mode of ["ssg", "mpa"])
    for (const urlStrategy of ["relative", "base", "html-base"])
      for (const [themeName, factory] of [
        ["plain-portable", () => createPlainTheme()],
        ["plain-directory", () => createPlainTheme({ portableLinks: false })],
        ["ledger", () => createLedgerTheme()],
        ["crosswave", () => createCrosswaveTheme()],
      ])
        for (const output of ["default", "custom", "skip-owned"])
          for (const paged of [false, true])
            for (const mirror of [false, true]) {
              const captures = [];
              const theme = factory();
              const render = theme.render;
              const outputDir = path.join(temp, "out");
              const row = { mode, urlStrategy, theme: themeName, output, paged, mirror };
              try {
                const report = await generateExplorer({
                  sourceDir,
                  outputDir,
                  theme: {
                    ...theme,
                    render: async (context) => {
                      const result = await render(context);
                      captures.push({
                        directory: context.directory.current.relativePath,
                        page: context.listing?.page.number ?? 1,
                        outputName: context.outputName,
                        rootHref: context.hrefForDirectory(""),
                        childHref: context.hrefForDirectory("child"),
                        noteHref: context.directory.entries.find((e) => e.name === "note #%.txt")
                          ? context.hrefFor(
                              context.directory.entries.find((e) => e.name === "note #%.txt"),
                            )
                          : null,
                        documentBaseHref: context.documentBaseHref,
                        links: [...result.html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]),
                        manifest: context.listing?.manifestHref ?? null,
                      });
                      return result;
                    },
                  },
                  mode,
                  urlStrategy,
                  base: "/downloads/",
                  mirror,
                  ...(output === "custom"
                    ? { outputName: "files.html" }
                    : output === "skip-owned"
                      ? {
                          outputName: (d) =>
                            d.current.relativePath === "owned" ? null : "index.html",
                        }
                      : {}),
                  ...(paged
                    ? {
                        listing: {
                          html: { strategy: "paged", pageSize: 1 },
                          data: { strategy: "blocks", blockSize: 2 },
                        },
                      }
                    : {}),
                });
                row.status = "generated";
                row.pages = report.pages.map((p) => ({
                  directory: p.directory,
                  outputName: p.outputName,
                }));
                row.captures = captures;
                if (mirror)
                  row.ownedPreserved =
                    (await readFile(path.join(outputDir, "owned", "index.html"), "utf8")) ===
                    "<title>Owned site</title>";
              } catch (error) {
                row.status = "error";
                row.error = error.message;
              }
              rows.push(row);
            }
  await writeFile(
    destination,
    JSON.stringify(
      {
        date: "2026-10-15",
        runtime: process.version,
        source:
          "Core and Plain: working tree TypeScript source. Ledger and Crosswave: existing dist bundles; freshness not qualified",
        scope:
          "HTML generation and context observation; no browser, HTTP host or production deployment",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        cases: rows.length,
        generated: rows.filter((r) => r.status === "generated").length,
        errors: [...new Set(rows.filter((r) => r.status === "error").map((r) => r.error))],
      },
      null,
      2,
    ),
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
