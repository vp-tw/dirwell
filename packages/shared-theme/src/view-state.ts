import type { SortOptions } from "@dirwell/core";

export interface ViewState {
  readonly query: string;
  readonly sort?: Required<SortOptions>;
  readonly types?: readonly string[];
  readonly category?: string | null;
  readonly selected?: string | null;
  readonly windowY?: number;
  readonly listTop?: number;
}
const supportedTypes = ["directory", "file", "link"];
function validSort(value: unknown): value is Required<SortOptions> {
  if (typeof value !== "object" || value === null) return false;
  const sort = value as Record<string, unknown>;
  return (
    ["name", "size", "modified"].includes(String(sort.field)) &&
    ["asc", "desc"].includes(String(sort.direction)) &&
    ["natural", "locale", "unicode"].includes(String(sort.nameMode)) &&
    typeof sort.directoriesFirst === "boolean"
  );
}
function position(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(value, 1e9))
    : 0;
}
/** URL controls are shareable; selection and scroll belong only to one history entry. */
export function readView(
  href: string,
  theme: "ledger" | "crosswave",
  path: string,
  defaults: ViewState,
  categories: readonly string[] = [],
  historyState: unknown = null,
): ViewState {
  const params = new URL(href).searchParams;
  const result: { -readonly [K in keyof ViewState]: ViewState[K] } = {
    ...defaults,
    query: (params.get("dw.q") ?? "").slice(0, 4096),
    selected: null,
    windowY: 0,
    listTop: 0,
  };
  if (theme === "ledger") {
    const parts = params.get("dw.sort")?.split(":");
    if (parts?.length === 4) {
      const sort = {
        field: parts[0],
        direction: parts[1],
        nameMode: parts[2],
        directoriesFirst: parts[3] === "folders",
      };
      if (["folders", "mixed"].includes(parts[3]!) && validSort(sort)) result.sort = sort;
    }
    if (params.has("dw.types")) {
      const types = params.get("dw.types")!.split(",").filter(Boolean);
      if (types.every((type) => supportedTypes.includes(type))) result.types = [...new Set(types)];
    }
  } else {
    const category = params.get("dw.category");
    if (category !== null && categories.includes(category)) result.category = category;
  }
  if (typeof historyState === "object" && historyState !== null && "dirwell" in historyState) {
    const state = historyState.dirwell;
    if (
      typeof state === "object" &&
      state !== null &&
      "version" in state &&
      state.version === 1 &&
      "theme" in state &&
      state.theme === theme &&
      "path" in state &&
      state.path === path &&
      "view" in state &&
      typeof state.view === "object" &&
      state.view !== null
    ) {
      const view = state.view as Record<string, unknown>;
      result.selected =
        typeof view.selected === "string" && view.selected.length <= 4096 ? view.selected : null;
      result.windowY = position(view.windowY);
      result.listTop = position(view.listTop);
    }
  }
  return result;
}
export function viewHref(
  href: string,
  theme: "ledger" | "crosswave",
  view: ViewState,
  defaults: ViewState,
): string {
  const url = new URL(href);
  for (const key of ["dw.q", "dw.sort", "dw.types", "dw.category"]) url.searchParams.delete(key);
  if (view.query) url.searchParams.set("dw.q", view.query.slice(0, 4096));
  if (theme === "ledger") {
    if (
      view.sort &&
      ["field", "direction", "nameMode", "directoriesFirst"].some(
        (key) => view.sort![key as keyof SortOptions] !== defaults.sort?.[key as keyof SortOptions],
      )
    ) {
      const sort = view.sort;
      url.searchParams.set(
        "dw.sort",
        `${sort.field}:${sort.direction}:${sort.nameMode}:${sort.directoriesFirst ? "folders" : "mixed"}`,
      );
    }
    if (
      view.types &&
      supportedTypes.some(
        (type) => view.types!.includes(type) !== (defaults.types ?? supportedTypes).includes(type),
      )
    )
      url.searchParams.set("dw.types", view.types.join(","));
  } else if (view.category && view.category !== defaults.category)
    url.searchParams.set("dw.category", view.category);
  return url.href;
}
/** History failures never require discarding a successfully loaded view. */
export function createViewHistory(theme: "ledger" | "crosswave") {
  let committedHref = location.href;
  let committedState = history.state;
  const stateFor = (dataHref: string, path: string, view?: ViewState) => ({
    ...(typeof history.state === "object" && history.state !== null ? history.state : {}),
    dataHref,
    dirwell: {
      version: 1,
      theme,
      path,
      ...(view === undefined
        ? {}
        : {
            view: {
              query: view.query,
              ...(view.sort === undefined ? {} : { sort: { ...view.sort } }),
              ...(view.types === undefined ? {} : { types: [...view.types] }),
              category: view.category ?? null,
              selected: view.selected ?? null,
              windowY: view.windowY ?? 0,
              listTop: view.listTop ?? 0,
            },
          }),
    },
  });
  return {
    save(dataHref: string, path: string, view: ViewState, defaults: ViewState): void {
      // A popstate load changes location before it has a usable matching model.
      if (location.href !== committedHref) return;
      const href = viewHref(committedHref, theme, view, defaults);
      const state = stateFor(dataHref, path, view);
      try {
        history.replaceState(state, "", href);
        committedHref = href;
        committedState = state;
      } catch {
        /* Native links remain available if the host denies History. */
      }
    },
    commit(dataHref: string, path: string, href: string, push: boolean): void {
      const state = stateFor(dataHref, path);
      if (push) history.pushState(state, "", href);
      else history.replaceState(state, "", href);
      committedHref = href;
      committedState = state;
    },
    rollback(): void {
      if (location.href !== committedHref) {
        try {
          history.replaceState(committedState, "", committedHref);
        } catch {
          /* Host owns the restriction. */
        }
      }
    },
  };
}
