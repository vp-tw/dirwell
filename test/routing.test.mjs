import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { generateExplorer } from "../packages/core/src/index.ts";
import { createPlainTheme } from "../packages/theme-plain/dist/index.mjs";
import { createLedgerTheme } from "../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../packages/theme-crosswave/dist/index.mjs";
import { createExplorerHandler } from "../packages/server/dist/index.mjs";
import { directoryRoute } from "../packages/core/src/routing.ts";

async function fixture(context) {
  const temp = await mkdtemp(path.join(tmpdir(), "dirwell-routing-"));
  context.after(() => rm(temp, { recursive: true, force: true }));
  const sourceDir = path.join(temp, "source"),
    outputDir = path.join(temp, "output");
  await mkdir(path.join(sourceDir, "folder", "nested"), { recursive: true });
  await mkdir(path.join(sourceDir, "owned"));
  await writeFile(path.join(sourceDir, "one.txt"), "one");
  await writeFile(path.join(sourceDir, "two.txt"), "two");
  await writeFile(path.join(sourceDir, "folder", "note #%.txt"), "note");
  await writeFile(path.join(sourceDir, "owned", "index.html"), "OWNED");
  return { temp, sourceDir, outputDir };
}
const decode = (value) => value.replaceAll("&amp;", "&");
async function exists(filename) {
  try {
    return (await stat(filename)).isFile();
  } catch {
    return false;
  }
}

test(
  "864 publication combinations resolve HTML, JSON and native pagination to their planned resources",
  { timeout: 180_000 },
  async (context) => {
    const f = await fixture(context);
    let count = 0;
    for (const directoryUrls of ["explicit", "slash", "clean"])
      for (const mode of ["ssg", "mpa"])
        for (const urlStrategy of ["relative", "base", "html-base"])
          for (const base of ["/", "/downloads/"])
            for (const factory of [createPlainTheme, createLedgerTheme, createCrosswaveTheme])
              for (const mirror of [false, true])
                for (const html of ["all", "paged"])
                  for (const data of ["all", "blocks"]) {
                    const label = JSON.stringify({
                      directoryUrls,
                      mode,
                      urlStrategy,
                      base,
                      theme: factory.name,
                      mirror,
                      html,
                      data,
                    });
                    const theme = factory(),
                      captures = [];
                    const report = await generateExplorer({
                      sourceDir: f.sourceDir,
                      outputDir: f.outputDir,
                      routing: { directoryUrls },
                      mode,
                      urlStrategy,
                      base,
                      mirror,
                      listing: {
                        html:
                          html === "all" ? { strategy: "all" } : { strategy: "paged", pageSize: 2 },
                        data:
                          data === "all"
                            ? { strategy: "all" }
                            : { strategy: "blocks", blockSize: 2 },
                      },
                      theme: {
                        ...theme,
                        render: async (c) => {
                          const rendered = await theme.render(c);
                          captures.push({ c, rendered });
                          return rendered;
                        },
                      },
                    });
                    assert.equal(
                      report.pages.find((p) => p.directory === "folder").outputPath,
                      directoryUrls === "clean" ? "folder.html" : "folder/index.html",
                      label,
                    );
                    for (const { c, rendered } of captures) {
                      const route = directoryRoute(
                        c.directory.current.relativePath,
                        c.outputName,
                        directoryUrls,
                        c.listing?.page.number ?? 1,
                      );
                      const documentUrl = new URL(route.publicPath, "https://example.test" + base);
                      const baseTag = rendered.html.match(/<base href="([^"]+)"/);
                      const linkBase = baseTag
                        ? new URL(decode(baseTag[1]), documentUrl)
                        : documentUrl;
                      for (const m of rendered.html.matchAll(/(?:href|src)="([^"]+)"/g)) {
                        const href = decode(m[1]);
                        if (href.startsWith("#") || href.startsWith("data:")) continue;
                        const target = new URL(href, linkBase);
                        if (target.origin !== documentUrl.origin) continue;
                        assert.ok(
                          target.pathname.startsWith(base),
                          `${label}: escaped prefix ${target}`,
                        );
                        const logical = target.pathname
                          .slice(base.length)
                          .split("/")
                          .map(decodeURIComponent)
                          .join("/");
                        const candidates = [
                          logical || "index.html",
                          logical.endsWith("/") ? logical + "index.html" : logical + ".html",
                        ];
                        const found = await Promise.all(
                          candidates.map((p) => exists(path.join(f.outputDir, p))),
                        );
                        const sourceFile =
                          !mirror && (await exists(path.join(f.sourceDir, logical)));
                        assert.ok(
                          found.some(Boolean) || sourceFile,
                          `${label}: unresolved ${href} from ${documentUrl}`,
                        );
                      }
                      if (c.listing.manifestHref) {
                        const manifestUrl = new URL(c.listing.manifestHref, linkBase);
                        const manifestPath = path.join(
                          f.outputDir,
                          decodeURIComponent(manifestUrl.pathname.slice(base.length)),
                        );
                        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
                        const recordBase = new URL(manifest.hrefBase, manifestUrl);
                        // The manifest's hrefBase must resolve records exactly as the actual HTML document does.
                        for (const block of manifest.blocks) {
                          const records = JSON.parse(
                            await readFile(
                              path.join(path.dirname(manifestPath), block.href),
                              "utf8",
                            ),
                          ).entries;
                          for (const entry of records)
                            if (entry.href !== null) {
                              assert.equal(
                                new URL(entry.href, recordBase).href,
                                new URL(entry.href, linkBase).href,
                                label,
                              );
                              if (typeof entry.presentation?.folderDataHref === "string") {
                                const asset = new URL(
                                  entry.presentation.folderDataHref,
                                  recordBase,
                                );
                                assert.ok(
                                  await exists(
                                    path.join(
                                      f.outputDir,
                                      decodeURIComponent(asset.pathname.slice(base.length)),
                                    ),
                                  ),
                                  `${label}: missing folder snapshot ${asset}`,
                                );
                              }
                            }
                        }
                      }
                      assert.equal(
                        await readFile(path.join(f.outputDir, route.outputPath), "utf8"),
                        rendered.html,
                        label,
                      );
                    }
                    if (mirror)
                      assert.equal(
                        await readFile(path.join(f.outputDir, "owned/index.html"), "utf8"),
                        "OWNED",
                      );
                    count++;
                  }
    assert.equal(count, 864);
  },
);

