import { readFile } from "node:fs/promises";
const sansLicense = await readFile(
  new URL("./fonts/source-sans-LICENSE.md", import.meta.url),
  "utf8",
);
const serifLicense = await readFile(
  new URL("./fonts/source-serif-LICENSE.md", import.meta.url),
  "utf8",
);
const monoLicense = await readFile(
  new URL("./fonts/source-code-LICENSE.md", import.meta.url),
  "utf8",
);
const mono = await readFile(new URL("./fonts/SourceCodePro-Regular.woff2", import.meta.url));
const sans = await readFile(new URL("./fonts/SourceSans3-Regular.woff2", import.meta.url));
const light = await readFile(new URL("./fonts/SourceSans3-Light.woff2", import.meta.url));
const serif = await readFile(new URL("./fonts/SourceSerif4-Regular.woff2", import.meta.url));
export function themeFonts(
  theme: "ledger" | "plain" | "crosswave",
  href: (name: string) => string,
) {
  const family = theme === "plain" ? "Source Serif 4" : "Source Sans 3";
  const name = theme === "plain" ? "source-serif-4-regular.woff2" : "source-sans-3-regular.woff2";
  const assets: Record<string, string | Uint8Array> = { [name]: theme === "plain" ? serif : sans };
  const face = (name: string, weight: number, faceFamily = family) =>
    `@font-face{font-family:'${faceFamily}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${href(name).replaceAll("'", "%27").replaceAll("\\", "%5C").replaceAll("\n", "%0A")}') format('woff2');}`;
  let css =
    face(name, 400) +
    `body,input,button,select{font-family:'${family}',${theme === "plain" ? "serif" : "sans-serif"};}`;
  if (theme === "ledger") {
    assets["source-code-pro-regular.woff2"] = mono;
    css +=
      face("source-code-pro-regular.woff2", 400, "Source Code Pro") +
      ".target{font-family:'Source Code Pro',monospace;}.target-status{font-family:'Source Sans 3',sans-serif;}";
  }
  if (theme === "crosswave") {
    assets["source-sans-3-light.woff2"] = light;
    css += face("source-sans-3-light.woff2", 300) + ".cw-brand>a{font-weight:300;}";
  }
  assets["source-fonts-NOTICE.txt"] =
    theme === "plain"
      ? `Source Serif 4\nhttps://github.com/adobe-fonts/source-serif\n\n${serifLicense}`
      : `Source Sans 3\nhttps://github.com/adobe-fonts/source-sans\n\n${sansLicense}${theme === "ledger" ? `\n\nSource Code Pro\nhttps://github.com/adobe-fonts/source-code-pro\n\n${monoLicense}` : ""}`;
  return { css, assets };
}
