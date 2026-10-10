import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createCrosswaveTheme,
  createDefaultTheme,
  createPlainTheme,
  createShareImage,
  describeContent,
  generateExplorer,
  resolveGenerateOptions,
} from "../src/index.ts";
import type { MetadataContext } from "../src/index.ts";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-metadata-"));
  const sourceDir = path.join(root, "files");
  await mkdir(path.join(sourceDir, "docs/deep"), { recursive: true });
  await writeFile(path.join(sourceDir, "readme.txt"), "root");
  await writeFile(path.join(sourceDir, "docs/guide.md"), "guide");
  await symlink("docs", path.join(sourceDir, "alias"));
  await symlink("missing", path.join(sourceDir, "broken"));
  return { root, sourceDir, outputDir: path.join(root, "output") };
}
const png = new File([new Uint8Array([137, 80, 78, 71])], "cover.png", { type: "image/png" });
test("count descriptions order folders, files, links and handle zero/plurals", () => {
  assert.equal(
    describeContent({ folderCount: 2, fileCount: 1, linkCount: 1 }),
    "2 folders · 1 file · 1 link",
  );
  assert.equal(describeContent({ folderCount: 0, fileCount: 0, linkCount: 0 }), "Empty folder");
});
test("all built-in themes share one static image across SSG/MPA; symlink traversal does not inflate totals", async () => {
  const f = await fixture();
  try {
    for (const theme of [createDefaultTheme(), createPlainTheme(), createCrosswaveTheme()])
      for (const mode of ["ssg", "mpa"] as const) {
        await generateExplorer({
          ...f,
          mode,
          theme,
          symlinks: { follow: true },
          metadata: { siteName: "Downloads", siteUrl: "https://example.com/catalog/" },
        });
        const root = await readFile(path.join(f.outputDir, "index.html"), "utf8");
        const nested = await readFile(path.join(f.outputDir, "docs/index.html"), "utf8");
        assert.match(root, /<title>Downloads<\/title>/);
        assert.match(nested, /<title>docs · Downloads<\/title>/);
        assert.match(root, /content="2 folders · 2 files · 2 links"/);
        assert.match(nested, /https:\/\/example.com\/catalog\/docs\//);
        assert.equal(
          root.match(/property="og:image" content="([^"]+)/)?.[1],
          nested.match(/property="og:image" content="([^"]+)/)?.[1],
        );
        assert.equal((await readdir(path.join(f.outputDir, "__dirwell/metadata"))).length, 1);
        const image = await readFile(
          path.join(
            f.outputDir,
            "__dirwell/metadata",
            (await readdir(path.join(f.outputDir, "__dirwell/metadata")))[0]!,
          ),
        );
        assert.equal(image.readUInt32BE(16), 1200);
        assert.equal(image.readUInt32BE(20), 630);
      }
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
test("callbacks receive public direct/site counts; strings resolve before async File generation", async () => {
  const f = await fixture();
  const seen: MetadataContext[] = [];
  try {
    await generateExplorer({
      ...f,
      exclude: "docs/deep",
      metadata: {
        siteName: "Kit",
        title: async (m) => {
          seen.push(m);
          return `${m.directory.relativePath || "Kit"} <&>`;
        },
        description: (m) => describeContent(m.directory),
        image: async (m) => {
          assert.match(m.title, /<&>/);
          assert.equal(Object.hasOwn(m.directory, "absolutePath"), false);
          return {
            source: png,
            outputPath: `og/${m.directory.relativePath || "root"}.png`,
            alt: 'Cover "quote"',
          };
        },
      },
    });
    assert.equal(seen[0]!.site.folderCount, 1);
    assert.equal(seen[0]!.directory.folderCount, 1);
    assert.equal(seen[0]!.directory.linkCount, 2);
    const html = await readFile(path.join(f.outputDir, "docs/index.html"), "utf8");
    assert.match(html, /<title>docs &lt;&amp;&gt;<\/title>/);
    assert.match(html, /content="1 file"/);
    assert.match(html, /content="\.\.\/og\/docs.png"/);
    assert.equal(await readFile(path.join(f.outputDir, "og/docs.png")).then((b) => b.length), 4);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
test("relative source paths resolve from config directory; image:false skips assets", async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.root, "cover.png"), new Uint8Array(await png.arrayBuffer()));
    const options = resolveGenerateOptions(f.root, {
      root: "files",
      outDir: "output",
      metadata: { image: "cover.png" },
    });
    await generateExplorer(options);
    assert.equal((await readdir(path.join(f.outputDir, "__dirwell/metadata"))).length, 1);
    await generateExplorer({ ...f, metadata: { image: false } });
    assert.doesNotMatch(await readFile(path.join(f.outputDir, "index.html"), "utf8"), /og:image/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
test("failed callbacks, unsafe and conflicting paths preserve previous output", async () => {
  const f = await fixture();
  try {
    await generateExplorer({ ...f, metadata: { image: false } });
    const before = await readFile(path.join(f.outputDir, "index.html"));
    for (const outputPath of [
      "../escape.png",
      "readme.txt",
      "docs/cover.png",
      "__dirwell/search-index.json",
      "index.html",
    ]) {
      await assert.rejects(
        generateExplorer({ ...f, metadata: { image: { source: png, outputPath } } }),
        /Unsafe|conflicts|reserved/,
      );
      assert.deepEqual(await readFile(path.join(f.outputDir, "index.html")), before);
    }
    await assert.rejects(
      generateExplorer({
        ...f,
        metadata: {
          image: (m) => ({ source: new File([m.title], "a.png"), outputPath: "og/same.png" }),
        },
      }),
      /Conflicting/,
    );
    await assert.rejects(
      generateExplorer({
        ...f,
        metadata: {
          description: () => {
            throw new Error("callback failure");
          },
        },
      }),
      /callback failure/,
    );
    assert.deepEqual(await readFile(path.join(f.outputDir, "index.html")), before);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
test("PNG renderer handles long text deterministically with pinned fonts", async () => {
  for (const theme of ["ledger", "plain", "crosswave"] as const) {
    const options = {
      theme,
      title: "VeryLongUnbrokenCollectionName".repeat(200),
      description: "3 folders · 6 files · 2 links",
      repositoryName: "vp-tw/dirwell",
    };
    const first = await createShareImage(options),
      repeat = await createShareImage(options);
    assert.deepEqual(await first.arrayBuffer(), await repeat.arrayBuffer());
    assert.equal(first.name, `${theme}.png`);
  }
});

test("unsupported image glyphs fail clearly rather than silently rendering tofu", async () => {
  await assert.rejects(
    createShareImage({ title: "中文", description: "1 file" }),
    /Bundled share-image font lacks/,
  );
});

test("pinned PNG goldens match across development and CI platforms", async () => {
  const { createHash } = await import("node:crypto");
  const goldens: Record<string, string> = {
    ledger: "e2fee3038be28d875db8fd2dfda7fcb43028c9b076dbbe5302617f63cd36d5fb",
    plain: "1211394da0158c334ae218c1bd72cbb375b69c946eb7b748c098b4fb6e90acb8",
    crosswave: "5ea4f155f310bce07d99949055e97794cd1d3f94e14645dd7a9d60b090c9d944",
  };
  for (const theme of ["ledger", "plain", "crosswave"] as const) {
    const image = await createShareImage({
      theme,
      title: "Dirwell",
      description: "3 folders · 6 files",
      repositoryName: "vp-tw/dirwell",
    });
    const hash = createHash("sha256")
      .update(new Uint8Array(await image.arrayBuffer()))
      .digest("hex");
    assert.equal(hash, goldens[theme]);
  }
});
