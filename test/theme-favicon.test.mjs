import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateExplorer } from "../packages/core/dist/index.mjs";
import { directoryRoute } from "../packages/core/src/routing.ts";
import { browseHref } from "../packages/server/src/routing.ts";
import { createExplorerHandler } from "../packages/server/dist/index.mjs";
import { createLedgerTheme } from "../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../packages/theme-crosswave/dist/index.mjs";
import { createPlainTheme } from "../packages/theme-plain/dist/index.mjs";
import { createThemeFavicons } from "../packages/shared-theme/src/favicon.ts";

const factories = [createLedgerTheme, createCrosswaveTheme, createPlainTheme];
const decode = (value) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
const iconLinks = (html) =>
  [...html.matchAll(/<link rel="icon"([^>]*)>/g)].map(([, attributes]) =>
    Object.fromEntries(
      [...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)]),
    ),
  );
const approved = new Map(
  await Promise.all(
    [16, 32, 48].map(async (size) => [
      `${size}x${size}`,
      await readFile(new URL(`../docs/public/brand/favicon-${size}.png`, import.meta.url)),
    ]),
  ),
);
const png = approved.get("32x32");
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-favicon-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, "files"),
    outputDir = path.join(root, "out"),
    iconPath = path.join(root, "private 圖 #%.png");
  await mkdir(path.join(sourceDir, "nested/deep"), { recursive: true });
  await writeFile(path.join(sourceDir, "favicon.ico"), "User-owned icon");
  await writeFile(path.join(sourceDir, "note.txt"), "Public file");
  await writeFile(iconPath, png);
  return { root, sourceDir, outputDir, iconPath };
}
function inputs(iconPath, plain) {
  const custom = [{ type: "image/png", sizes: "32x32", bytes: png }];
  const href = '/brand/icon.png?x=1&y="2"';
  const remote = "https://icons.test/icon.png";
  return [
    [
      "default",
      undefined,
      plain ? [] : [...approved].map(([sizes, bytes]) => ({ type: "image/png", sizes, bytes })),
    ],
    ["disabled", { favicon: false }, []],
    ["legacy-disabled", { faviconUrl: false }, []],
    [
      "File",
      { favicon: { source: new File([png], "image.png", { type: "image/png" }), sizes: "32x32" } },
      custom,
    ],
    [
      "relative-path",
      { favicon: { source: path.relative(process.cwd(), iconPath), sizes: "32x32" } },
      custom,
    ],
    ["absolute-path", { favicon: { source: iconPath, sizes: "32x32" } }, custom],
    ["file-URL", { favicon: { source: pathToFileURL(iconPath), sizes: "32x32" } }, custom],
    ["root-href", { favicon: { href } }, [{ href }]],
    ["http-href", { favicon: { href: remote } }, [{ href: remote }]],
    ["legacy-root", { faviconUrl: href }, [{ href }]],
    ["legacy-http", { faviconUrl: remote }, [{ href: remote }]],
    [
      "array",
      {
        favicon: [
          { source: iconPath, sizes: "32x32", media: "(prefers-color-scheme: light)" },
          {
            href: remote,
            type: "image/png",
            sizes: "48x48",
            media: "(prefers-color-scheme: dark)",
          },
        ],
      },
      [
        { ...custom[0], media: "(prefers-color-scheme: light)" },
        { href: remote, type: "image/png", sizes: "48x48", media: "(prefers-color-scheme: dark)" },
      ],
    ],
  ];
}
function checkSnapshot(rendered, icons) {
  const snapshots = Object.values(rendered.assets ?? {})
    .filter((value) => typeof value === "string" && value.startsWith('{"version":1'))
    .map((value) => JSON.parse(value));
  for (const snapshot of snapshots) {
    assert.deepEqual(iconLinks(snapshot.metadataHead), icons);
    assert.equal(snapshot.ui?.brand?.favicon, undefined);
  }
  assert.doesNotMatch(rendered.html, /private 圖|private%20|file:\/\//);
}
for (const factory of factories) {
  test(
    `${factory.name}: 1728 static favicon configurations resolve exact bytes across pages`,
    { timeout: 300_000 },
    async (t) => {
      const f = await fixture(t);
      let count = 0;
      for (const [input, brand, expected] of inputs(f.iconPath, factory === createPlainTheme)) {
        const theme = factory({ brand });
        for (const mode of ["ssg", "mpa"])
          for (const urlStrategy of ["relative", "base", "html-base"])
            for (const base of [
              "/",
              "/deep/downloads/",
              "https://example.test/deep/downloads/",
              "https://cdn.test/deep/downloads/",
            ])
              for (const directoryUrls of ["explicit", "slash", "clean"])
                for (const outputName of ["index.html", "files.html"]) {
                  const label = JSON.stringify({
                    input,
                    mode,
                    urlStrategy,
                    base,
                    directoryUrls,
                    outputName,
                  });
                  if (outputName !== "index.html" && directoryUrls !== "explicit") {
                    await assert.rejects(
                      generateExplorer({
                        sourceDir: f.sourceDir,
                        outputDir: f.outputDir,
                        mode,
                        urlStrategy,
                        base,
                        outputName,
                        routing: { directoryUrls },
                        theme,
                      }),
                      /Custom outputName requires/,
                    );
                    count++;
                    continue;
                  }
                  const captures = [];
                  await generateExplorer({
                    sourceDir: f.sourceDir,
                    outputDir: f.outputDir,
                    mode,
                    urlStrategy,
                    base,
                    outputName,
                    routing: { directoryUrls },
                    listing: {
                      html: { strategy: "paged", pageSize: 2 },
                      data: { strategy: "all" },
                    },
                    theme: {
                      ...theme,
                      async render(context) {
                        const rendered = await theme.render(context);
                        captures.push({ context, rendered });
                        return rendered;
                      },
                    },
                  });
                  assert.equal(captures.length, 4, label);
                  const deployment = new URL(base, "https://example.test");
                  for (const { context, rendered } of captures) {
                    const route = directoryRoute(
                      context.directory.current.relativePath,
                      outputName,
                      directoryUrls,
                      context.listing.page.number,
                    );
                    const documentUrl = new URL(
                      route.publicPath,
                      `https://example.test${deployment.pathname}`,
                    );
                    const baseTag = rendered.html.match(/<base href="([^"]+)"/);
                    const effectiveBase = baseTag
                      ? new URL(decode(baseTag[1]), documentUrl)
                      : documentUrl;
                    const icons = iconLinks(rendered.html);
                    assert.equal(icons.length, expected.length, label);
                    checkSnapshot(rendered, icons);
                    for (let i = 0; i < icons.length; i++) {
                      const { bytes, href, ...attributes } = expected[i];
                      const { href: actualHref, ...actualAttributes } = icons[i];
                      assert.deepEqual(actualAttributes, attributes, label);
                      const target = new URL(actualHref, effectiveBase);
                      if (href !== undefined)
                        assert.equal(target.href, new URL(href, effectiveBase).href, label);
                      else {
                        assert.equal(
                          target.origin,
                          urlStrategy === "relative" ? documentUrl.origin : deployment.origin,
                          label,
                        );
                        assert.ok(target.pathname.startsWith(deployment.pathname), label);
                        assert.deepEqual(
                          await readFile(
                            path.join(
                              f.outputDir,
                              decodeURIComponent(target.pathname.slice(deployment.pathname.length)),
                            ),
                          ),
                          bytes,
                          label,
                        );
                      }
                    }
                    assert.equal(
                      Object.keys(rendered.assets ?? {}).filter((name) =>
                        name.startsWith("dirwell-favicon-"),
                      ).length,
                      expected.filter((item) => item.bytes).length,
                      label,
                    );
                  }
                  assert.equal(
                    await readFile(path.join(f.outputDir, "favicon.ico"), "utf8"),
                    "User-owned icon",
                  );
                  count++;
                }
      }
      assert.equal(count, 1728);
    },
  );
  test(`${factory.name}: 108 live favicon configurations preserve bytes and mounted routes`, async (t) => {
    const f = await fixture(t);
    let count = 0;
    for (const [, brand, expected] of inputs(f.iconPath, factory === createPlainTheme))
      for (const mountPath of ["", "/downloads", "/deep/files"])
        for (const directoryUrls of ["explicit", "slash", "clean"]) {
          const options = {
            root: f.sourceDir,
            theme: factory({ brand }),
            mountPath,
            routing: { directoryUrls },
            pageSize: 2,
          };
          const handler = await createExplorerHandler(options);
          for (const directory of ["", "nested", "nested/deep"]) {
            const pageUrl = new URL(browseHref(directory, options), "https://example.test");
            const response = await handler(new Request(pageUrl));
            assert.equal(response.status, 200);
            const icons = iconLinks(await response.text());
            assert.equal(icons.length, expected.length);
            for (let i = 0; i < icons.length; i++) {
              const { bytes, href, ...attributes } = expected[i];
              const { href: actualHref, ...actualAttributes } = icons[i];
              assert.deepEqual(actualAttributes, attributes);
              if (href !== undefined) assert.equal(actualHref, href);
              else {
                const target = new URL(actualHref, pageUrl);
                assert.equal(target.pathname, mountPath + "/__dirwell/asset");
                const asset = await handler(new Request(target));
                assert.equal(asset.status, 200);
                assert.equal(asset.headers.get("content-type"), "image/png");
                assert.deepEqual(Buffer.from(await asset.arrayBuffer()), bytes);
              }
            }
          }
          count++;
        }
    assert.equal(count, 108);
  });
  test(`${factory.name}: invalid favicon inputs fail at factory creation`, () => {
    for (const favicon of [
      null,
      true,
      0,
      "icon.png",
      [],
      {},
      { source: undefined },
      { href: undefined },
      { source: "icon.png", href: "/icon.png" },
      { href: "/icon.png", extra: true },
      { source: "https://test/icon.png" },
      { source: new URL("https://test/icon.png") },
      { source: new URL("file:///icon.png?x=1") },
      { source: new URL("file:///icon.png#hash") },
      { source: "file:///icon.png" },
      { source: "unknown.bin" },
      { source: new File([png], "icon.png", { type: "text/html" }) },
      { source: "icon.png", type: "text/html" },
      { href: "/icon.png", sizes: "0x0" },
      { href: "/icon.png", sizes: "32" },
      { href: "/icon.png", media: "dark\nlight" },
      ...[
        "",
        "relative.png",
        "//test/icon.png",
        "/\\test/icon.png",
        "javascript:alert(1)",
        "data:image/png,foo",
        "https://",
        " https://test/icon.png",
      ].map((href) => ({ href })),
    ])
      assert.throws(() => factory({ brand: { favicon } }), /brand.favicon/);
    for (const faviconUrl of [
      null,
      true,
      0,
      "",
      "relative.png",
      "//test/icon.png",
      "javascript:alert(1)",
    ])
      assert.throws(() => factory({ brand: { faviconUrl } }), /brand.favicon/);
    for (const favicon of [false, { href: "/one.png" }])
      assert.throws(() => factory({ brand: { favicon, faviconUrl: false } }), /only one/);
  });
}

