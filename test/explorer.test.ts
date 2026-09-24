import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createExplorerDevServer } from "../src/dev-server.ts";
import { compareEntries, generateExplorer } from "../src/generator.ts";
import { createDefaultTheme } from "../src/theme-default.ts";
import { createPlainTheme } from "../src/theme-plain.ts";
import { HeightTree, compareEntryValues, entryType, fuzzyScore } from "../src/theme-runtime.js";
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

test("type filters keep symlinks separate from physical folders and files", () => {
  assert.equal(entryType({ kind: "directory" }), "directory");
  assert.equal(entryType({ kind: "file" }), "file");
  assert.equal(entryType({ kind: "other" }), "file");
  assert.equal(entryType({ kind: "directory", isLink: true }), "link");
  assert.equal(entryType({ kind: "file", link: true }), "link");
  assert.equal(entryType({ kind: "symlink", isLink: true, targetKind: null }), "link");
  assert.equal(entryType({ dataset: { kind: "directory", link: "true" } }), "link");
});

test("plain theme emits complete HTML without icons, scripts, or search assets", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));

  for (const mode of ["ssg", "mpa"] as const) {
    await generateExplorer({
      sourceDir: root,
      outputDir: output,
      mode,
      symlinks: { follow: true },
      theme: createPlainTheme(),
    });
    const html = await readFile(path.join(output, "index.html"), "utf8");
    assert.match(html, /<h1>Index of \/<\/h1>/);
    assert.match(html, /href="releases\/">releases\/<\/a>/);
    assert.match(html, /href="README\.txt" target="_blank" rel="noopener">README\.txt<\/a>/);
    assert.match(html, /broken link.*Target: missing/);
    assert.match(html, /unavailable link.*Target: \.\.\/external/);
    assert.doesNotMatch(html, /<svg|<script|<img|data-theme|search-index|prefers-color-scheme/);
    assert.match(html, /<meta name="color-scheme" content="light">/);
    assert.match(html, /<time datetime="[^"]+">/);
    assert.match(html, /<footer><hr><p>Repository: Dirwell by VdustR/);
    assert.match(
      html,
      /<a href="https:\/\/opensource\.org\/license\/mit" target="_blank" rel="noopener">MIT License<\/a>/,
    );
    assert.doesNotMatch(html, /href="https:\/\/github\.com\/VdustR\/dirwell/);
    await assert.rejects(readFile(path.join(output, "__dirwell", "search-index.json"), "utf8"));
    const nested = await readFile(path.join(output, "releases", "index.html"), "utf8");
    assert.match(
      nested,
      /aria-label="Breadcrumb"><a href="\.\.\/">Home<\/a> \/ <span aria-current="page">releases<\/span>/,
    );
    assert.match(nested, /href="\.\.\/">\.\.\/<\/a>/);
    assert.match(nested, /<footer><hr><p>Repository:/);
  }

  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    theme: createPlainTheme({
      project: {
        author: "A & B",
        license: "Custom <License>",
        licenseUrl: "https://example.test/license",
        name: "Example <Repo>",
        repositoryUrl: "https://example.test/repo?a=1&b=2",
      },
    }),
  });
  const customized = await readFile(path.join(output, "index.html"), "utf8");
  assert.match(
    customized,
    /href="https:\/\/example\.test\/repo\?a=1&amp;b=2" target="_blank" rel="noopener">Example &lt;Repo&gt;<\/a> by A &amp; B/,
  );
  assert.match(customized, /Custom &lt;License&gt;<\/a>/);

  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    theme: createPlainTheme({
      project: { license: "Custom", repositoryUrl: "javascript:alert(1)" },
    }),
  });
  const unsafe = await readFile(path.join(output, "index.html"), "utf8");
  assert.match(unsafe, /Repository: Dirwell by VdustR · Custom<\/p>/);
  assert.doesNotMatch(unsafe, /href="javascript:/);
});

