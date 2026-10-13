import path from "node:path";
import { readFile } from "node:fs/promises";
import { buildFrameworkTheme } from "@dirwell/theme-authoring";
import type { GenerateOptions, ExplorerTheme } from "@dirwell/core";

const compiled = await buildFrameworkTheme({
  framework: "svelte",
  component: path.join(import.meta.dirname, "Ledger.svelte"),
  output: path.join(import.meta.dirname, ".generated-theme"),
});
const { createTheme } = await import(compiled.themeUrl);
const native = createTheme({ title: "Sample downloads" }) as ExplorerTheme;
const notice = await readFile(new URL("./icons/LICENSE", import.meta.url), "utf8");
const theme: ExplorerTheme = {
  ...native,
  async render(context) {
    const page = await native.render(context);
    return { ...page, assets: { ...page.assets, "theme-icons-NOTICE.txt": notice } };
  },
};
export default {
  sourceDir: path.join(import.meta.dirname, "files"),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/default-theme-override"),
  theme,
} satisfies GenerateOptions;