test("source lifetime, option snapshots, duplicate bytes and lazy defaults", async (t) => {
  const f = await fixture(t);
  const originalCwd = process.cwd();
  const descriptor = { source: pathToFileURL(f.iconPath), sizes: "32x32" };
  const render = createThemeFavicons({
    favicon: [descriptor, { source: f.iconPath, sizes: "16x16" }],
  });
  descriptor.source.pathname = "/changed.png";
  descriptor.sizes = "48x48";
  const first = await render((name) => "/" + name);
  assert.equal(Object.keys(first.assets).length, 1);
  assert.equal(iconLinks(first.head)[0].sizes, "32x32");
  await writeFile(f.iconPath, "changed");
  assert.deepEqual((await render((name) => "/" + name)).assets, first.assets);
  assert.notDeepEqual(
    (await createThemeFavicons({ favicon: { source: f.iconPath } })((name) => name)).assets,
    first.assets,
  );
  try {
    const relative = createThemeFavicons({
      favicon: { source: path.relative(process.cwd(), f.iconPath) },
    });
    process.chdir(f.root);
    assert.equal(
      Buffer.from(Object.values((await relative((name) => name)).assets)[0]).toString(),
      "changed",
    );
  } finally {
    process.chdir(originalCwd);
  }
  for (const brand of [
    { favicon: false },
    { favicon: { href: "/icon.png" } },
    { faviconUrl: false },
  ])
    assert.deepEqual(
      (
        await createThemeFavicons(
          brand,
          new URL("file:///missing-dirwell-fixture/"),
        )((name) => name)
      ).assets,
      {},
    );
});