test("default theme self-hosts vscode-icons in SSG and MPA output", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));

  for (const mode of ["ssg", "mpa"] as const) {
    await generateExplorer({ sourceDir: root, outputDir: output, mode });
    const html = await readFile(path.join(output, "index.html"), "utf8");
    const assetPrefix = mode === "mpa" ? "__dirwell/" : "";
    assert.match(html, new RegExp(`src="${assetPrefix}vscode-default_folder\\.svg"`));
    assert.match(html, new RegExp(`src="${assetPrefix}vscode-file_type_text\\.svg"`));
    assert.match(html, /Icon credits<\/a>/);
    assert.match(html, /&quot;icons&quot;:\{&quot;byExtension&quot;:/);
    assert.match(html, /main > header \{\s*position: sticky;\s*top: 0;/);
    assert.match(
      html,
      /\.entry-head \{\s*position: sticky;\s*top: var\(--dw-sticky-header-height\);/,
    );
    const assetDir = path.join(output, mode === "mpa" ? "__dirwell" : "");
    assert.match(await readFile(path.join(assetDir, "vscode-file_type_text.svg"), "utf8"), /<svg/);
    assert.match(
      await readFile(path.join(assetDir, "vscode-icons-NOTICE.txt"), "utf8"),
      /CC BY-SA 4\.0|Creative Commons Attribution-ShareAlike 4\.0/,
    );
    const runtime = await readFile(path.join(assetDir, "dirwell.runtime.js"), "utf8");
    assert.match(runtime, /icons\.hrefs\[iconName\]/);
    assert.match(runtime, /--dw-sticky-header-height/);
    assert.match(runtime, /scrollPaddingTop/);
  }
});

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
  assert.match(await readFile(path.join(output, "docs", "_dirwell.html"), "utf8"), /index\.html/);
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
  assert.doesNotMatch(rootIndex, /directory-label|Static directory index/);
  assert.match(rootIndex, /data-global-open/);
  assert.match(rootIndex, /data-global-dialog/);
  assert.equal(rootIndex.match(/<fieldset class="type-filters" data-type-filters>/g)?.length, 2);
  for (const type of ["directory", "file", "link"]) {
    assert.equal(
      rootIndex.match(new RegExp(`value="${type}" data-type-filter checked`, "g"))?.length,
      2,
    );
  }
  assert.doesNotMatch(rootIndex, /data-include-links|data-search-filter|data-global-filter/);
  assert.match(rootIndex, /data-sort-field/);
  for (const name of ["color-scheme", "sort-field", "name-mode", "sort-direction"]) {
    assert.equal(rootIndex.match(new RegExp(`<select data-${name}>`, "g"))?.length, 1);
  }
  assert.match(rootIndex, /--dw-control-height:\s*2\.75rem/);
  assert.match(rootIndex, /button\.sort-heading\s*\{[^}]*min-width:\s*var\(--dw-control-height\)/);
  assert.match(
    rootIndex,
    /<label class="scheme">Theme<select data-color-scheme><option value="system">System<\/option>/,
  );
  assert.match(rootIndex, />Dirwell<\/a> by VdustR/);
  assert.doesNotMatch(rootIndex, /data-parent-href/);
  assert.match(rootIndex, /href="README\.txt" target="_blank" rel="noopener">[\s\S]*README\.txt/);
  assert.match(rootIndex, /href="docs\/_dirwell\.html">[\s\S]*docs\//);
  assert.match(rootIndex, /href="releases\/">[\s\S]*releases\//);
  assert.match(rootIndex, /href="space%20name\.txt"/);
  assert.doesNotMatch(rootIndex, /href="releases\/" target="_blank"/);
  assert.match(rootIndex, /external-link/);
  assert.match(rootIndex, /Target:<\/span> \.\.\/external/);
  assert.match(rootIndex, /external link/);
  assert.doesNotMatch(rootIndex, /href="external-link\/"/);
  const rawLinkHref = rootIndex.match(
    /href="(__dirwell\/raw-links\/[a-f0-9]{16}\.txt)" target="_blank" rel="noopener"/,
  )?.[1];
  assert.ok(rawLinkHref);
  assert.equal(await readFile(path.join(output, rawLinkHref), "utf8"), "missing");
});

test("default page name falls back once and preserves both existing pages", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await mkdir(path.join(root, "both"));
  await writeFile(path.join(root, "both", "index.html"), "Original index");
  await writeFile(path.join(root, "both", "_dirwell.html"), "Original fallback");
  await mkdir(path.join(root, "legacy"));
  await writeFile(path.join(root, "legacy", "index.htm"), "Legacy index");

  for (const mode of ["ssg", "mpa"] as const) {
    await generateExplorer({ sourceDir: root, outputDir: output, mode });
    assert.equal(
      await readFile(path.join(output, "docs", "index.html"), "utf8"),
      "<!doctype html><title>Docs</title>",
    );
    assert.match(await readFile(path.join(output, "docs", "_dirwell.html"), "utf8"), /index\.html/);
    assert.equal(await readFile(path.join(output, "both", "index.html"), "utf8"), "Original index");
    assert.equal(
      await readFile(path.join(output, "both", "_dirwell.html"), "utf8"),
      "Original fallback",
    );
    assert.equal(await readFile(path.join(output, "legacy", "index.htm"), "utf8"), "Legacy index");
    assert.match(
      await readFile(path.join(output, "legacy", "_dirwell.html"), "utf8"),
      /index\.htm/,
    );
    const rootHtml = await readFile(path.join(output, "index.html"), "utf8");
    assert.match(rootHtml, /href="docs\/_dirwell\.html"/);
    assert.match(rootHtml, /href="legacy\/_dirwell\.html"/);
    assert.match(rootHtml, /href="both\/" target="_blank"/);
    const index = JSON.parse(
      await readFile(path.join(output, "__dirwell", "search-00000.json"), "utf8"),
    );
    assert.equal(
      index.entries.find((entry: { path: string }) => entry.path === "docs")?.href,
      "../docs/_dirwell.html",
    );
  }
});

