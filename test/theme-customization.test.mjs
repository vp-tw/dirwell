import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  generateExplorer,
  createDirectoryService,
  projectListingEntry,
  listingRevision,
} from "../packages/core/dist/index.mjs";
import { createPlainTheme } from "../packages/theme-plain/dist/index.mjs";
import { createLedgerTheme } from "../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../packages/theme-crosswave/dist/index.mjs";
const creators = [createPlainTheme, createLedgerTheme, createCrosswaveTheme];
async function fixture(context) {
  const cwd = await mkdtemp(path.join(tmpdir(), "dirwell-customization-"));
  context.after(() => rm(cwd, { recursive: true, force: true }));
  const sourceDir = path.join(cwd, "files");
  await mkdir(sourceDir);
  await writeFile(path.join(sourceDir, "note.txt"), "public");
  return { cwd, sourceDir };
}
for (const creator of creators)
  test(`${creator.name}: explicit language, branding and columns render without private paths`, async (context) => {
    const { cwd, sourceDir } = await fixture(context),
      outputDir = path.join(cwd, "out");
    const theme = creator({
      language: "zh-TW",
      locale: "zh-TW",
      timeZone: "Asia/Taipei",
      brand: {
        name: "Sample archive",
        footerText: "Sample owner",
        logoUrl: "/logo.png",
        faviconUrl: "/favicon.png",
      },
      columns: ["name"],
      labels: {
        home: "首頁",
        breadcrumb: "路徑",
        indexOf: "目錄 {path}",
        searchDirectory: "搜尋目錄",
        search: "搜尋",
        folder: "資料夾",
        empty: "空目錄",
      },
      cssVariables: { "--dw-font-family": "system-ui" },
    });
    await generateExplorer({ sourceDir, outputDir, theme });
    const html = await readFile(path.join(outputDir, "index.html"), "utf8");
    assert.match(html, /<html lang="zh-TW" dir="ltr"/);
    assert.match(html, /Sample archive/);
    assert.match(html, /Sample owner/);
    assert.match(html, /\/logo.png/);
    assert.match(html, /\/favicon.png/);
    assert.match(html, /--dw-font-family:system-ui/);
    assert.doesNotMatch(html, new RegExp(sourceDir));
  });
test("customization errors fail at factory creation and Plain stays script-free", async (context) => {
  for (const creator of creators) {
    assert.throws(() => creator({ labels: { invalid: "x" } }), /Unsupported label/);
    assert.throws(() => creator({ langauge: "zh-TW" }), /Unsupported theme option/);
    assert.throws(() => creator({ brand: { logoUrl: "javascript:alert(1)" } }), /HTTP/);
    assert.throws(() => creator({ cssVariables: { "--paper": "red;</style>" } }), /Invalid CSS/);
    assert.throws(() => creator({ columns: ["size"] }), /contain name/);
    assert.throws(() => creator({ timeZone: "not-a-zone" }), /time zone/i);
  }
  assert.throws(() => createPlainTheme({ actions: ["copy-link"] }), /browser runtime/);
  const { cwd, sourceDir } = await fixture(context),
    outputDir = path.join(cwd, "out");
  await generateExplorer({
    sourceDir,
    outputDir,
    theme: createPlainTheme({ actions: ["download"] }),
  });
  const html = await readFile(path.join(outputDir, "index.html"), "utf8");
  assert.match(html, /<a download href="note.txt">Download/);
  assert.doesNotMatch(html, /<script/);
});
test("annotations receive public facts, survive projection and affect live revisions", async (context) => {
  const { cwd, sourceDir } = await fixture(context);
  let description = "Original";
  const seen = [];
  const entryData = async (entry, context) => {
    seen.push([entry, context]);
    return { description, checksum: "fixture-checksum" };
  };
  const theme = createLedgerTheme({ archiveSearch: false });
  const outputDir = path.join(cwd, "out");
  await generateExplorer({
    sourceDir,
    outputDir,
    theme,
    entryData,
    listing: { html: { strategy: "all" }, data: { strategy: "all" } },
  });
  const html = await readFile(path.join(outputDir, "index.html"), "utf8");
  assert.match(html, /fixture-checksum/);
  const payloads = await readdir(path.join(outputDir, "__dirwell"));
  assert(!payloads.includes("search-index.json"));
  for (const [entry, context] of seen) {
    assert.deepEqual(Object.keys(entry).sort(), [
      "id",
      "kind",
      "link",
      "modifiedAt",
      "name",
      "size",
    ]);
    assert.equal(context.operation, "build");
  }
  const service = await createDirectoryService({ root: sourceDir, entryData });
  const project = (entry) =>
    projectListingEntry(entry, { hrefFor: () => "note.txt", exitsExplorerFor: () => false });
  const first = (await service.listDirectory("")).entries.map(project);
  description = "Updated";
  const second = (await service.listDirectory("")).entries.map(project);
  assert.equal(second[0].data.description, "Updated");
  assert.notEqual(
    listingRevision(
      first,
      { field: "name", direction: "asc", nameMode: "natural", directoriesFirst: true },
      "/",
      100,
    ),
    listingRevision(
      second,
      { field: "name", direction: "asc", nameMode: "natural", directoriesFirst: true },
      "/",
      100,
    ),
  );
  await assert.rejects(
    createDirectoryService({ root: sourceDir, entryData: async () => ({ bad: new Date() }) }).then(
      (service) => service.listDirectory(""),
    ),
    /plain objects/,
  );
});

test("static fileHref maps canonical file paths without copying or changing directory links", async (context) => {
  const { cwd, sourceDir } = await fixture(context);
  await mkdir(path.join(sourceDir, "nested"));
  const filename = "報告 #100%.txt";
  await writeFile(path.join(sourceDir, "nested", filename), "public");
  const outputDir = path.join(cwd, "out");
  const calls = [];
  await generateExplorer({
    sourceDir,
    outputDir,
    mirror: false,
    theme: createLedgerTheme(),
    fileHref(logicalPath) {
      calls.push(logicalPath);
      return logicalPath === "note.txt"
        ? null
        : "https://cdn.example.test/releases/" +
            logicalPath.split("/").map(encodeURIComponent).join("/");
    },
  });
  assert.deepEqual(calls.sort(), ["nested/" + filename, "note.txt"].sort());
  const rootHtml = await readFile(path.join(outputDir, "index.html"), "utf8");
  assert.match(rootHtml, /href="nested\/"/);
  assert.doesNotMatch(rootHtml, /href="note.txt"/);
  const nestedHtml = await readFile(path.join(outputDir, "nested/index.html"), "utf8");
  assert(
    nestedHtml.includes("https://cdn.example.test/releases/nested/" + encodeURIComponent(filename)),
  );
  await assert.rejects(readFile(path.join(outputDir, "nested", filename)), { code: "ENOENT" });
  for (const bad of ["javascript:alert(1)", "", "a\\b", Promise.resolve("/file")]) {
    await assert.rejects(
      generateExplorer({
        sourceDir,
        outputDir,
        theme: createLedgerTheme(),
        mirror: false,
        fileHref: () => bad,
      }),
      /fileHref/,
    );
    assert.equal(await readFile(path.join(outputDir, "index.html"), "utf8"), rootHtml);
  }
});
