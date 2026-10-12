import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { generateExplorer, compareEntries } from "../src/generator.ts";
import { createPlainTheme } from "../src/theme-plain.ts";
import { createDefaultTheme } from "../src/theme-default.ts";
import {
  validateListingPlan,
  type ListingManifest,
  type ListingBlock,
  type ListingPlan,
  type ListingEntry,
} from "../src/listing.ts";
import { resolveGenerateOptions, validateConfig } from "../src/config.ts";
import type { FileSystemEntry } from "../src/model.ts";

const plan: ListingPlan = {
  html: { strategy: "paged", pageSize: 2 },
  data: { strategy: "blocks", blockSize: 3 },
};
async function fixture() {
  const temp = await mkdtemp(path.join(tmpdir(), "dirwell-listing-"));
  const root = path.join(temp, "source"),
    output = path.join(temp, "output");
  await mkdir(path.join(root, "docs", "empty"), { recursive: true });
  for (const name of ["a.txt", "b.txt", "café & <script>.txt", "hidden.txt"])
    await writeFile(path.join(root, name), "text");
  await writeFile(path.join(root, "docs", "note.txt"), "note");
  await symlink("docs", path.join(root, "alias"));
  await symlink("missing", path.join(root, "broken"));
  await symlink("../outside", path.join(root, "outside-link"));
  await writeFile(path.join(temp, "outside"), "outside");
  await symlink("hidden.txt", path.join(root, "excluded-link"));
  await symlink("..", path.join(root, "docs", "cycle"));
  return { temp, root, output };
}
async function manifests(output: string): Promise<string[]> {
  const directory = path.join(output, "__dirwell", "listing");
  return (await readdir(directory)).map((id) => path.join(directory, id, "manifest.json"));
}

test("listing publication keeps independent slices, safe links and document URL bases in both modes", async (context) => {
  const f = await fixture();
  context.after(() => rm(f.temp, { recursive: true, force: true }));
  for (const mode of ["ssg", "mpa"] as const)
    for (const urlStrategy of ["relative", "base", "html-base"] as const) {
      await generateExplorer({
        sourceDir: f.root,
        outputDir: f.output,
        theme: createPlainTheme(),
        listing: plan,
        mode,
        urlStrategy,
        base: "/downloads/",
        outputName: "files.html",
        exclude: "hidden.txt",
        metadata: { siteUrl: "https://example.test/downloads/", image: false },
      });
      let rootManifest: ListingManifest | undefined;
      for (const filename of await manifests(f.output)) {
        const manifest: ListingManifest = JSON.parse(await readFile(filename, "utf8"));
        const entries: ListingEntry[] = [];
        for (const block of manifest.blocks) {
          const data: ListingBlock = JSON.parse(
            await readFile(path.join(path.dirname(filename), block.href), "utf8"),
          );
          assert.equal(data.revision, manifest.revision);
          assert.equal(data.offset, entries.length);
          assert.equal(data.total, manifest.total);
          assert.ok(data.entries.length <= 3);
          entries.push(...data.entries);
        }
        assert.equal(entries.length, manifest.total);
        assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
        for (const entry of entries) {
          assert.deepEqual(
            Object.keys(entry).sort(),
            ["id", "name", "kind", "href", "exitsExplorer", "size", "modifiedAt", "link"].sort(),
          );
          const json = JSON.stringify(entry);
          assert.ok(!json.includes(f.root));
          assert.doesNotMatch(json, /absolutePath|resolvedPath|ownerId|groupId|inode/);
          if (entry.href) {
            const manifestUrl = new URL(
              path.relative(f.output, filename).split(path.sep).join("/"),
              "https://example.test/downloads/",
            );
            const href = new URL(entry.href, new URL(manifest.hrefBase, manifestUrl));
            assert.ok(href.pathname.startsWith("/downloads/"));
            const destination = path.join(
              f.output,
              decodeURIComponent(href.pathname.slice("/downloads/".length)),
            );
            if (!href.pathname.endsWith("/")) await readFile(destination);
          }
        }
        if (manifest.directory === "") {
          rootManifest = manifest;
          assert.equal(manifest.total, 8);
          for (const name of ["broken", "outside-link", "excluded-link"]) {
            const entry = entries.find((entry) => entry.name === name);
            assert.equal(entry?.link?.unavailable, true);
            assert.equal(entry?.exitsExplorer, true);
          }
          assert.equal(
            entries.find((entry) => entry.name === "alias")?.href?.includes("docs/files.html"),
            true,
          );
        }
        if (manifest.directory === "docs/empty") {
          assert.equal(manifest.total, 0);
          assert.equal(manifest.blocks.length, 1);
        }
      }
      assert.ok(rootManifest);
      const pages = (await readdir(f.output)).filter(
        (name) => name === "files.html" || name.startsWith("__dirwell-page-"),
      );
      assert.equal(pages.length, 4);
      const canonical = new Set();
      for (const name of pages) {
        const html = await readFile(path.join(f.output, name), "utf8");
        assert.match(html, /8 entries · 2 on this page/);
        assert.doesNotMatch(html, /<script|<img|og:image/);
        const value = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
        assert.ok(value?.endsWith(name));
        canonical.add(value);
      }
      assert.equal(canonical.size, 4);
    }
});

