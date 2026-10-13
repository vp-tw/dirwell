import assert from "node:assert/strict";
import test from "node:test";
import { landingCode } from "../docs/src/landing-code.ts";

test("landing-page highlighting preserves the copyable code text", () => {
  const expected = {
    terminal:
      "$ npx @dirwell/cli@alpha server ./downloads\nDirwell server: http://127.0.0.1:4173/browse/",
    theme:
      'import { createLedgerTheme } from "@dirwell/theme-ledger";\nexport default { theme: createLedgerTheme({ title: "Downloads" }) };',
    urls: 'export default {\n  build: { base: "/dirwell/", urlStrategy: "base", mode: "mpa" },\n};',
    naming:
      'export default {\n  build: {\n    outputName(directory) {\n      return directory.entries.some((entry) => entry.name === "index.html")\n        ? null : "index.html";\n    },\n  },\n};',
  };

  for (const name of ["terminal", "theme", "urls", "naming"] as const) {
    assert.equal(landingCode[name].map((token) => token.text).join(""), expected[name]);
    assert.ok(landingCode[name].some((token) => token.tone !== undefined));
  }
});
