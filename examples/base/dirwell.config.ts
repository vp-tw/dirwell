import { defineConfig } from "../../src/index.ts";

const siteBase = process.env.DIRWELL_SITE_BASE ?? "/";

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/base",
  mode: "mpa",
  base: `${siteBase.replace(/\/$/, "")}/examples/base/`,
  urls: "base",
});
