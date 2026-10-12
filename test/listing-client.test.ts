import assert from "node:assert/strict";
import test from "node:test";
import { loadListing, ListingDataError } from "../packages/core/src/client.ts";
const entry = {
  id: "a.txt",
  name: "a.txt",
  kind: "file",
  href: "a.txt",
  exitsExplorer: true,
  size: 4,
  modifiedAt: "2026-10-12T00:00:00Z",
  link: null,
};
const manifest = {
  version: 1,
  revision: "one",
  directory: "docs",
  hrefBase: "../../../docs/",
  total: 1,
  sort: { field: "name", direction: "asc", nameMode: "unicode", directoriesFirst: true },
  blocks: [{ href: "one.json", offset: 0, count: 1 }],
};
const block = { version: 1, revision: "one", offset: 0, total: 1, entries: [entry] };
function transport(responses: Response[]) {
  return (async () => {
    const response = responses.shift();
    if (!response) throw new Error("Unexpected request");
    return response;
  }) as typeof fetch;
}

test("client resolves entry URLs from the manifest base and copies only public fields", async () => {
  const value = await loadListing("https://test/__dirwell/listing/id/manifest.json", {
    fetch: transport([
      Response.json(manifest),
      Response.json({ ...block, entries: [{ ...entry, absolutePath: "private" }] }),
    ]),
  });
  assert.equal(value.entries[0]?.href, "https://test/docs/a.txt");
  assert.equal(Object.hasOwn(value.entries[0]!, "absolutePath"), false);
});
test("client retries a stale snapshot once and returns the new complete revision", async () => {
  const next = { ...manifest, revision: "two" };
  const value = await loadListing("https://test/__dirwell/listing/id/manifest.json", {
    fetch: transport([
      Response.json(manifest),
      new Response(null, { status: 404 }),
      Response.json(next),
      Response.json({ ...block, revision: "two" }),
    ]),
  });
  assert.equal(value.manifest.revision, "two");
  await assert.rejects(
    loadListing("https://test/m.json", {
      fetch: transport([
        Response.json(manifest),
        new Response(null, { status: 404 }),
        Response.json(manifest),
        new Response(null, { status: 404 }),
      ]),
    }),
    ListingDataError,
  );
});
test("client rejects duplicate IDs, incomplete data, unsafe protocols and entry-budget excess", async () => {
  for (const bad of [
    { ...block, entries: [{ ...entry, href: "javascript:alert(1)" }] },
    { ...block, total: 2 },
    { ...block, entries: [] },
    { ...block, entries: [{ ...entry, size: -1 }] },
  ])
    await assert.rejects(
      loadListing("https://test/m.json", {
        fetch: transport([Response.json(manifest), Response.json(bad)]),
      }),
      ListingDataError,
    );
  await assert.rejects(
    loadListing("https://test/m.json", {
      maxEntries: 0,
      fetch: transport([Response.json(manifest)]),
    }),
    /entry limit/,
  );
  await assert.rejects(loadListing("file:///m.json"), /native file navigation/);
  const duplicate = { ...manifest, total: 2, blocks: [{ href: "one.json", offset: 0, count: 2 }] };
  await assert.rejects(
    loadListing("https://test/m.json", {
      fetch: transport([
        Response.json(duplicate),
        Response.json({ ...block, total: 2, entries: [entry, entry] }),
      ]),
    }),
    /Duplicate/,
  );
});

test("presentation namespaces remain JSON-only and do not change core navigation facts", async () => {
  const decorated = {
    ...entry,
    presentation: { categories: ["all", "document"], mimeType: "text/plain" },
  };
  const value = await loadListing("https://test/m.json", {
    fetch: transport([Response.json(manifest), Response.json({ ...block, entries: [decorated] })]),
  });
  assert.deepEqual(value.entries[0]?.presentation, {
    categories: ["all", "document"],
    mimeType: "text/plain",
  });
});

test("page slices use the same URL and duplicate-ID validation as listing blocks", async () => {
  const { parseListingEntries } = await import("../packages/core/src/client.ts");
  assert.equal(
    parseListingEntries([entry], "https://test/docs/")[0]?.href,
    "https://test/docs/a.txt",
  );
  assert.throws(() => parseListingEntries([entry, entry], "https://test/"), /Duplicate/);
  assert.throws(
    () => parseListingEntries([{ ...entry, href: "javascript:alert(1)" }], "https://test/"),
    /protocol/,
  );
  assert.throws(() => parseListingEntries([entry], "https://test/", 0), /slice/);
});
