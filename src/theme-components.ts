import type {
  DirectoryData,
  FileSystemEntry,
  NameSortMode,
  SortDirection,
  SortField,
} from "./model.ts";

export interface DefaultThemeRuntimeConfig {
  readonly colorScheme: boolean;
  readonly fuzzySearch: boolean;
  readonly globalSearch: boolean;
  readonly keyboardNavigation: boolean;
  readonly searchIndexHref: string;
  readonly entriesHref?: string;
  readonly workerHref?: string;
  readonly sorting: boolean;
  readonly sort: Readonly<{
    direction: SortDirection;
    directoriesFirst: boolean;
    field: SortField;
    nameMode: NameSortMode;
  }>;
}

export type ThemeComponent<Props> = (props: Props) => string;

export interface BreadcrumbItem {
  readonly href: string | null;
  readonly label: string;
  readonly isCurrent: boolean;
}

export interface EntryNavigation {
  readonly exitsExplorer: boolean;
  readonly href: string | null;
}

export interface PageShellProps {
  readonly assets: string;
  readonly breadcrumbs: string;
  readonly directory: DirectoryData;
  readonly documentBaseHref: string | null;
  readonly emptyState: string;
  readonly entryList: string;
  readonly footer: string;
  readonly parentHref: string | null;
  readonly runtimeConfig: DefaultThemeRuntimeConfig;
  readonly styles: string;
  readonly toolbar: string;
  readonly visiblePath: string;
}

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
}

export interface ToolbarProps {
  readonly colorScheme: boolean;
  readonly fuzzySearch: boolean;
  readonly globalSearch: boolean;
  readonly keyboardNavigation: boolean;
  readonly searchIcon: string;
  readonly sorting: boolean;
}

export interface EntryListItem {
  readonly entry: FileSystemEntry;
  readonly index: number;
  readonly navigation: EntryNavigation;
}

export interface EntryListProps {
  readonly directory: DirectoryData;
  readonly parentHref: string | null;
  readonly rows: string;
  readonly sorting: boolean;
}

export interface EntryRowProps extends EntryListItem {
  readonly icon: string;
}

export interface EmptyStateProps {
  readonly message: string;
}

export interface FooterProps {
  readonly keyboardNavigation: boolean;
  readonly parentHref: string | null;
  readonly project: Readonly<{
    author: string;
    license: string;
    licenseUrl: string;
    name: string;
    repositoryUrl: string;
  }>;
}

export type IconName = "chevron-right" | "file" | "folder" | "link" | "moon" | "search" | "sun";

export interface IconProps {
  readonly label?: string;
  readonly name: IconName;
  readonly size?: number;
}

export interface DirwellThemeComponents {
  readonly PageShell: ThemeComponent<PageShellProps>;
  readonly Breadcrumbs: ThemeComponent<BreadcrumbsProps>;
  readonly Toolbar: ThemeComponent<ToolbarProps>;
  readonly EntryList: ThemeComponent<EntryListProps>;
  readonly EntryRow: ThemeComponent<EntryRowProps>;
  readonly EmptyState: ThemeComponent<EmptyStateProps>;
  readonly Footer: ThemeComponent<FooterProps>;
  readonly Icon: ThemeComponent<IconProps>;
}

export type DirwellThemeComponentOverrides = Partial<DirwellThemeComponents>;

export function resolveThemeComponents(
  defaults: DirwellThemeComponents,
  ...layers: readonly DirwellThemeComponentOverrides[]
): DirwellThemeComponents {
  return Object.assign({}, defaults, ...layers);
}
