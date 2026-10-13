import path from "node:path";
import type { GenerateOptions } from "@dirwell/core";
import { createLedgerTheme } from "@dirwell/theme-ledger";
import { exampleMetadata } from "../metadata.ts";

export default {
  sourceDir: path.join(import.meta.dirname, "files"),
  theme: createLedgerTheme({ title: "Sample downloads" }),
  metadata: exampleMetadata({
    siteUrl: `https://vp-tw.github.io${(process.env.DIRWELL_SITE_BASE ?? "/").replace(/\/$/, "")}/examples/basic/`,
    theme: "ledger",
    siteName: "Sample downloads",
    subject: "Browse sample release files and archives.",
    imageDescription: "Release files and archives",
  }),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/basic"),
} satisfies GenerateOptions;
