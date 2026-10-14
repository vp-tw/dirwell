import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, copyFile, writeFile, rm, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createShareImage } from "../packages/share-image/dist/index.mjs";
const fixture = new URL("./fixtures/fonts/DirwellFontFixture.ttf", import.meta.url);
const sans = new URL("../packages/share-image/src/fonts/SourceSans3-Regular.otf", import.meta.url);
const serif = new URL(
  "../packages/share-image/src/fonts/SourceSerif4-Regular.otf",
  import.meta.url,
);
const options = {
  title: "繁體中文 日本語 こんにちは",
  description: "資料下載 Sample files",
  repositoryName: "字型測試",
  directoryPath: "目錄",
};
const bytes = async (options) => Buffer.from(await (await createShareImage(options)).arrayBuffer());
for (const theme of ["ledger", "plain", "crosswave"])
  test(`${theme}: local CJK font is deterministic and produces a 1200x630 PNG`, async () => {
    const input = { ...options, theme, fonts: { body: fixture } };
    const first = await bytes(input);
    assert.deepEqual(first, await bytes(input));
    assert.equal(first.readUInt32BE(16), 1200);
    assert.equal(first.readUInt32BE(20), 630);
  });
test("font bytes at the same path invalidate the image cache; concurrent roles stay independent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dirwell-fonts-"));
  try {
    const path = join(dir, "font.otf");
    const input = { title: "Sample files", description: "Downloads", fonts: { body: path } };
    await copyFile(sans, path);
    const first = await bytes(input);
    await copyFile(serif, path);
    const second = await bytes(input);
    assert.notDeepEqual(first, second);
    const [a, b] = await Promise.all([
      bytes({ ...input, fonts: { body: sans } }),
      bytes({ ...input, fonts: { body: serif } }),
    ]);
    assert.deepEqual(a, first);
    assert.deepEqual(b, second);
    assert.notDeepEqual(a, await bytes({ ...input, fonts: { body: sans, headline: serif } }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("font validation reports unsupported sources, formats, oversized bytes and missing glyph roles", async () => {
  await assert.rejects(
    bytes({ ...options, title: "Sample files", fonts: { body: sans } }),
    /body font lacks U\+/,
  );
  await assert.rejects(
    bytes({ ...options, fonts: { body: fixture, headline: sans } }),
    /headline font lacks U\+/,
  );
  await assert.rejects(
    bytes({ ...options, fonts: { body: new URL("https://example.com/font.ttf") } }),
    /local path or file URL/,
  );
  await assert.rejects(
    bytes({ ...options, fonts: { body: "https://example.com/font.ttf" } }),
    /local path or file URL/,
  );
  await assert.rejects(bytes({ ...options, fonts: { unknown: "x" } }), /only body\/headline/);
  const dir = await mkdtemp(join(tmpdir(), "dirwell-bad-fonts-"));
  try {
    await assert.rejects(
      bytes({ ...options, fonts: { body: join(dir, "missing.ttf") } }),
      /Cannot read fonts.body/,
    );
    const path = join(dir, "bad.ttf");
    await writeFile(path, Buffer.alloc(16));
    await assert.rejects(bytes({ ...options, fonts: { body: path } }), /single TTF or OTF/);
    const file = await open(path, "w");
    await file.truncate(32 * 1024 * 1024 + 1);
    await file.close();
    await assert.rejects(bytes({ ...options, fonts: { body: path } }), /32 MiB/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
