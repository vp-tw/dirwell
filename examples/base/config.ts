import path from "node:path";
import type { GenerateOptions } from "@dirwell/core";
import { createLedgerTheme } from "@dirwell/theme-ledger";

const siteBase = process.env.DIRWELL_SITE_BASE ?? "/";

export default {
  theme: createLedgerTheme({ title: "Sample downloads" }),
  sourceDir: path.join(import.meta.dirname, "files"),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/base"),
  mode: "mpa",
  base: `${siteBase.replace(/\/$/, "")}/examples/base/`,
  urlStrategy: "base",
} satisfies GenerateOptions;
