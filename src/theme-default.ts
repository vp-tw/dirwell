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
import { resolveThemeProject, type ThemeProjectOptions } from "./theme-project.ts";
import {
  iconHrefs,
  iconNameForEntry,
  prepareIconSet,
  type DefaultThemeIconSet,
} from "./theme-default/icon-set.ts";
import { vscodeIconAssetName, vscodeIconNames } from "./theme-default/vscode-icons.ts";

export { defaultThemeComponents, escapeHtml } from "./theme-default/components.ts";
export type { DefaultThemeIconSet, DefaultThemeIconVariant } from "./theme-default/icon-set.ts";

const runtimeSource = await readFile(new URL("./theme-runtime.js", import.meta.url), "utf8");
const workerSource = await readFile(new URL("./theme-worker.js", import.meta.url), "utf8");
const vscodeIconAssets = Object.fromEntries(
  await Promise.all(
    vscodeIconNames.map(
      async (name) =>
        [
          vscodeIconAssetName(name),
          await readFile(new URL(`./vscode-icons/${name}.svg`, import.meta.url), "utf8"),
        ] as const,
    ),
  ),
);
const vscodeIconNotice = await readFile(
  new URL("./vscode-icons/NOTICE.txt", import.meta.url),
  "utf8",
);

export interface DefaultThemeOptions {
  readonly colorScheme?: boolean;
  readonly components?: DirwellThemeComponentOverrides | readonly DirwellThemeComponentOverrides[];
  readonly fuzzySearch?: boolean;
  readonly globalSearch?: boolean;
  readonly keyboardNavigation?: boolean;
  readonly icons?: DefaultThemeIconSet;
  readonly project?: ThemeProjectOptions;
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
  const project = resolveThemeProject(options.project);
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
  const iconSet = prepareIconSet(options.icons, vscodeIconAssets, vscodeIconNotice);

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
              icon: components.Icon({
                name: iconName,
                src: assetHref(iconNameForEntry(entry, iconSet.names.light)),
                ...(iconSet.names.dark === undefined
                  ? {}
                  : { darkSrc: assetHref(iconNameForEntry(entry, iconSet.names.dark)) }),
              }),
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
        icons: iconHrefs(iconSet.names, assetHref),
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
          ...(iconSet.noticeName === undefined
            ? {}
            : { iconNoticeHref: assetHref(iconSet.noticeName) }),
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
      return {
        html,
        assets: {
          ...iconSet.assets,
          ...(interactive ? { "dirwell.runtime.js": runtimeSource } : {}),
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
      };
    },
  };
}

export const defaultTheme = createDefaultTheme();