test("a root index keeps its contents and receives a linked Explorer fallback", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await writeFile(path.join(root, "index.html"), "Original root index");
  await generateExplorer({ sourceDir: root, outputDir: output, theme: createPlainTheme() });

  assert.equal(await readFile(path.join(output, "index.html"), "utf8"), "Original root index");
  assert.match(await readFile(path.join(output, "_dirwell.html"), "utf8"), /README\.txt/);
  assert.match(
    await readFile(path.join(output, "releases", "index.html"), "utf8"),
    /href="\.\.\/_dirwell\.html">Home<\/a>/,
  );
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

test("refuses an output directory that contains the source tree", async (context) => {
  const { root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await assert.rejects(
    generateExplorer({ sourceDir: root, outputDir: path.dirname(root) }),
    /outputDir must not contain the sourceDir/,
  );
  assert.equal(await readFile(path.join(root, "README.txt"), "utf8"), "initial\n");
});

test("output names support strings, resolver skips, and safe filename validation", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));

  await generateExplorer({ sourceDir: root, outputDir: output, outputName: "listing.html" });
  assert.match(await readFile(path.join(output, "listing.html"), "utf8"), /README\.txt/);
  assert.match(
    await readFile(path.join(output, "docs", "listing.html"), "utf8"),
    /aria-current="page">docs<\/span>/,
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

test("include and exclude filter mirrored files, pages, and search in both modes", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await mkdir(path.join(root, "docs", "private"));
  await writeFile(path.join(root, "intro.md"), "Public intro");
  await writeFile(path.join(root, "docs", "guide.md"), "Public guide");
  await writeFile(path.join(root, "docs", ".hidden.log"), "Hidden log");
  await writeFile(path.join(root, "docs", "private", "secret.md"), "Private note");

  for (const mode of ["ssg", "mpa"] as const) {
    await generateExplorer({
      sourceDir: root,
      outputDir: output,
      mode,
      include: ["*.md", "docs/**"],
      exclude: ["docs/private/**", "**/*.log"],
    });
    const rootPage = await readFile(path.join(output, "index.html"), "utf8");
    const docsPage = await readFile(path.join(output, "docs", "_dirwell.html"), "utf8");
    assert.match(rootPage, /intro\.md/);
    assert.match(rootPage, /docs\/_dirwell\.html/);
    assert.doesNotMatch(rootPage, /README\.txt|releases\//);
    assert.match(docsPage, /guide\.md|index\.html/);
    assert.doesNotMatch(docsPage, /private\/|\.hidden\.log/);
    assert.equal(await readFile(path.join(output, "intro.md"), "utf8"), "Public intro");
    assert.equal(await readFile(path.join(output, "docs", "guide.md"), "utf8"), "Public guide");
    await assert.rejects(lstat(path.join(output, "README.txt")), /ENOENT/);
    await assert.rejects(lstat(path.join(output, "docs", "private")), /ENOENT/);
    await assert.rejects(lstat(path.join(output, "docs", ".hidden.log")), /ENOENT/);
    const index = JSON.parse(
      await readFile(path.join(output, "__dirwell", "search-00000.json"), "utf8"),
    );
    const paths = index.entries.map((entry: { path: string }) => entry.path);
    assert.ok(paths.includes("docs/guide.md"));
    assert.ok(
      !paths.some((entry: string) => entry.includes("private") || entry.includes(".hidden.log")),
    );
  }

  await generateExplorer({ sourceDir: root, outputDir: output, mirror: false, include: "*.md" });
  assert.match(await readFile(path.join(output, "index.html"), "utf8"), /intro\.md/);
  await assert.rejects(lstat(path.join(output, "intro.md")), /ENOENT/);
  await assert.rejects(lstat(path.join(output, "docs")), /ENOENT/);
});

test("directory includes, dotfiles, and excluded symlink targets use source-relative paths", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await writeFile(path.join(root, ".env"), "SECRET=value");
  await writeFile(path.join(root, "docs", ".hidden.md"), "Hidden note");
  await symlink("README.txt", path.join(root, "readme-link"));

  await generateExplorer({ sourceDir: root, outputDir: output, include: "docs" });
  assert.equal(await readFile(path.join(output, "docs", ".hidden.md"), "utf8"), "Hidden note");
  await assert.rejects(lstat(path.join(output, ".env")), /ENOENT/);

  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    include: "**",
    exclude: [".env", "README.txt"],
  });
  await assert.rejects(lstat(path.join(output, ".env")), /ENOENT/);
  await assert.rejects(lstat(path.join(output, "README.txt")), /ENOENT/);
  await assert.rejects(lstat(path.join(output, "readme-link")), /ENOENT/);
  const rootPage = await readFile(path.join(output, "index.html"), "utf8");
  assert.match(rootPage, /readme-link/);
  assert.doesNotMatch(rootPage, /href="readme-link"/);
  const index = JSON.parse(
    await readFile(path.join(output, "__dirwell", "search-00000.json"), "utf8"),
  );
  assert.equal(
    index.entries.find((entry: { path: string }) => entry.path === "readme-link")?.href,
    null,
  );
});

