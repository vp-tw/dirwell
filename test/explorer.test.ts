import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createExplorerDevServer } from "../src/dev-server.ts";
import { generateExplorer } from "../src/generator.ts";
import { createDefaultTheme } from "../src/theme-default.ts";
import { fuzzyScore } from "../src/theme-runtime.js";
import type { DirectoryData } from "../src/model.ts";

async function fixture(): Promise<{ output: string; root: string }> {
  const temporary = await mkdtemp(path.join(tmpdir(), "dirwell-"));
  const root = path.join(temporary, "source");
  const output = path.join(temporary, "output");
  const external = path.join(temporary, "external");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "releases", "v2.4.0"), { recursive: true });
  await mkdir(external, { recursive: true });
  await writeFile(path.join(root, "README.txt"), "initial\n");
  await writeFile(path.join(root, "space name.txt"), "encoded\n");
  await writeFile(path.join(root, "docs", "index.html"), "<!doctype html><title>Docs</title>");
  await writeFile(path.join(root, "releases", "v2.4.0", "app.js"), "export {};\n");
  await symlink("..", path.join(root, "releases", "back-to-root"));
  await symlink("../external", path.join(root, "external-link"));
  await symlink("missing", path.join(root, "broken-link"));
  return { output, root };
}

test("mirrors source files and preserves an existing index", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));

  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    symlinks: { follow: true },
  });

  assert.equal(await readFile(path.join(output, "README.txt"), "utf8"), "initial\n");
  assert.match(await readFile(path.join(output, "docs", "index.html"), "utf8"), /Docs/);
  assert.match(await readFile(path.join(output, "releases", "index.html"), "utf8"), /cycle/);
  assert.match(
    await readFile(path.join(output, "releases", "index.html"), "utf8"),
    /data-parent-href="\.\.\/"/,
  );
  assert.match(
    await readFile(path.join(output, "releases", "index.html"), "utf8"),
    /aria-label="Breadcrumb"><a href="\.\.\/">Home<\/a><span[^>]*>\/<\/span><span aria-current="page">releases<\/span>/,
  );
  assert.match(
    await readFile(path.join(output, "releases", "index.html"), "utf8"),
    /href="\.\.\/">[\s\S]*back-to-root\//,
  );
  const rootIndex = await readFile(path.join(output, "index.html"), "utf8");
  assert.doesNotMatch(rootIndex, /data-parent-href/);
  assert.match(rootIndex, /href="README\.txt" target="_blank" rel="noopener">[\s\S]*README\.txt/);
  assert.match(rootIndex, /href="docs\/" target="_blank" rel="noopener">[\s\S]*docs\//);
  assert.match(rootIndex, /href="releases\/">[\s\S]*releases\//);
  assert.match(rootIndex, /href="space%20name\.txt"/);
  assert.doesNotMatch(rootIndex, /href="releases\/" target="_blank"/);
  assert.match(rootIndex, /external-link/);
  assert.match(rootIndex, /→ \.\.\/external/);
  assert.match(rootIndex, /external link/);
  assert.doesNotMatch(rootIndex, /href="external-link\/"/);
  const rawLinkHref = rootIndex.match(
    /href="(__dirwell\/raw-links\/[a-f0-9]{16}\.txt)" target="_blank" rel="noopener"/,
  )?.[1];
  assert.ok(rawLinkHref);
  assert.equal(await readFile(path.join(output, rawLinkHref), "utf8"), "missing");
});

test("supports a clean output directory inside the source tree", async (context) => {
  const { root } = await fixture();
  const output = path.join(root, "dist");
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));

  await generateExplorer({ sourceDir: root, outputDir: output });
  await generateExplorer({ sourceDir: root, outputDir: output });

  assert.equal(await readFile(path.join(output, "README.txt"), "utf8"), "initial\n");
  const rootIndex = await readFile(path.join(output, "index.html"), "utf8");
  assert.doesNotMatch(rootIndex, />dist\/<\/a>/);
});

test("output names support strings, resolver skips, and safe filename validation", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));

  await generateExplorer({ sourceDir: root, outputDir: output, outputName: "listing.html" });
  assert.match(await readFile(path.join(output, "listing.html"), "utf8"), /README\.txt/);
  assert.match(
    await readFile(path.join(output, "docs", "listing.html"), "utf8"),
    /Directory \/docs\//,
  );

  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    outputName: (directory) => (directory.current.relativePath === "releases" ? null : "x.html"),
  });
  await assert.rejects(() => readFile(path.join(output, "releases", "x.html")));
  assert.match(await readFile(path.join(output, "x.html"), "utf8"), /README\.txt/);

  await assert.rejects(
    () =>
      generateExplorer({ sourceDir: root, outputDir: output, outputName: () => "../unsafe.html" }),
    /single safe filename/,
  );
});