test("route conflicts fail without replacing prior output; skipped missing ancestors have no href", async (context) => {
  const f = await fixture(context),
    theme = createPlainTheme();
  await generateExplorer({ sourceDir: f.sourceDir, outputDir: f.outputDir, theme });
  const previous = await readFile(path.join(f.outputDir, "index.html"), "utf8");
  await writeFile(path.join(f.sourceDir, "folder.html"), "DOWNLOAD");
  for (const dryRun of [false, true])
    await assert.rejects(
      generateExplorer({
        sourceDir: f.sourceDir,
        outputDir: f.outputDir,
        theme,
        routing: { directoryUrls: "clean" },
        dryRun,
      }),
      /conflicts/,
    );
  assert.equal(await readFile(path.join(f.outputDir, "index.html"), "utf8"), previous);
  await assert.rejects(
    generateExplorer({
      sourceDir: f.sourceDir,
      outputDir: f.outputDir,
      theme,
      outputName: "index.html",
    }),
    /conflicts/,
  );
  await generateExplorer({
    sourceDir: f.sourceDir,
    outputDir: f.outputDir,
    theme,
    outputName: (d) => (d.current.relativePath === "folder" ? null : "files.html"),
  });
  const child = await readFile(path.join(f.outputDir, "folder/nested/files.html"), "utf8");
  assert.doesNotMatch(child, /<a href="\.\.\/"/);
  assert.match(child, /<span>folder<\/span>/);
});

test("invalid routing and removed theme settings fail explicitly", async (context) => {
  const f = await fixture(context),
    theme = createPlainTheme();
  assert.throws(() => createPlainTheme({ portableLinks: false }), /routing.directoryUrls/);
  for (const routing of [
    null,
    { directoryUrls: null },
    { directoryUrls: "auto" },
    { trailingSlash: true },
  ])
    await assert.rejects(
      generateExplorer({ sourceDir: f.sourceDir, outputDir: f.outputDir, theme, routing }),
      /routing/,
    );
  await assert.rejects(
    generateExplorer({
      sourceDir: f.sourceDir,
      outputDir: f.outputDir,
      theme,
      routing: { directoryUrls: "slash" },
      outputName: "files.html",
    }),
    /Custom outputName/,
  );
});

