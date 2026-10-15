// Historical pre-routing probe; use the source hashes recorded in baseline-summary.json.
// Current qualification: test/routing.test.mjs and test/browser/routing.spec.mjs.
import { fileURLToPath, pathToFileURL } from "node:url";
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const { generateExplorer } = await import(
  pathToFileURL(path.join(repositoryRoot, "packages/core/src/index.ts")).href
);
const { createPlainTheme } = await import(
  pathToFileURL(path.join(repositoryRoot, "packages/theme-plain/src/index.ts")).href
);
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const temp = await mkdtemp(path.join(tmpdir(), "dirwell-url-edges-"));
const results = [];
try {
  for (const name of ["index.htm", "index-and-fallback", "custom-index-collision", "skip-parent"]) {
    const root = path.join(temp, name, "src"),
      out = path.join(temp, name, "out");
    await mkdir(path.join(root, "parent", "child"), { recursive: true });
    if (name === "index.htm") await writeFile(path.join(root, "index.htm"), "SOURCE");
    if (name === "index-and-fallback") {
      await writeFile(path.join(root, "index.html"), "SOURCE");
      await writeFile(path.join(root, "_dirwell.html"), "FALLBACK");
    }
    if (name === "custom-index-collision") await writeFile(path.join(root, "index.html"), "SOURCE");
    const observations = [];
    const plain = createPlainTheme();
    const report = await generateExplorer({
      sourceDir: root,
      outputDir: out,
      theme: {
        ...plain,
        render: async (c) => {
          const p = await plain.render(c);
          observations.push({
            path: c.directory.current.relativePath,
            parent: c.directory.parent ? c.hrefForDirectory(c.directory.parent.relativePath) : null,
            links: [...p.html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]),
          });
          return p;
        },
      },
      ...(name === "custom-index-collision" ? { outputName: "index.html" } : {}),
      ...(name === "skip-parent"
        ? { outputName: (d) => (d.current.relativePath === "parent" ? null : "index.html") }
        : {}),
    });
    let retained = null;
    try {
      retained = await readFile(
        path.join(out, name === "index.htm" ? "index.htm" : "index.html"),
        "utf8",
      );
    } catch {}
    results.push({
      case: name,
      pages: report.pages.map((p) => ({ directory: p.directory, outputName: p.outputName })),
      mirroredHomepagePreserved: name === "skip-parent" ? null : retained === "SOURCE",
      observations,
    });
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