test("supported image types retain bytes and live MIME types; SVG gets sizes any", async (t) => {
  const f = await fixture(t);
  for (const [extension, type] of [
    ["png", "image/png"],
    ["svg", "image/svg+xml"],
    ["ico", "image/vnd.microsoft.icon"],
    ["jpeg", "image/jpeg"],
    ["gif", "image/gif"],
    ["webp", "image/webp"],
    ["avif", "image/avif"],
  ]) {
    const bytes = Buffer.from(`unaltered ${extension} fixture`);
    const handler = await createExplorerHandler({
      root: f.sourceDir,
      theme: createPlainTheme({
        brand: { favicon: { source: new File([bytes], "image." + extension) } },
      }),
    });
    const page = await handler(new Request("https://test/browse/index.html"));
    const icons = iconLinks(await page.text());
    assert.equal(icons[0].type, type);
    assert.equal(icons[0].sizes, extension === "svg" ? "any" : undefined);
    const response = await handler(new Request(new URL(icons[0].href, "https://test")));
    assert.equal(response.headers.get("content-type"), type);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  }
  const resolved = await createThemeFavicons({
    favicon: {
      source: new File([png], "no-extension"),
      type: "image/png",
      media: 'screen and (width > 1px) and (test: "quoted")',
    },
  })((name) => name);
  assert.match(resolved.head, /&gt;.*&quot;quoted&quot;/);
  assert.equal(iconLinks(resolved.head)[0].type, "image/png");
});

