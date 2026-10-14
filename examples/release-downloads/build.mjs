import { readFile } from "node:fs/promises";
import { generateExplorer } from "@dirwell/core";
import { createLedgerTheme } from "@dirwell/theme-ledger";

// Read once per build. Keys are logical paths relative to ./files.
const annotations = JSON.parse(await readFile("./annotations.json", "utf8"));
const report = await generateExplorer({
  sourceDir: "./files",
  outputDir: "./generated",
  theme: createLedgerTheme({
    brand: { name: "Sample releases", footerText: "Sample project" },
    columns: [
      "name",
      { dataKey: "description", label: "Description" },
      { dataKey: "checksum", label: "SHA-256" },
      "size",
    ],
    actions: ["copy-link", "copy-path", "download"],
  }),
  entryData: (entry) => annotations[entry.id] ?? {},
});
console.log(`Published ${report.pages.length} pages to ${report.outputDir}`);
