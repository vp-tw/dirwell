import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { generateExplorer } from "@dirwell/core";
import { loadListing, parseListingEntries } from "@dirwell/core/client";
import { createPlainTheme } from "@dirwell/theme-plain";
import { createLedgerTheme } from "@dirwell/theme-ledger";
import { createCrosswaveTheme } from "@dirwell/theme-crosswave";
import { startExplorerServer } from "@dirwell/server/node";
import { runCli } from "@dirwell/cli";
import { createShareImage, createMetadataProvider } from "@dirwell/share-image";
import integration from "@dirwell/integrations/rollup";
import { createExpressMiddleware } from "@dirwell/server/express";
import { createFastifyPlugin } from "@dirwell/server/fastify";
import { buildFrameworkTheme } from "@dirwell/theme-authoring";
import { startAuthoringServer } from "@dirwell/theme-authoring/dev";
assert.equal(typeof createExpressMiddleware, "function");
assert.equal(typeof createFastifyPlugin, "function");
assert.equal(typeof loadListing, "function");
assert.equal(typeof parseListingEntries, "function");
await rm("source", { recursive: true, force: true });
await mkdir("source/docs", { recursive: true });
for (const name of ["one.txt", "two.txt", "three.txt", "active.html", "picture.png"])
  await writeFile("source/" + name, "data");
await assert.rejects(generateExplorer({ sourceDir: "source", outputDir: "out" }), /explicit theme/);
for (const [name, theme] of [
  ["plain", createPlainTheme()],
  ["ledger", createLedgerTheme()],
  ["crosswave", createCrosswaveTheme()],
])
  for (const mode of ["ssg", "mpa"]) {
    await generateExplorer({
      sourceDir: "source",
      outputDir: "out-" + name + "-" + mode,
      mode,
      theme,
      listing: {
        html: { strategy: "paged", pageSize: 2 },
        data: { strategy: "blocks", blockSize: 3 },
      },
    });
    const html = await readFile("out-" + name + "-" + mode + "/index.html", "utf8");
    assert.match(html, /Page 1 of 3/);
    if (name === "plain") assert.ok(!/<script|<img|og:image/.test(html));
    else {
      assert.ok(html.includes('data-dirwell-theme="' + name + '"'));
      assert.ok(!html.includes("clientTree"));
    }
  }
await runCli(["build", "source", "--out", "cli-out"], process.cwd(), () => {});
const image = await createShareImage({
  title: "Sample downloads",
  description: "Archive totals: 5 files",
  theme: "plain",
});
const imageBytes = Buffer.from(await image.arrayBuffer());
assert.equal(imageBytes.readUInt32BE(16), 1200);
assert.equal(imageBytes.readUInt32BE(20), 630);
const customImage = await createShareImage({
  title: "資料下載 日本語",
  description: "Sample files",
  fonts: { body: "font-fixture.ttf" },
});
assert.equal(Buffer.from(await customImage.arrayBuffer()).readUInt32BE(16), 1200);
assert.equal(typeof integration, "function");
await generateExplorer({
  sourceDir: "source",
  outputDir: "metadata-out",
  theme: createPlainTheme(),
  metadata: createMetadataProvider(
    { image },
    { siteName: "Downloads", repositoryName: "example/files" },
  ),
});
assert.match(await readFile("metadata-out/index.html", "utf8"), /og:image/);
const server = await startExplorerServer({
  root: "source",
  pageSize: 2,
  theme: createLedgerTheme(),
  live: { intervalMs: 50 },
  search: {},
});
try {
  const html = await fetch(server.url + "/browse/");
  assert.equal(html.status, 200);
  assert.match(await html.text(), /data-dirwell-theme/);
  const query = await fetch(server.url + "/__dirwell/search?q=one");
  assert.equal(query.status, 200);
  assert.equal((await query.json()).results[0].path, "one.txt");
  const first = await fetch(server.url + "/listing");
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.equal(data.entries.length, 2);
  assert.equal(data.total, 6);
  await writeFile("source/new.txt", "new");
  const changed = await fetch(server.url + "/listing", {
    headers: { "if-none-match": first.headers.get("etag") },
  });
  assert.equal(changed.status, 200);
  assert.notEqual((await changed.json()).revision, data.revision);
  const active = await fetch(server.url + "/files/active.html");
  if (active.status !== 200) await import("./diagnose-file-identity.mjs");
  assert.equal(active.status, 200, await active.clone().text());
  assert.match(active.headers.get("content-disposition"), /^attachment/);
  await active.text();
  const picture = await fetch(server.url + "/files/picture.png", {
    headers: { range: "bytes=1-2" },
  });
  assert.equal(picture.status, 206);
  assert.match(picture.headers.get("content-disposition"), /^inline/);
  assert.equal(await picture.text(), "at");
} finally {
  await server.close();
}
// Compile exported sources from installed tarballs, with no repository paths.
for (const framework of ["svelte", "vue"]) {
  const component = framework === "svelte" ? "Custom.svelte" : "Custom.vue";
  await writeFile(
    component,
    framework === "svelte"
      ? `<script lang="ts">import Ledger from '@dirwell/theme-ledger/source';import type {ThemePage} from '@dirwell/theme-ledger/model';let {model}:{model:ThemePage}=$props();</script><Ledger {model}>{#snippet header({model:page})}<h1 data-custom-header>{page.title} Custom</h1>{/snippet}{#snippet row({entry})}<span data-custom-row>{entry.name}</span>{/snippet}</Ledger><style>h1{color:#315b85}</style>`
      : `<script setup lang="ts">import Crosswave from '@dirwell/theme-crosswave/source';import type {ThemePage} from '@dirwell/theme-crosswave/model';defineProps<{model:ThemePage}>();</script><template><Crosswave :model="model"><template #header="{model:page}"><span data-custom-header>{{page.title}} Custom</span></template><template #row="{entry}"><span data-custom-row>{{entry.name}}</span></template></Crosswave></template><style scoped>[data-custom-header]{color:#315b85}</style>`,
  );
  const result = await buildFrameworkTheme({
    framework,
    component,
    output: "compiled-" + framework,
  });
  const compiled = await import(result.themeUrl);
  await generateExplorer({
    sourceDir: "source",
    outputDir: "authored-" + framework,
    theme: compiled.createTheme(),
  });
  assert.match(
    await readFile("authored-" + framework + "/index.html", "utf8"),
    /data-custom-header/,
  );
  const dev = await startAuthoringServer({ framework, component, explorer: { root: "source" } });
  try {
    const response = await fetch(dev.url + "/browse/");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /data-custom-header/);
  } finally {
    await dev.close();
  }
}
console.log(
  JSON.stringify({
    node: process.version,
    status: "passed",
    themes: ["plain", "ledger", "crosswave"],
    modes: ["ssg", "mpa"],
    liveListing: true,
    fileTransport: true,
    optionalImage: true,
    customFontImage: true,
    liveArchiveSearch: true,
    integrationImports: true,
    sourceAuthoring: ["svelte", "vue"],
    authoringDevSsr: true,
  }),
);