test("policy runs once per directory, validates results and protects the prior output on failure", async (context) => {
  const f = await fixture();
  context.after(() => rm(f.temp, { recursive: true, force: true }));
  const visited = new Set<string>();
  await generateExplorer({
    sourceDir: f.root,
    outputDir: f.output,
    theme: createPlainTheme(),
    listing(info) {
      assert.ok(!visited.has(info.directoryPath));
      visited.add(info.directoryPath);
      assert.equal(info.supportsPagination, true);
      assert.ok(info.dataBytes > 0);
      return info.visibleCount > 4
        ? plan
        : { html: { strategy: "all" }, data: { strategy: "all" } };
    },
  });
  assert.equal(visited.size, 3);
  const original = await readFile(path.join(f.output, "index.html"), "utf8");
  await assert.rejects(
    generateExplorer({
      sourceDir: f.root,
      outputDir: f.output,
      theme: createDefaultTheme(),
      listing: plan,
    }),
    /does not support listing pagination/,
  );
  assert.equal(await readFile(path.join(f.output, "index.html"), "utf8"), original);
  await assert.rejects(
    generateExplorer({
      sourceDir: f.root,
      outputDir: f.output,
      theme: createPlainTheme(),
      listing: () => ({ ...plan, html: { strategy: "paged", pageSize: 0 } }),
    }),
    /positive safe integer/,
  );
  assert.equal(await readFile(path.join(f.output, "index.html"), "utf8"), original);
  const pageName = (await readdir(f.output)).find((name) => name.startsWith("__dirwell-page-"));
  assert.ok(pageName);
  await writeFile(path.join(f.root, pageName), "user content");
  await assert.rejects(
    generateExplorer({
      sourceDir: f.root,
      outputDir: f.output,
      theme: createPlainTheme(),
      listing: plan,
    }),
    /conflicts with source/,
  );
  assert.equal(await readFile(path.join(f.output, "index.html"), "utf8"), original);
});

test("config passes opt-in plans and rejects invalid plan values", () => {
  const config = { listing: plan };
  validateConfig(config);
  assert.equal(resolveGenerateOptions("/tmp", config).listing, plan);
  for (const value of [
    null,
    {},
    { html: { strategy: "page" }, data: { strategy: "all" } },
    { html: { strategy: "all" }, data: { strategy: "blocks", blockSize: Infinity } },
  ])
    assert.throws(() => validateListingPlan(value), TypeError);
});

test("legacy comparator semantics remain unchanged", () => {
  const left = { name: "a", kind: "file", relativePath: "a" } as FileSystemEntry;
  const right = { name: "A", kind: "file", relativePath: "A" } as FileSystemEntry;
  assert.equal(compareEntries(left, right), 0);
});

test("revisions change when block boundaries change and paged asset conflicts preserve output", async (context) => {
  const f = await fixture();
  context.after(() => rm(f.temp, { recursive: true, force: true }));
  const revisions: string[] = [];
  for (const blockSize of [3, 4]) {
    await generateExplorer({
      sourceDir: f.root,
      outputDir: f.output,
      theme: createPlainTheme(),
      listing: { ...plan, data: { strategy: "blocks", blockSize } },
    });
    const filename = (await manifests(f.output))[0];
    assert.ok(filename);
    const manifest: ListingManifest = JSON.parse(await readFile(filename, "utf8"));
    revisions.push(manifest.revision);
  }
  assert.notEqual(revisions[0], revisions[1]);
  const original = await readFile(path.join(f.output, "index.html"), "utf8");
  await assert.rejects(
    generateExplorer({
      sourceDir: f.root,
      outputDir: f.output,
      listing: plan,
      theme: {
        name: "conflicting",
        listing: { pagination: true },
        searchIndex: false,
        render(ctx) {
          return {
            html: "page",
            assets: { "state.json": JSON.stringify(ctx.listing?.page.number) },
          };
        },
      },
    }),
    /conflicting paginated asset/,
  );
  assert.equal(await readFile(path.join(f.output, "index.html"), "utf8"), original);
});
