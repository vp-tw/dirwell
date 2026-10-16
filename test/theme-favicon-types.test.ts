import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlainTheme,
  type FaviconDescriptor,
  type FaviconOptions,
} from "../packages/theme-plain/src/index.ts";
import { createLedgerTheme } from "../packages/theme-ledger/src/index.ts";
import { createCrosswaveTheme } from "../packages/theme-crosswave/src/index.ts";
import type { ThemePage } from "../packages/shared-theme/src/page.ts";

const icons = [
  { source: new File(["svg"], "icon.svg"), sizes: "any" },
  { source: new URL("file:///icon.png"), sizes: "32x32" },
  { href: "https://example.test/icon.png", media: "screen" },
] as const satisfies readonly FaviconDescriptor[];
const favicon: FaviconOptions = icons;

function rejectedTypes(page: ThemePage) {
  // @ts-expect-error Local sources cannot appear in public browser customization.
  const local = page.ui?.brand?.favicon;
  // @ts-expect-error A descriptor cannot combine a local source and public href.
  const mixed: FaviconDescriptor = { source: "icon.png", href: "/icon.png" };
  // @ts-expect-error A bare string does not distinguish a path from a public URL.
  const bare: FaviconOptions = "icon.png";
  return [mixed, bare, local];
}

test("favicon types accept readonly sources across official factories", () => {
  assert.equal(typeof rejectedTypes, "function");
  for (const factory of [createPlainTheme, createLedgerTheme, createCrosswaveTheme])
    assert.equal(typeof factory({ brand: { favicon } }).render, "function");
});
