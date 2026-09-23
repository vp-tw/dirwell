import type { FileSystemEntry } from "../model.ts";

export const vscodeIconNames = [
  "default_file",
  "default_folder",
  "file_type_css",
  "file_type_html",
  "file_type_image",
  "file_type_js",
  "file_type_json",
  "file_type_markdown",
  "file_type_pdf2",
  "file_type_shell",
  "file_type_text",
  "file_type_typescript",
  "file_type_yaml",
  "file_type_zip",
] as const;

export type VscodeIconName = (typeof vscodeIconNames)[number];

export const vscodeIconsByExtension: Readonly<Record<string, VscodeIconName>> = {
  bash: "file_type_shell",
  cjs: "file_type_js",
  css: "file_type_css",
  cts: "file_type_typescript",
  gif: "file_type_image",
  gz: "file_type_zip",
  htm: "file_type_html",
  html: "file_type_html",
  jpeg: "file_type_image",
  jpg: "file_type_image",
  js: "file_type_js",
  json: "file_type_json",
  jsonc: "file_type_json",
  log: "file_type_text",
  md: "file_type_markdown",
  mjs: "file_type_js",
  mts: "file_type_typescript",
  pdf: "file_type_pdf2",
  png: "file_type_image",
  sh: "file_type_shell",
  svg: "file_type_image",
  tar: "file_type_zip",
  text: "file_type_text",
  ts: "file_type_typescript",
  tsx: "file_type_typescript",
  txt: "file_type_text",
  webp: "file_type_image",
  yaml: "file_type_yaml",
  yml: "file_type_yaml",
  zip: "file_type_zip",
  zsh: "file_type_shell",
};

export function vscodeIconForEntry(entry: FileSystemEntry): VscodeIconName {
  if (entry.kind === "directory" || entry.symlink?.targetKind === "directory") {
    return "default_folder";
  }
  const extension = entry.name.slice(entry.name.lastIndexOf(".") + 1).toLowerCase();
  return vscodeIconsByExtension[extension] ?? "default_file";
}

export function vscodeIconAssetName(name: VscodeIconName): string {
  return `vscode-${name}.svg`;
}