test("live routing normalizes owned aliases after authorization, preserves query, methods and directory identity", async (context) => {
  const f = await fixture(context);
  await mkdir(path.join(f.sourceDir, "index.html"));
  for (const directoryUrls of ["explicit", "slash", "clean"])
    for (const mountPath of ["", "/downloads"]) {
      const handler = await createExplorerHandler({
        root: f.sourceDir,
        mountPath,
        routing: { directoryUrls },
        theme: createPlainTheme(),
        files: "media",
        pageSize: 2,
        authorize: (_r, p) => p !== "owned",
      });
      const root =
        mountPath +
        "/browse" +
        (directoryUrls === "explicit" ? "/index.html" : directoryUrls === "slash" ? "/" : "");
      const child =
        mountPath +
        "/browse/folder" +
        (directoryUrls === "explicit" ? "/index.html" : directoryUrls === "slash" ? "/" : "");
      const request = (p, method = "GET") =>
        handler(new Request("https://example.test" + p, { method }));
      assert.equal((await request(root)).status, 200);
      assert.equal((await request(child, "HEAD")).status, 200);
      assert.equal(await (await request(child, "HEAD")).text(), "");
      assert.equal((await request(child, "POST")).status, 405);
      const alias = child.endsWith("/")
        ? child.slice(0, -1)
        : directoryUrls === "explicit"
          ? mountPath + "/browse/folder/"
          : child + "/";
      const redirected = await request(alias + "?page=1&query=a%20b");
      assert.equal(redirected.status, 307);
      assert.equal(redirected.headers.get("location"), child + "?page=1&query=a%20b");
      assert.equal((await request(mountPath + "/browse/owned/")).status, 403);
      const special =
        mountPath +
        "/browse/index.html" +
        (directoryUrls === "explicit" ? "/index.html" : directoryUrls === "slash" ? "/" : "");
      assert.match(await (await request(special)).text(), /Index of \/index.html\//);
    }
});

test("CLI routing is shared, flags override config, and adapters forward the Core contract", async (context) => {
  const f = await fixture(context);
  const { runCli } = await import("../packages/cli/src/index.ts");
  const { resolveGenerateOptions, validateConfig } =
    await import("../packages/integrations/src/config.ts");
  await writeFile(
    path.join(f.temp, "dirwell.config.mjs"),
    'export default {routing:{directoryUrls:"slash"}}',
  );
  await runCli(["build", f.sourceDir, "--out", f.outputDir], f.temp, () => {});
  assert.match(await readFile(path.join(f.outputDir, "index.html"), "utf8"), /href="folder\/"/);
  await runCli(
    ["build", f.sourceDir, "--out", f.outputDir, "--directory-urls", "clean"],
    f.temp,
    () => {},
  );
  assert.ok(await exists(path.join(f.outputDir, "folder.html")));
  // A distinct module filename avoids ESM's deliberate module-instance cache.
  const bad = path.join(f.temp, "bad-config.mjs");
  await writeFile(bad, 'export default {build:{routing:{directoryUrls:"slash"}}}');
  await assert.rejects(
    runCli(["build", f.sourceDir, "--out", f.outputDir, "--config", bad], f.temp, () => {}),
    /build.routing/,
  );
  const config = {
    root: f.sourceDir,
    outDir: f.outputDir,
    theme: createPlainTheme(),
    routing: { directoryUrls: "clean" },
  };
  validateConfig(config);
  assert.deepEqual(resolveGenerateOptions(f.temp, config).routing, { directoryUrls: "clean" });
});

test("absolute bases, special directory segments and canonical metadata agree with public routes", async (context) => {
  const f = await fixture(context);
  const { createMetadataProvider } = await import("../packages/share-image/dist/index.mjs");
  const directory = "folder #?%";
  await mkdir(path.join(f.sourceDir, directory));
  await writeFile(path.join(f.sourceDir, directory, "data.txt"), "DATA");
  for (const directoryUrls of ["explicit", "slash", "clean"])
    for (const urlStrategy of ["base", "html-base"]) {
      const report = await generateExplorer({
        sourceDir: f.sourceDir,
        outputDir: f.outputDir,
        theme: createPlainTheme(),
        routing: { directoryUrls },
        base: "https://cdn.example.test/archive/",
        urlStrategy,
        metadata: createMetadataProvider(
          { siteUrl: "https://cdn.example.test/archive/", image: false },
          { siteName: "Archive", repositoryName: "" },
        ),
      });
      const entry = report.pages.find((p) => p.directory === directory);
      const html = await readFile(path.join(f.outputDir, entry.outputPath), "utf8");
      const publicPath =
        directoryUrls === "explicit"
          ? "folder%20%23%3F%25/index.html"
          : directoryUrls === "slash"
            ? "folder%20%23%3F%25/"
            : "folder%20%23%3F%25";
      assert.match(
        html,
        new RegExp(
          `rel="canonical" href="https://cdn\\.example\\.test/archive/${publicPath.replaceAll("?", "\\?")}"`,
        ),
      );
      assert.ok(
        html.includes(
          urlStrategy === "base"
            ? 'href="https://cdn.example.test/archive/folder%20%23%3F%25/data.txt"'
            : 'href="folder%20%23%3F%25/data.txt"',
        ),
      );
    }
});

test("occupied index directories and null file mappings preserve identities without invented links", async (context) => {
  const f = await fixture(context);
  await mkdir(path.join(f.sourceDir, "index.html"));
  const report = await generateExplorer({
    sourceDir: f.sourceDir,
    outputDir: f.outputDir,
    theme: createPlainTheme(),
  });
  assert.equal(report.pages.find((p) => p.directory === "").outputName, "_dirwell.html");
  assert.ok(await exists(path.join(f.outputDir, "index.html/index.html")));
  const handler = await createExplorerHandler({
    root: f.sourceDir,
    theme: createPlainTheme(),
    files: "media",
    fileHref: () => null,
  });
  const listing = await (await handler(new Request("https://example.test/listing"))).json();
  assert.equal(listing.entries.find((e) => e.name === "one.txt").href, null);
  const html = await (await handler(new Request("https://example.test/browse/index.html"))).text();
  assert.doesNotMatch(html, /<a[^>]*>one\.txt<\/a>/);
});

test("owned-homepage fallbacks retain explicit placement through later pages in every policy", async (context) => {
  const f = await fixture(context);
  for (let i = 0; i < 4; i++)
    await writeFile(path.join(f.sourceDir, "owned", `file-${i}.txt`), String(i));
  for (const directoryUrls of ["explicit", "slash", "clean"])
    for (const mode of ["ssg", "mpa"])
      for (const urlStrategy of ["relative", "base", "html-base"]) {
        const report = await generateExplorer({
          sourceDir: f.sourceDir,
          outputDir: f.outputDir,
          theme: createPlainTheme(),
          routing: { directoryUrls },
          mode,
          urlStrategy,
          base: "/downloads/",
          listing: { html: { strategy: "paged", pageSize: 2 }, data: { strategy: "all" } },
        });
        assert.equal(
          report.pages.find((p) => p.directory === "owned").outputPath,
          "owned/_dirwell.html",
        );
        const html = await readFile(path.join(f.outputDir, "owned/_dirwell.html"), "utf8");
        const next = html.match(/rel="next" href="([^"]+)"/)[1];
        const base =
          urlStrategy === "html-base"
            ? "https://example.test/downloads/"
            : "https://example.test/downloads/owned/_dirwell.html";
        const nextUrl = new URL(next, base);
        assert.ok(nextUrl.pathname.startsWith("/downloads/owned/__dirwell-page-"));
        const second = await readFile(
          path.join(f.outputDir, nextUrl.pathname.slice("/downloads/".length)),
          "utf8",
        );
        assert.match(second, /file-2\.txt/);
        const file = second.match(/href="([^"]*file-2\.txt)"/)[1];
        assert.equal(
          new URL(file, urlStrategy === "html-base" ? base : nextUrl).pathname,
          "/downloads/owned/file-2.txt",
        );
      }
});