test("excluding an existing index lets Dirwell generate the directory index", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    include: "docs/**",
    exclude: "docs/index.html",
  });
  const docsPage = await readFile(path.join(output, "docs", "index.html"), "utf8");
  assert.match(docsPage, /Index of|data-explorer/);
  await assert.rejects(lstat(path.join(output, "docs", "_dirwell.html")), /ENOENT/);
});

test("CLI mirror omits symlinks that could reach outside the output", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await symlink(path.join(root, "README.txt"), path.join(root, "absolute-link"));
  await generateExplorer({ sourceDir: root, outputDir: output });
  await assert.rejects(lstat(path.join(output, "external-link")), /ENOENT/);
  await assert.rejects(lstat(path.join(output, "absolute-link")), /ENOENT/);
  assert.match(await readFile(path.join(output, "index.html"), "utf8"), /external-link/);
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
  const searchIndex = JSON.parse(
    await readFile(path.join(output, "__dirwell", "search-index.json"), "utf8"),
  );
  assert.equal(searchIndex.version, 2);
  const searchEntries = (
    await Promise.all(
      searchIndex.shards.map(async (name: string) =>
        JSON.parse(await readFile(path.join(output, "__dirwell", name), "utf8")),
      ),
    )
  ).flatMap(
    (shard: { entries: { path: string; target: string | null; href: string | null }[] }) =>
      shard.entries,
  );
  assert.equal(searchIndex.count, searchEntries.length);
  assert.ok(searchEntries.some((entry: { path: string }) => entry.path === "README.txt"));
  assert.ok(searchEntries.some((entry: { path: string }) => entry.path === "docs/index.html"));
  assert.ok(
    searchEntries.some(
      (entry: { path: string; target: string | null }) =>
        entry.path === "broken-link" && entry.target === "missing",
    ),
  );
  assert.equal(
    searchEntries.find((entry: { path: string }) => entry.path === "releases/back-to-root")?.href,
    "../",
  );
  assert.deepEqual(
    searchEntries
      .find((entry: { path: string }) => entry.path === "broken-link")
      ?.href?.startsWith("raw-links/"),
    true,
  );
});

