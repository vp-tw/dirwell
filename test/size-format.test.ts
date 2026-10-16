import assert from "node:assert/strict";
import test from "node:test";
import { formatBytes, sizeValue } from "../packages/core/src/format.ts";
import { visibleRecords } from "../packages/shared-theme/src/records.ts";
import { resolveCustomization } from "../packages/shared-theme/src/customization.ts";
import { renderSize } from "../packages/shared-theme/src/size.ts";
import type { ListingEntry } from "../packages/core/src/listing.ts";

const file: ListingEntry = {
  id: "file",
  name: "file",
  kind: "file",
  href: "file",
  exitsExplorer: false,
  size: 1536,
  modifiedAt: "2026-10-16T00:00:00Z",
  link: null,
};
const link: ListingEntry = {
  ...file,
  id: "link",
  name: "link",
  kind: "symlink",
  size: 4,
  link: { target: "file", targetKind: "file", targetSize: 1536, unavailable: false, cycle: false },
};

test("byte formatting preserves exact integers and uses explicit units and locale", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1023), "1,023 B");
  assert.equal(formatBytes(1024), "1 KiB");
  assert.equal(formatBytes(1536), "1.5 KiB");
  assert.equal(formatBytes(1536, { units: "decimal" }), "1.54 kB");
  assert.equal(formatBytes(1536, { units: "bytes" }), "1,536 B");
  assert.equal(formatBytes(1536, { locale: "de-DE" }), "1,5 KiB");
  assert.equal(formatBytes(1536, { maximumFractionDigits: 0 }), "2 KiB");
  assert.equal(formatBytes(1024 * 1024 - 1, { maximumFractionDigits: 0 }), "1 MiB");
  assert.equal(formatBytes(999999, { units: "decimal" }), "1 MB");
  assert.equal(formatBytes(Number.MAX_SAFE_INTEGER, { units: "bytes" }), "9,007,199,254,740,991 B");
  assert.match(formatBytes(Number.MAX_SAFE_INTEGER), /PiB$/);
  for (const value of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => formatBytes(value), /safe integer/);
  assert.throws(() => formatBytes(1, { maximumFractionDigits: 7 }), /maximumFractionDigits/);
});

test("size selection distinguishes missing target, withheld target and directory from zero", () => {
  assert.equal(sizeValue(link), 1536);
  assert.equal(sizeValue(link, "entry"), 4);
  assert.equal(sizeValue({ ...file, size: 0 }), 0);
  assert.equal(sizeValue({ ...file, kind: "directory" }), null);
  assert.equal(sizeValue({ ...link, link: { ...link.link!, unavailable: true } }), null);
  assert.equal(sizeValue({ ...link, link: { ...link.link!, targetKind: "directory" } }), null);
  assert.equal(sizeValue({ ...link, link: { ...link.link!, targetSize: null } }), null);
});

test("official size markup labels both values and provides a native exact disclosure", () => {
  const ui = resolveCustomization();
  assert.throws(() => resolveCustomization({ size: null } as never), /size must be an object/);
  const html = renderSize(link, ui);
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.match(html, /Target/);
  assert.match(html, /Link/);
  assert.match(html, /1.5 KiB/);
  assert.match(html, /1,536 B/);
  assert.match(html, /4 B/);
  const target = renderSize(link, resolveCustomization({ size: { symlink: "target" } }));
  assert.doesNotMatch(target, /size-label">Link/);
  const own = renderSize(link, resolveCustomization({ size: { symlink: "entry", exact: "none" } }));
  assert.doesNotMatch(own, /Target|<details/);
  const unavailable = renderSize({ ...link, link: { ...link.link!, unavailable: true } }, ui);
  assert.match(unavailable, /Unavailable/);
  assert.doesNotMatch(unavailable, /1.5 KiB|1,536 B/);
  assert.match(renderSize({ ...link, name: '<script>"' }, ui), /&lt;script&gt;/);
  assert.doesNotMatch(
    renderSize(link, resolveCustomization({ size: { units: "bytes" } })),
    /<details/,
  );
  const inline = renderSize(link, resolveCustomization({ size: { exact: "inline" } }));
  assert.doesNotMatch(inline, /<details/);
  assert.match(inline, /1,536 B/);
  assert.match(
    renderSize({ ...link, link: { ...link.link!, targetKind: "directory", targetSize: null } }, ui),
    /Folder/,
  );
  assert.throws(() => resolveCustomization({ size: { symlink: "invalid" } as never }), /symlink/);
  assert.throws(
    () => resolveCustomization({ size: { unknown: true } as never }),
    /Unsupported size/,
  );
});

test("target and item size sorting are independent of formatting and missing values stay last", () => {
  const big = { ...file, id: "big", name: "big", size: 100 };
  const missing = {
    ...link,
    id: "missing",
    name: "missing",
    link: { ...link.link!, unavailable: true },
  };
  const sort = {
    field: "targetSize",
    direction: "asc",
    nameMode: "unicode",
    directoriesFirst: false,
  } as const;
  assert.deepEqual(
    visibleRecords([link, big, missing], "", ["file", "link"], sort).map((e) => e.id),
    ["big", "link", "missing"],
  );
  assert.deepEqual(
    visibleRecords([link, big, missing], "", ["file", "link"], { ...sort, direction: "desc" }).map(
      (e) => e.id,
    ),
    ["link", "big", "missing"],
  );
  assert.deepEqual(
    visibleRecords([link, big], "", ["file", "link"], { ...sort, field: "size" }).map((e) => e.id),
    ["link", "big"],
  );
});