test("read failures and collisions preserve the last successful archive", async (t) => {
  const f = await fixture(t);
  await generateExplorer({
    sourceDir: f.sourceDir,
    outputDir: f.outputDir,
    theme: createPlainTheme(),
  });
  const before = await readFile(path.join(f.outputDir, "index.html"));
  for (const source of [path.join(f.root, "missing.png"), f.root]) {
    await assert.rejects(
      generateExplorer({
        sourceDir: f.sourceDir,
        outputDir: f.outputDir,
        theme: createPlainTheme({ brand: { favicon: { source, type: "image/png" } } }),
      }),
      /Could not read brand.favicon source/,
    );
    assert.deepEqual(await readFile(path.join(f.outputDir, "index.html")), before);
  }
  const assets = (await createThemeFavicons({ favicon: { source: f.iconPath } })((name) => name))
    .assets;
  await writeFile(path.join(f.sourceDir, Object.keys(assets)[0]), "Owned collision");
  await assert.rejects(
    generateExplorer({
      sourceDir: f.sourceDir,
      outputDir: f.outputDir,
      theme: createPlainTheme({ brand: { favicon: { source: f.iconPath } } }),
    }),
    /collision|conflict|overwrite/i,
  );
  assert.deepEqual(await readFile(path.join(f.outputDir, "index.html")), before);
});
