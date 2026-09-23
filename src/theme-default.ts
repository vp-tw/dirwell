import { readFile } from "node:fs/promises";
import type { ExplorerTheme } from "./model.ts";
import {
  resolveThemeComponents,
  type BreadcrumbItem,
  type DirwellThemeComponentOverrides,
} from "./theme-components.ts";
import { defaultThemeComponents, escapeHtml } from "./theme-default/components.ts";
import { defaultStyles } from "./theme-default/styles.ts";

export { defaultThemeComponents, escapeHtml } from "./theme-default/components.ts";

const runtimeSource = await readFile(new URL("./theme-runtime.js", import.meta.url), "utf8");

export interface DefaultThemeOptions {
  readonly colorScheme?: boolean;
  readonly components?: DirwellThemeComponentOverrides | readonly DirwellThemeComponentOverrides[];
  readonly fuzzySearch?: boolean;
  readonly globalSearch?: boolean;
  readonly keyboardNavigation?: boolean;
  readonly project?: Readonly<{
    author?: string;
    license?: string;
    licenseUrl?: string;
    name?: string;
    repositoryUrl?: string;
  }>;
  readonly sorting?: boolean;
}

function createBreadcrumbs(
  relativePath: string,
  hrefForDirectory: (relativePath: string) => string,
): readonly BreadcrumbItem[] {
  const segments = relativePath === "" ? [] : relativePath.split("/");
  return [
    {
      href: segments.length === 0 ? null : hrefForDirectory(""),
      isCurrent: segments.length === 0,
      label: segments.length === 0 ? "/" : "Home",
    },
    ...segments.map((label, index) => ({
      href:
        index === segments.length - 1
          ? null
          : hrefForDirectory(segments.slice(0, index + 1).join("/")),
      isCurrent: index === segments.length - 1,
      label,
    })),
  ];
}

export function createDefaultTheme(options: DefaultThemeOptions = {}): ExplorerTheme {
  const colorScheme = options.colorScheme ?? true;
  const fuzzySearch = options.fuzzySearch ?? true;
  const globalSearch = options.globalSearch ?? true;
  const keyboardNavigation = options.keyboardNavigation ?? true;
  const sorting = options.sorting ?? true;
  const project = {
    author: options.project?.author ?? "VdustR",
    license: options.project?.license ?? "MIT License",
    licenseUrl:
      options.project?.licenseUrl ?? "https://github.com/VdustR/dirwell/blob/main/LICENSE",
    name: options.project?.name ?? "Dirwell",
    repositoryUrl: options.project?.repositoryUrl ?? "https://github.com/VdustR/dirwell",
  };
  const interactive = colorScheme || fuzzySearch || keyboardNavigation || sorting;
  const layers =
    options.components === undefined
      ? []
      : Array.isArray(options.components)
        ? options.components
        : [options.components];
  const components = resolveThemeComponents(defaultThemeComponents, ...layers);

  return {
    name: "ledger",
    render({
      assetHref,
      directory,
      documentBaseHref,
      exitsExplorerFor,
      hrefFor,
      hrefForDirectory,
      searchIndexHref,
      sort,
    }) {
      const visiblePath =
        directory.current.relativePath === "" ? "/" : `/${directory.current.relativePath}/`;
      const rows = directory.entries
        .map((entry, index) => {
          const directoryLike =
            entry.kind === "directory" || entry.symlink?.targetKind === "directory";
          const iconName = entry.kind === "symlink" ? "link" : directoryLike ? "folder" : "file";
          return components.EntryRow({
            entry,
            icon: components.Icon({ name: iconName }),
            index,
            navigation: { exitsExplorer: exitsExplorerFor(entry), href: hrefFor(entry) },
          });
        })
        .join("");
      const assets = interactive
        ? `<script src="${escapeHtml(assetHref("dirwell.runtime.js"))}" type="module"></script>`
        : "";
      const runtimeConfig = {
        colorScheme,
        fuzzySearch,
        globalSearch,
        keyboardNavigation,
        searchIndexHref,
        sort,
        sorting,
      };
      const parentHref =
        directory.parent === null ? null : hrefForDirectory(directory.parent.relativePath);
      const html = components.PageShell({
        assets,
        breadcrumbs: components.Breadcrumbs({
          items: createBreadcrumbs(directory.current.relativePath, hrefForDirectory),
        }),
        directory,
        documentBaseHref,
        emptyState: components.EmptyState({ message: "No matching entries." }),
        entryList: components.EntryList({ directory, parentHref, rows, sorting }),
        footer: components.Footer({
          keyboardNavigation,
          parentHref,
          project,
        }),
        parentHref,
        runtimeConfig,
        styles: defaultStyles,
        toolbar: components.Toolbar({
          colorScheme,
          fuzzySearch,
          globalSearch,
          keyboardNavigation,
          searchIcon: components.Icon({ name: "search" }),
          sorting,
        }),
        visiblePath,
      });
      return interactive ? { html, assets: { "dirwell.runtime.js": runtimeSource } } : { html };
    },
  };
}

export const defaultTheme = createDefaultTheme();
