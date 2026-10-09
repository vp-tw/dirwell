import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createCrosswaveTheme,
  defaultCrosswaveCategories,
  generateExplorer,
} from "../src/index.ts";
import {
  entryCategories,
  entryMimeType,
  resolveCrosswaveCategories,
} from "../src/theme-crosswave/categories.ts";
import type { FileSystemEntry } from "../src/model.ts";

const entry = (name: string): FileSystemEntry => ({
  name,
  relativePath: name,
  absolutePath: "/unused",
  kind: "file",
  symlink: null,
  metadata: {
    device: 0,
    groupId: 0,
    inode: 0,
    mode: 0,
    hardLinkCount: 1,
    size: 0,
    ownerId: 0,
    times: { accessedAt: "", changedAt: "", createdAt: "", modifiedAt: "" },
  },
});
test("MIME classification covers maintained formats and safely falls back for extensionless names", () => {
  const categories = resolveCrosswaveCategories(undefined);
  for (const [name, expected] of [
    ["movie.MKV", "video"],
    ["playlist.m3u", "audio"],
    ["book.epub", "document"],
    ["notes.docx", "document"],
    ["photo.avif", "image"],
    ["README", "other"],
    ["unknown.zzzzzz", "other"],
  ]) {
    const file = entry(name!);
    const type = entryMimeType(file);
    assert.deepEqual(
      entryCategories(file, type, categories).map((category) => category.id),
      ["all", expected],
    );
  }
});
test("custom rules overlap, use compound/case-insensitive extensions and structured MIME suffixes", () => {
  const categories = resolveCrosswaveCategories([
    { id: "browse", label: "Browse", match: "all" },
    { id: "code", label: "Code", match: { extensions: [".TS", "tsx", "custom"] } },
    { id: "docs", label: "Docs", match: { mimeTypes: ["text/*", "application/*+json"] } },
    { id: "archives", label: "Archives", match: { extensions: ["tar.gz"] } },
    { id: "remaining", label: "Other", match: "other" },
  ]);
  assert.deepEqual(
    entryCategories(entry("file.ts"), "video/mp2t", categories).map((x) => x.id),
    ["browse", "code"],
  );
  assert.deepEqual(
    entryCategories(entry("file.custom"), null, categories).map((x) => x.id),
    ["browse", "code"],
  );
  assert.deepEqual(
    entryCategories(entry("data.jsonld"), "application/ld+json", categories).map((x) => x.id),
    ["browse", "docs"],
  );
  assert.deepEqual(
    entryCategories(entry("archive.TAR.GZ"), "application/gzip", categories).map((x) => x.id),
    ["browse", "archives"],
  );
  assert.deepEqual(
    entryCategories(entry("unknown"), null, categories).map((x) => x.id),
    ["browse", "remaining"],
  );
});
test("default category definitions are immutable and malformed JS configuration fails early", () => {
  assert.equal(Reflect.set(defaultCrosswaveCategories[0]!, "label", "changed"), false);
  assert.equal(defaultCrosswaveCategories[0]!.label, "All files");
  for (const categories of [
    [],
    Array(1),
    [{ id: "ok", label: "x", match: { extensions: Array(1) } }],
    null,
    [{ id: "bad id", label: "x", match: "all" }],
    [{ id: "ok", label: "", match: "all" }],
    [{ id: "ok", label: "x", match: {} }],
    [{ id: "ok", label: "x", match: { mimeTypes: ["image/*; charset=utf8"] } }],
    [{ id: "ok", label: "x", match: { extensions: ["../txt"] } }],
    [{ id: "ok", label: "x", match: "all", icon: "unknown" }],
    [
      { id: "ok", label: "x", match: "all" },
      { id: "ok", label: "y", match: "other" },
    ],
  ])
    assert.throws(() => resolveCrosswaveCategories(categories), TypeError);
});
for (const mode of ["ssg", "mpa"] as const)
  test(`custom ${mode} rail escapes labels, retains every file, and ships classification results only`, async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), "cw-categories-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const source = path.join(root, "files"),
      output = path.join(root, "output");
    await mkdir(path.join(source, "nested"), { recursive: true });
    await writeFile(path.join(source, "code.tsx"), "source");
    await writeFile(path.join(source, "note.md"), "note");
    await writeFile(path.join(source, "not-an-image.avif"), "actually text");
    await symlink("note.md", path.join(source, "Alias"));
    await symlink("missing.txt", path.join(source, "Broken"));
    const categories = [
      {
        id: "code",
        label: "Code <safe>",
        icon: { svg: '<svg viewBox="0 0 24 24"><path d="M2 12h20"/></svg>' },
        match: { extensions: ["tsx"] },
      },
      ...defaultCrosswaveCategories.filter((category) => category.id !== "video"),
    ];
    await generateExplorer({
      sourceDir: source,
      outputDir: output,
      mode,
      theme: createCrosswaveTheme({ categories }),
    });
    const html = await readFile(path.join(output, "index.html"), "utf8");
    assert.ok(html.indexOf('data-cw-category="code"') < html.indexOf('data-cw-category="all"'));
    assert.match(html, /Code &lt;safe&gt;/);
    assert.doesNotMatch(html, /cw-tab-video/);
    assert.match(html, /data-cw-categories="all image"[^>]*data-name="not-an-image\.avif"/);
    assert.match(html, /data-cw-categories="all document"[^>]*data-name="Alias"/);
    assert.match(html, /Broken link/);
    assert.equal(await readFile(path.join(output, "not-an-image.avif"), "utf8"), "actually text");
    const runtime = await readFile(
      path.join(output, mode === "mpa" ? "__dirwell/crosswave.js" : "crosswave.js"),
      "utf8",
    );
    assert.doesNotMatch(runtime, /mime-db|mime\/types|application\/vnd\.openxmlformats/);
    assert.match(runtime, /cwCategories/);
  });
