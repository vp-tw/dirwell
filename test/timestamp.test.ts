import assert from "node:assert/strict";
import test from "node:test";
import type { FileSystemEntry, ThemeContext } from "../src/model.ts";
import { defaultThemeComponents } from "../src/theme-default/components.ts";
import { createPlainTheme } from "../src/theme-plain.ts";
import { localTimestampLabel, utcTimestamp as browserTimestamp } from "../src/theme-runtime.js";
import { utcTimestamp as serverTimestamp } from "../src/timestamp.ts";

const cases = [
  ["2025-12-31T23:30:00-02:00", "2026-01-01T01:30:00.000Z", "2026-01-01 01:30 UTC"],
  ["2026-01-01T01:30:00+02:00", "2025-12-31T23:30:00.000Z", "2025-12-31 23:30 UTC"],
  ["2026-01-01T01:30:00.000Z", "2026-01-01T01:30:00.000Z", "2026-01-01 01:30 UTC"],
] as const;

test("server and browser timestamps show the same UTC instant across date boundaries", () => {
  for (const [input, datetime, label] of cases) {
    const expected = { datetime, label };
    assert.deepEqual(serverTimestamp(input), expected);
    assert.deepEqual(browserTimestamp(input), expected);
  }
  for (const invalid of [undefined, "", "invalid", "2026-13-01T00:00:00Z", "2026-01-01T00:00:00"]) {
    assert.equal(serverTimestamp(invalid), null);
    assert.equal(browserTimestamp(invalid), null);
  }
});

test("browser labels use the instant's local offset across date and daylight-saving boundaries", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Asia/Taipei";
    assert.equal(localTimestampLabel("2025-12-31T23:30:00Z"), "2026-01-01 07:30 UTC+08:00");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(localTimestampLabel("2026-01-01T01:30:00Z"), "2025-12-31 17:30 UTC-08:00");
    assert.equal(localTimestampLabel("2026-07-01T01:30:00Z"), "2026-06-30 18:30 UTC-07:00");
    assert.equal(localTimestampLabel("invalid"), null);
    assert.equal(localTimestampLabel(undefined), null);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

function entry(modifiedAt: string): FileSystemEntry {
  return {
    absolutePath: "/report.txt",
    kind: "file",
    metadata: {
      device: 0,
      groupId: 0,
      hardLinkCount: 1,
      inode: 0,
      mode: 0,
      ownerId: 0,
      size: 4,
      times: { accessedAt: modifiedAt, changedAt: modifiedAt, createdAt: modifiedAt, modifiedAt },
    },
    name: "report.txt",
    relativePath: "report.txt",
    symlink: null,
  };
}

test("default and plain static rows preserve the instant without JavaScript", async () => {
  const file = entry("2026-01-01T01:30:00+02:00");
  const expected = '<time datetime="2025-12-31T23:30:00.000Z">2025-12-31 23:30 UTC</time>';
  const defaultRow = defaultThemeComponents.EntryRow({
    entry: file,
    icon: "",
    index: 0,
    navigation: { exitsExplorer: false, href: "report.txt" },
  });
  assert.ok(defaultRow.includes(expected));
  assert.match(
    defaultRow,
    new RegExp(`data-modified="${Date.parse(file.metadata.times.modifiedAt)}"`),
  );

  const directory = { ...entry("2026-01-01T00:00:00Z"), kind: "directory" as const };
  const plain = await createPlainTheme().render({
    assetHref: () => "",
    directory: { current: directory, depth: 0, entries: [file], parent: null, root: directory },
    documentBaseHref: null,
    hrefFor: () => "report.txt",
    hrefForDirectory: () => "./",
    exitsExplorerFor: () => false,
    mode: "ssg",
    outputName: "index.html",
    searchIndexHref: "",
    sort: { direction: "asc", directoriesFirst: false, field: "name", nameMode: "natural" },
  } as ThemeContext);
  assert.ok(plain.html.includes(expected));

  const unknown = defaultThemeComponents.EntryRow({
    entry: entry("invalid"),
    icon: "",
    index: 0,
    navigation: { exitsExplorer: false, href: "report.txt" },
  });
  assert.match(unknown, /data-modified="0"/);
  assert.match(unknown, /<span class="modified">Unknown<\/span>/);
  assert.doesNotMatch(unknown, /<time/);
});