test("large MPA directories defer rows while SSG keeps complete HTML", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await Promise.all(
    Array.from({ length: 520 }, (_, index) =>
      writeFile(path.join(root, `file-${String(index).padStart(4, "0")}.txt`), "x"),
    ),
  );
  await generateExplorer({ sourceDir: root, outputDir: output, mode: "mpa", mirror: false });
  const html = await readFile(path.join(output, "index.html"), "utf8");
  assert.doesNotMatch(html, /data-entry data-order=/);
  const href = JSON.parse(
    html.match(/data-config="([^"]+)"/)?.[1]?.replaceAll("&quot;", '"') ?? "{}",
  ).entriesHref;
  assert.match(href, /^__dirwell\/entries-[a-f0-9]{16}\.json$/);
  assert.match(html, /&quot;workerHref&quot;:&quot;__dirwell\/dirwell\.worker\.js&quot;/);
  assert.match(
    await readFile(path.join(output, "__dirwell", "dirwell.worker.js"), "utf8"),
    /self\.addEventListener\("message"/,
  );
  const data = JSON.parse(await readFile(path.join(output, href), "utf8"));
  assert.equal(data.rows.length, 526);
  assert.equal(typeof data.rows[0].name, "string");
  assert.equal(typeof data.rows[0].modifiedAt, "string");
  assert.equal(data.rows[0].html, undefined);
  const broken = data.rows.find((row: { name: string }) => row.name === "broken-link");
  assert.equal(broken.isBroken, true);
  assert.equal(broken.target, "missing");
  assert.match(broken.href, /^__dirwell\/raw-links\/[a-f0-9]{16}\.txt$/);
  const manifest = JSON.parse(
    await readFile(path.join(output, "__dirwell", "search-index.json"), "utf8"),
  );
  assert.ok(manifest.shards.length > 1);
  for (const name of manifest.shards) {
    const shard = JSON.parse(await readFile(path.join(output, "__dirwell", name), "utf8"));
    assert.ok(shard.entries.length <= 512);
  }

  await generateExplorer({ sourceDir: root, outputDir: output, mode: "ssg", mirror: false });
  const ssgHtml = await readFile(path.join(output, "index.html"), "utf8");
  assert.equal(ssgHtml.match(/data-entry data-order=/g)?.length, 526);
});

