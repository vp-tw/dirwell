import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
const workerSource = await readFile(new URL("./theme-worker.js", import.meta.url), "utf8");

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
  /** MPA directories above this size load rows from an asset and render a measured window. */
  readonly virtualizeAfter?: number;
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
  const virtualizeAfter = options.virtualizeAfter ?? 500;
  const project = {
    author: options.project?.author ?? "VdustR",
    license: options.project?.license ?? "MIT License",
    licenseUrl:
      options.project?.licenseUrl ?? "https://github.com/VdustR/dirwell/blob/main/LICENSE",
    name: options.project?.name ?? "Dirwell",
    repositoryUrl: options.project?.repositoryUrl ?? "https://github.com/VdustR/dirwell",
  };
  if (!Number.isSafeInteger(virtualizeAfter) || virtualizeAfter < 0) {
    throw new RangeError("virtualizeAfter must be a non-negative integer");
  }
  const interactive = colorScheme || fuzzySearch || globalSearch || keyboardNavigation || sorting;
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
      mode,
    }) {
      const visiblePath =
        directory.current.relativePath === "" ? "/" : `/${directory.current.relativePath}/`;
      const virtualized =
        mode === "mpa" &&
        interactive &&
        directory.entries.length > virtualizeAfter &&
        components.EntryList === defaultThemeComponents.EntryList &&
        components.EntryRow === defaultThemeComponents.EntryRow;
      const renderedRows = virtualized
        ? []
        : directory.entries.map((entry, index) => {
            const directoryLike =
              entry.kind === "directory" || entry.symlink?.targetKind === "directory";
            const iconName = entry.kind === "symlink" ? "link" : directoryLike ? "folder" : "file";
            return components.EntryRow({
              entry,
              icon: components.Icon({ name: iconName }),
              index,
              navigation: { exitsExplorer: exitsExplorerFor(entry), href: hrefFor(entry) },
            });
          });
      const entriesAssetName = virtualized
        ? `entries-${createHash("sha256").update(directory.current.relativePath).digest("hex").slice(0, 16)}.json`
        : null;
      const rows = renderedRows.join("");
      const assets = interactive
        ? `<script src="${escapeHtml(assetHref("dirwell.runtime.js"))}" type="module"></script>`
        : "";
      const runtimeConfig = {
        colorScheme,
        fuzzySearch,
        globalSearch,
        keyboardNavigation,
        searchIndexHref,
        ...(entriesAssetName === null ? {} : { entriesHref: assetHref(entriesAssetName) }),
        ...(entriesAssetName === null ? {} : { workerHref: assetHref("dirwell.worker.js") }),
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
      return interactive
        ? {
            html,
            assets: {
              "dirwell.runtime.js": runtimeSource,
              ...(entriesAssetName === null ? {} : { "dirwell.worker.js": workerSource }),
              ...(entriesAssetName === null
                ? {}
                : {
                    [entriesAssetName]: JSON.stringify({
                      rows: directory.entries.map((entry) => ({
                        name: entry.name,
                        size: entry.metadata.size,
                        modifiedAt: entry.metadata.times.modifiedAt,
                        kind: entry.kind,
                        targetKind: entry.symlink?.targetKind ?? null,
                        target: entry.symlink?.target ?? null,
                        isCycle: entry.symlink?.isCycle ?? false,
                        isBroken: entry.symlink?.isBroken ?? false,
                        isOutsideRoot: entry.symlink?.isOutsideRoot ?? false,
                        href: hrefFor(entry),
                        exitsExplorer: exitsExplorerFor(entry),
                      })),
                      version: 1,
                    }),
                  }),
            },
          }
        : { html };
    },
  };
}

export const defaultTheme = createDefaultTheme();