test("DirectoryData exposes root, current, parent, metadata, and symlink state", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  const seen: DirectoryData[] = [];
  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    outputName: (directory) => {
      seen.push(directory);
      return null;
    },
  });
  const releases = seen.find((directory) => directory.current.relativePath === "releases");
  assert.ok(releases);
  assert.equal(releases.root.relativePath, "");
  assert.equal(releases.parent?.relativePath, "");
  assert.equal(releases.depth, 1);
  assert.equal(typeof releases.current.metadata.mode, "number");
  assert.equal(
    releases.entries.find((entry) => entry.name === "back-to-root")?.symlink?.isCycle,
    true,
  );
});

test("cycle error policy rejects traversal while the default skips recursion", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await assert.rejects(
    () =>
      generateExplorer({
        sourceDir: root,
        outputDir: output,
        symlinks: { follow: true, onCycle: "error" },
      }),
    /Symlink cycle/,
  );
});

test("mirror false emits generated pages without copying source files", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await generateExplorer({ sourceDir: root, outputDir: output, mirror: false });
  assert.match(await readFile(path.join(output, "index.html"), "utf8"), /README\.txt/);
  await assert.rejects(() => readFile(path.join(output, "README.txt")));
});

test("MPA shares runtime assets from the output root", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));

  await generateExplorer({ sourceDir: root, outputDir: output, mode: "mpa" });

  assert.match(
    await readFile(path.join(output, "releases", "index.html"), "utf8"),
    /src="\.\.\/__dirwell\/dirwell\.runtime\.js"/,
  );
  assert.match(
    await readFile(path.join(output, "__dirwell", "dirwell.runtime.js"), "utf8"),
    /initializeExplorer/,
  );
  await assert.rejects(() => readFile(path.join(output, "releases", "dirwell.runtime.js")));
});

test("base URLs prefix pages, assets, breadcrumbs, and raw-link views", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await generateExplorer({
    base: "/repo/",
    sourceDir: root,
    outputDir: output,
    urlStrategy: "base",
  });

  const rootHtml = await readFile(path.join(output, "index.html"), "utf8");
  const nestedHtml = await readFile(path.join(output, "releases", "index.html"), "utf8");
  assert.match(rootHtml, /src="\/repo\/dirwell\.runtime\.js"/);
  assert.match(rootHtml, /href="\/repo\/releases\/"/);
  assert.match(rootHtml, /href="\/repo\/space%20name\.txt"/);
  assert.match(rootHtml, /href="\/repo\/__dirwell\/raw-links\/[a-f0-9]{16}\.txt"/);
  assert.match(nestedHtml, /href="\/repo\/">Home<\/a>/);
  assert.match(nestedHtml, /href="\/repo\/releases\/v2\.4\.0\/"/);
  assert.match(nestedHtml, /src="\/repo\/releases\/dirwell\.runtime\.js"/);
  assert.doesNotMatch(nestedHtml, /<base href=/);
});

test("html-base emits a native base element and base-relative URLs", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await generateExplorer({
    base: "/repo/",
    sourceDir: root,
    outputDir: output,
    urlStrategy: "html-base",
  });

  const rootHtml = await readFile(path.join(output, "index.html"), "utf8");
  const nestedHtml = await readFile(path.join(output, "releases", "index.html"), "utf8");
  assert.match(rootHtml, /<base href="\/repo\/">/);
  assert.match(rootHtml, /href="releases\/"/);
  assert.match(rootHtml, /href="space%20name\.txt"/);
  assert.match(rootHtml, /href="__dirwell\/raw-links\/[a-f0-9]{16}\.txt"/);
  assert.match(nestedHtml, /<base href="\/repo\/">/);
  assert.match(nestedHtml, /href="\.\/">Home<\/a>/);
  assert.match(nestedHtml, /href="releases\/v2\.4\.0\/"/);
  assert.match(nestedHtml, /src="releases\/dirwell\.runtime\.js"/);
});

