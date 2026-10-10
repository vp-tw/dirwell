import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve("astro/package.json"));
const expressiveRequire = createRequire(astroRequire.resolve("astro-expressive-code"));
const coreRequire = createRequire(expressiveRequire.resolve("@expressive-code/core"));

test("the reviewed selector-parser override preserves nested code-block CSS", async () => {
  const postcss = coreRequire("postcss"),
    nested = coreRequire("postcss-nested");
  for (const [input, output] of [
    [
      ".a, .b { &:hover, & > .c { color: red } }",
      ".a:hover, .a > .c, .b:hover, .b > .c { color: red }",
    ],
    [".a { :is(&, .b) { color: blue } }", ":is(.a, .b) { color: blue }"],
    [
      '[data-theme="dark"] { & .code { &::before { content: "x" } } }',
      '[data-theme="dark"] .code::before { content: "x" }',
    ],
    [
      ".a { @media (min-width: 40rem) { & > .b { display: block } } }",
      "@media (min-width: 40rem) { .a > .b { display: block } }",
    ],
    [".a\\:b { &:not([hidden]) { color: red } }", ".a\\:b:not([hidden]) { color: red }"],
  ])
    assert.equal((await postcss([nested]).process(input, { from: undefined })).css, output);
});

test("the patched native image library preserves SVG rasterization and PNG decoding", async () => {
  const sharp = astroRequire("sharp");
  const image = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><rect width="24" height="12" fill="red"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 24);
  assert.equal(metadata.height, 12);
  const pixel = await sharp(image).raw().toBuffer();
  assert.deepEqual([...pixel.subarray(0, 4)], [255, 0, 0, 255]);
});

test("Astro's TOML frontmatter consumer handles null-prototype parsed tables", async () => {
  const { pathToFileURL } = await import("node:url");
  const { parseFrontmatter, isFrontmatterValid } = await import(
    pathToFileURL(astroRequire.resolve("@astrojs/internal-helpers/frontmatter")).href
  );
  const result = parseFrontmatter('+++\ntitle = "Dirwell"\n[build]\nport = 4173\n+++\nBody');
  assert.equal(result.frontmatter.title, "Dirwell");
  assert.equal(result.frontmatter.build.port, 4173);
  assert.equal(Object.getPrototypeOf(result.frontmatter), null);
  assert.equal(isFrontmatterValid(result.frontmatter), true);
  assert.equal(result.content.trim(), "Body");
});

test("the updated cache policy honors mandatory revalidation and Astro's zero TTL path", () => {
  const CachePolicy = astroRequire("http-cache-semantics");
  const request = { url: "https://example.test/image.svg", method: "GET", headers: {} };
  const policy = new CachePolicy(request, {
    status: 200,
    headers: { "cache-control": "must-revalidate", "set-cookie": "session=sample" },
  });
  assert.equal(
    policy.satisfiesWithoutRevalidation({
      ...request,
      headers: { "cache-control": "max-stale=999999" },
    }),
    false,
  );
  const privatePolicy = new CachePolicy(request, {
    status: 200,
    headers: { "cache-control": "private", "set-cookie": "session=sample" },
  });
  assert.equal(privatePolicy.storable(), false);
  assert.equal(privatePolicy.timeToLive(), 0);
});
