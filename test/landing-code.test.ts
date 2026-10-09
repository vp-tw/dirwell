import assert from "node:assert/strict";
import test from "node:test";
import { landingCode } from "../docs/src/landing-code.ts";

test("landing-page highlighting preserves the copyable code text", () => {
  const expected = {
    terminal:
      "$ npx @vp-tw/dirwell@alpha serve ./downloads\nDirwell is watching /downloads\nLocal: http://127.0.0.1:4173",
    theme: "createDefaultTheme({\n  components: {\n    EntryRow: ReleaseRow,\n  },\n})",
    urls: 'defineConfig({\n  base: "/dirwell/",\n  urls: "base",\n  mode: "mpa",\n})',
    naming:
      'outputName(directory) {\n  return hasIndex(directory)\n    ? null\n    : "index.html";\n}',
  };

  for (const name of ["terminal", "theme", "urls", "naming"] as const) {
    assert.equal(landingCode[name].map((token) => token.text).join(""), expected[name]);
    assert.ok(landingCode[name].some((token) => token.tone !== undefined));
  }
});