test("URL strategies validate and normalize deployment bases", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await assert.rejects(
    () =>
      generateExplorer({
        base: "repo",
        sourceDir: root,
        outputDir: output,
        urlStrategy: "base",
      }),
    /base must start/,
  );
  await generateExplorer({
    base: "https://cdn.example.test/repo",
    sourceDir: root,
    outputDir: output,
    urlStrategy: "base",
  });
  assert.match(
    await readFile(path.join(output, "index.html"), "utf8"),
    /src="https:\/\/cdn\.example\.test\/repo\/dirwell\.runtime\.js"/,
  );
});

test("MPA rejects a source collision with its reserved asset directory", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await mkdir(path.join(root, "__dirwell"));

  await assert.rejects(
    () => generateExplorer({ sourceDir: root, outputDir: output, mode: "mpa" }),
    /reserves the source-root path/,
  );
});

test("a failed rebuild preserves the last successful output", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await generateExplorer({ sourceDir: root, outputDir: output });
  const before = await readFile(path.join(output, "index.html"), "utf8");

  await assert.rejects(() =>
    generateExplorer({
      sourceDir: root,
      outputDir: output,
      theme: { name: "broken", render: () => Promise.reject(new Error("render failed")) },
    }),
  );
  assert.equal(await readFile(path.join(output, "index.html"), "utf8"), before);
});

test("watch server rebuilds changed directory contents", async (context) => {
  const { output, root } = await fixture();
  const server = await createExplorerDevServer({ sourceDir: root, outputDir: output, port: 0 });
  context.after(async () => {
    await server.close();
    await rm(path.dirname(root), { recursive: true, force: true });
  });

  const initialPage = await (await fetch(server.url)).text();
  assert.match(initialPage, /EventSource/);
  assert.match(await (await fetch(`${server.url}docs/`)).text(), /Docs/);
  assert.equal(await (await fetch(`${server.url}README.txt`)).text(), "initial\n");

  await writeFile(path.join(root, "new-file.txt"), "watched\n");
  const deadline = Date.now() + 3_000;
  let updatedPage = "";
  while (Date.now() < deadline) {
    updatedPage = await (await fetch(server.url)).text();
    if (updatedPage.includes("new-file.txt")) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.match(updatedPage, /new-file\.txt/);
  assert.equal(await (await fetch(`${server.url}new-file.txt`)).text(), "watched\n");
  assert.equal((await fetch(`${server.url}missing`)).status, 404);
  assert.equal((await fetch(`${server.url}%E0%A4%A`)).status, 400);
});

test("development server mounts base and html-base builds at their deployment path", async (context) => {
  const { output, root } = await fixture();
  const server = await createExplorerDevServer({
    base: "/repository/",
    sourceDir: root,
    outputDir: output,
    port: 0,
    urlStrategy: "html-base",
  });
  context.after(async () => {
    await server.close();
    await rm(path.dirname(root), { recursive: true, force: true });
  });

  assert.match(server.url, /\/repository\/$/);
  const page = await (await fetch(`${server.url}releases/`)).text();
  assert.match(page, /<base href="\/repository\/">/);
  assert.match(page, /EventSource\("\/repository\/__explorer\/events"\)/);
  assert.equal((await fetch(server.url.replace(/\/$/, ""), { redirect: "manual" })).status, 308);
  assert.equal((await fetch(new URL("/", server.url))).status, 404);
});

test("fuzzy scoring accepts ordered subsequences and rewards contiguous matches", () => {
  assert.equal(fuzzyScore("xyz", "README.txt"), null);
  assert.notEqual(fuzzyScore("rdm", "README.txt"), null);
  assert.ok((fuzzyScore("read", "README.txt") ?? 0) > (fuzzyScore("rdme", "README.txt") ?? 0));
});

test("default theme interactions can be disabled", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    theme: createDefaultTheme({
      colorScheme: false,
      fuzzySearch: false,
      keyboardNavigation: false,
    }),
  });
  const html = await readFile(path.join(output, "index.html"), "utf8");
  assert.doesNotMatch(html, /data-search-input|data-theme-value|dirwell\.runtime/);
});

test("default theme components can be layered and replaced", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    theme: createDefaultTheme({
      components: {
        Footer: ({ parentHref }) =>
          `<footer data-custom-footer>${parentHref === null ? "root" : "nested"}</footer>`,
      },
    }),
  });
  assert.match(await readFile(path.join(output, "index.html"), "utf8"), /data-custom-footer>root/);
  assert.match(
    await readFile(path.join(output, "releases", "index.html"), "utf8"),
    /data-custom-footer>nested/,
  );
});