test("measured virtual heights find wrapped rows and update offsets", () => {
  const heights = new HeightTree(4, 64);
  assert.equal(heights.prefix(4), 256);
  assert.equal(heights.indexAt(130), 2);
  assert.equal(heights.update(0, 180), 116);
  assert.equal(heights.update(2, 92), 28);
  assert.equal(heights.prefix(3), 336);
  assert.equal(heights.indexAt(180), 1);
  assert.equal(heights.indexAt(245), 2);
  assert.equal(heights.indexAt(999), 3);
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
  assert.match(rootHtml, /src="\/repo\/vscode-file_type_text\.svg"/);
  assert.match(rootHtml, /href="\/repo\/releases\/"/);
  assert.match(rootHtml, /href="\/repo\/space%20name\.txt"/);
  assert.match(rootHtml, /href="\/repo\/__dirwell\/raw-links\/[a-f0-9]{16}\.txt"/);
  assert.match(nestedHtml, /href="\/repo\/">Home<\/a>/);
  assert.match(nestedHtml, /href="\/repo\/releases\/v2\.4\.0\/"/);
  assert.match(nestedHtml, /src="\/repo\/releases\/dirwell\.runtime\.js"/);
  assert.match(nestedHtml, /src="\/repo\/releases\/vscode-default_folder\.svg"/);
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
  assert.match(rootHtml, /src="vscode-file_type_text\.svg"/);
  assert.match(rootHtml, /href="__dirwell\/raw-links\/[a-f0-9]{16}\.txt"/);
  assert.match(nestedHtml, /<base href="\/repo\/">/);
  assert.match(nestedHtml, /href="\.\/">Home<\/a>/);
  assert.match(nestedHtml, /href="releases\/v2\.4\.0\/"/);
  assert.match(nestedHtml, /src="releases\/dirwell\.runtime\.js"/);
  assert.match(nestedHtml, /src="releases\/vscode-default_folder\.svg"/);
  assert.match(nestedHtml, /&quot;searchIndexHref&quot;:&quot;__dirwell\/search-index\.json&quot;/);
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

test("filtered watch server serves only selected paths after rebuilds", async () => {
  for (const mode of ["ssg", "mpa"] as const) {
    const { output, root } = await fixture();
    const server = await createExplorerDevServer({
      sourceDir: root,
      outputDir: output,
      mode,
      include: "*.md",
      port: 0,
    });
    try {
      assert.equal((await fetch(`${server.url}README.txt`)).status, 404);
      assert.doesNotMatch(await (await fetch(server.url)).text(), /README\.txt|docs\//);
      await writeFile(path.join(root, "intro.md"), "Intro\n");
      const deadline = Date.now() + 5_000;
      let page = "";
      while (Date.now() < deadline) {
        page = await (await fetch(server.url)).text();
        if (page.includes("intro.md")) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.match(page, /intro\.md/);
      assert.equal(await (await fetch(`${server.url}intro.md`)).text(), "Intro\n");
    } finally {
      await server.close();
      await rm(path.dirname(root), { recursive: true, force: true });
    }
  }
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

test("entry sorting supports Unicode, locale, natural numbers, metadata, and grouping", () => {
  const metadata = (size: number, modifiedAt: string) => ({
    device: 0,
    groupId: 0,
    hardLinkCount: 1,
    inode: 0,
    mode: 0,
    ownerId: 0,
    size,
    times: {
      accessedAt: modifiedAt,
      changedAt: modifiedAt,
      createdAt: modifiedAt,
      modifiedAt,
    },
  });
  const entries = [
    {
      absolutePath: "/file10",
      kind: "file" as const,
      metadata: metadata(10, "2025-01-02T00:00:00.000Z"),
      name: "file10",
      relativePath: "file10",
      symlink: null,
    },
    {
      absolutePath: "/file2",
      kind: "file" as const,
      metadata: metadata(2, "2025-01-01T00:00:00.000Z"),
      name: "file2",
      relativePath: "file2",
      symlink: null,
    },
    {
      absolutePath: "/folder",
      kind: "directory" as const,
      metadata: metadata(50, "2025-01-03T00:00:00.000Z"),
      name: "folder",
      relativePath: "folder",
      symlink: null,
    },
  ];
  assert.deepEqual(
    [...entries]
      .sort((left, right) =>
        compareEntries(left, right, { directoriesFirst: false, nameMode: "natural" }),
      )
      .map(({ name }) => name),
    ["file2", "file10", "folder"],
  );
  assert.deepEqual(
    [...entries]
      .sort((left, right) =>
        compareEntries(left, right, {
          direction: "desc",
          directoriesFirst: true,
          field: "size",
        }),
      )
      .map(({ name }) => name),
    ["folder", "file10", "file2"],
  );
  assert.ok(
    compareEntryValues(
      { directory: false, modified: 0, name: "file2", size: 2 },
      { directory: false, modified: 0, name: "file10", size: 10 },
      { direction: "asc", directoriesFirst: false, field: "name", nameMode: "natural" },
    ) < 0,
  );
  assert.ok(
    compareEntryValues(
      { directory: false, modified: 0, name: "😀", size: 0 },
      { directory: false, modified: 0, name: "\uE000", size: 0 },
      { direction: "asc", directoriesFirst: false, field: "name", nameMode: "unicode" },
    ) > 0,
  );
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
      globalSearch: false,
      keyboardNavigation: false,
      sorting: false,
    }),
  });
  const html = await readFile(path.join(output, "index.html"), "utf8");
  assert.doesNotMatch(html, /data-search-input|data-color-scheme|dirwell\.runtime/);
  assert.doesNotMatch(html, /data-sort-heading|<button class="sort-heading"/);
  assert.match(html, /<span class="sort-heading">name<\/span>/);
});

test("global search remains available without local search", async (context) => {
  const { output, root } = await fixture();
  context.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await generateExplorer({
    sourceDir: root,
    outputDir: output,
    theme: createDefaultTheme({
      colorScheme: false,
      fuzzySearch: false,
      globalSearch: true,
      keyboardNavigation: false,
      sorting: false,
    }),
  });
  const html = await readFile(path.join(output, "index.html"), "utf8");
  assert.match(html, /data-global-open/);
  assert.match(html, /data-global-dialog/);
  assert.doesNotMatch(html, /data-search-input/);
  assert.match(html, /dirwell\.runtime\.js/);
  assert.throws(() => createDefaultTheme({ virtualizeAfter: -1 }), /virtualizeAfter/);
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
