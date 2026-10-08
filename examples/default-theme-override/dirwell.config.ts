import { readFile } from "node:fs/promises";
import { createDefaultTheme, defaultThemeComponents, defineConfig } from "../../src/index.ts";
import type { DefaultThemeIconVariant } from "../../src/theme-default.ts";

const iconNames = [
  "_file",
  "_folder",
  "css",
  "html",
  "image",
  "javascript",
  "json",
  "markdown",
  "pdf",
  "text",
  "typescript",
  "yaml",
  "zip",
] as const;

async function loadIcons(flavor: "latte" | "macchiato"): Promise<DefaultThemeIconVariant> {
  const icons = Object.fromEntries(
    await Promise.all(
      iconNames.map(async (name) => [
        name,
        await readFile(new URL(`./icons/${flavor}/${name}.svg`, import.meta.url), "utf8"),
      ]),
    ),
  ) as Record<(typeof iconNames)[number], string>;
  return {
    file: icons._file,
    folder: icons._folder,
    byExtension: {
      css: icons.css,
      htm: icons.html,
      html: icons.html,
      gif: icons.image,
      jpeg: icons.image,
      jpg: icons.image,
      png: icons.image,
      svg: icons.image,
      webp: icons.image,
      cjs: icons.javascript,
      js: icons.javascript,
      mjs: icons.javascript,
      json: icons.json,
      jsonc: icons.json,
      md: icons.markdown,
      pdf: icons.pdf,
      log: icons.text,
      txt: icons.text,
      cts: icons.typescript,
      mts: icons.typescript,
      ts: icons.typescript,
      tsx: icons.typescript,
      yaml: icons.yaml,
      yml: icons.yaml,
      gz: icons.zip,
      tar: icons.zip,
      zip: icons.zip,
    },
  };
}

const paletteStyles = `
:root[data-theme="light"],
:root[data-theme="system"] {
  --paper: #e6e9ef;
  --surface: #eff1f5;
  --ink: #4c4f69;
  --muted: #6c6f85;
  --rule: #bcc0cc;
  --soft-rule: #ccd0da;
  --accent: #7c2ce0;
  --accent-strong: #6d29c6;
  --focus: #7c2ce0;
  --hover: #dce0e8;
  --control: #eff1f5;
  --status: #40a02b;
  --warning: #d20f39;
}
:root[data-theme="dark"] {
  --paper: #1e2030;
  --surface: #24273a;
  --ink: #cad3f5;
  --muted: #a5adcb;
  --rule: #494d64;
  --soft-rule: #363a4f;
  --accent: #8aadf4;
  --accent-strong: #b7bdf8;
  --focus: #8aadf4;
  --hover: #363a4f;
  --control: #1e2030;
  --status: #a6da95;
  --warning: #ed8796;
}
@media (prefers-color-scheme: dark) {
  :root[data-theme="system"] {
    --paper: #1e2030;
    --surface: #24273a;
    --ink: #cad3f5;
    --muted: #a5adcb;
    --rule: #494d64;
    --soft-rule: #363a4f;
    --accent: #8aadf4;
    --accent-strong: #b7bdf8;
    --focus: #8aadf4;
    --hover: #363a4f;
    --control: #1e2030;
    --status: #a6da95;
    --warning: #ed8796;
  }
}
.palette-location {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.2rem 1rem;
}
.palette-brand {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.2rem 0.6rem;
  color: var(--ink);
}
.palette-brand span { color: var(--muted); }
`;

const iconLicense = await readFile(new URL("./icons/LICENSE", import.meta.url), "utf8");

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/default-theme-override",
  theme: createDefaultTheme({
    project: {
      author: "vp-tw",
      name: "Dirwell",
      repositoryUrl: "https://github.com/vp-tw/dirwell",
      licenseUrl: "https://github.com/vp-tw/dirwell/blob/main/LICENSE",
    },
    icons: {
      light: await loadIcons("latte"),
      dark: await loadIcons("macchiato"),
      notice: `Catppuccin Icons for VSCode, revision b6915da9f6889b683a110aa747de96c2820a537d\nhttps://github.com/catppuccin/vscode-icons\n\n${iconLicense}`,
    },
    components: {
      PageShell: (props) =>
        defaultThemeComponents.PageShell({
          ...props,
          styles: `${props.styles}\n${paletteStyles}`,
        }),
      Breadcrumbs: (props) =>
        `<div class="palette-location"><div class="palette-brand"><strong>Catppuccin explorer</strong><span>Latte / Macchiato</span></div>${defaultThemeComponents.Breadcrumbs(props)}</div>`,
    },
  }),
});
