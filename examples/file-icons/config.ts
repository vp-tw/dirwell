import path from "node:path";
import type { GenerateOptions } from "@dirwell/core";
import { createLedgerTheme } from "@dirwell/theme-ledger";
import { exampleMetadata } from "../metadata.ts";

export default {
  sourceDir: path.join(import.meta.dirname, "files"),
  theme: createLedgerTheme({ title: "Sample files" }),
  metadata: exampleMetadata({
    siteUrl: `https://vp-tw.github.io${(process.env.DIRWELL_SITE_BASE ?? "/").replace(/\/$/, "")}/examples/file-icons/`,
    theme: "ledger",
    siteName: "Sample files",
    subject: "Browse sample source files and documentation.",
    imageDescription: "Source files and documentation",
  }),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/file-icons"),
} satisfies GenerateOptions;
