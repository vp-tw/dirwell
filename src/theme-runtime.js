export function fuzzyScore(query, value) {
  const needle = query.trim().toLocaleLowerCase();
  const haystack = value.toLocaleLowerCase();
  if (needle === "") return 0;
  let score = 0;
  let searchFrom = 0;
  let previous = -2;
  for (const character of needle) {
    const index = haystack.indexOf(character, searchFrom);
    if (index === -1) return null;
    if (index === previous + 1) score += 8;
    if (index === 0 || /[\s/_.-]/.test(haystack[index - 1] ?? "")) score += 5;
    score += Math.max(0, 4 - index * 0.05);
    previous = index;
    searchFrom = index + 1;
  }
  return score - haystack.length * 0.01;
}

const localeCollator = new Intl.Collator(undefined, { sensitivity: "base" });
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareName(left, right, mode) {
  if (mode === "unicode") {
    const leftPoints = [...left];
    const rightPoints = [...right];
    const length = Math.min(leftPoints.length, rightPoints.length);
    for (let index = 0; index < length; index += 1) {
      const difference =
        (leftPoints[index]?.codePointAt(0) ?? 0) - (rightPoints[index]?.codePointAt(0) ?? 0);
      if (difference !== 0) return difference;
    }
    return leftPoints.length - rightPoints.length;
  }
  return (mode === "natural" ? naturalCollator : localeCollator).compare(left, right);
}

function isSearchRecord(record) {
  return (
    typeof record === "object" &&
    record !== null &&
    typeof record.name === "string" &&
    typeof record.path === "string" &&
    typeof record.kind === "string" &&
    typeof record.modifiedAt === "string" &&
    typeof record.size === "number" &&
    typeof record.isLink === "boolean" &&
    typeof record.exitsExplorer === "boolean" &&
    (record.href === null || typeof record.href === "string") &&
    (record.target === null || typeof record.target === "string") &&
    (record.targetKind === null || typeof record.targetKind === "string")
  );
}

export function compareEntryValues(left, right, sort) {
  if (sort.directoriesFirst && left.directory !== right.directory) {
    return left.directory ? -1 : 1;
  }
  let result;
  if (sort.field === "modified") result = left.modified - right.modified;
  else if (sort.field === "size") result = left.size - right.size;
  else result = compareName(left.name, right.name, sort.nameMode);
  if (result === 0) result = compareName(left.name, right.name, sort.nameMode);
  return sort.direction === "asc" ? result : -result;
}

function formatSize(bytes, directory) {
  if (directory) return "directory";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 || value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function createGlobalEntry(record, indexUrl, order) {
  const directory = record.kind === "directory" || record.targetKind === "directory";
  const entry = document.createElement("li");
  entry.className = "entry";
  entry.dataset.entry = "";
  entry.dataset.order = String(order);
  entry.dataset.search = `${record.name} ${record.path} ${record.target ?? ""}`.toLocaleLowerCase();
  entry.dataset.name = record.name;
  entry.dataset.size = String(directory ? 0 : record.size);
  entry.dataset.modified = String(Date.parse(record.modifiedAt));
  entry.dataset.directory = String(directory);
  entry.dataset.link = String(record.isLink);
  entry.dataset.kind = directory
    ? "directory"
    : record.isLink && record.targetKind === null
      ? "link"
      : "file";

  const identity = document.createElement("span");
  identity.className = "identity";
  const name = record.href === null ? document.createElement("span") : document.createElement("a");
  name.className = record.href === null ? "name unavailable" : "name";
  if (record.href !== null) {
    name.href = new URL(record.href, indexUrl).href;
    if (record.exitsExplorer) {
      name.target = "_blank";
      name.rel = "noopener";
    }
  }
  name.textContent = `${record.path}${directory ? "/" : ""}`;
  identity.append(name);
  if (record.target !== null) {
    const target = document.createElement("span");
    target.className = "target";
    target.textContent = `Target: ${record.target}`;
    identity.append(target);
  }
  const kind = document.createElement("span");
  kind.className = "kind";
  kind.textContent = formatSize(record.size, directory);
  const modified = document.createElement("time");
  modified.dateTime = record.modifiedAt;
  modified.textContent = `${record.modifiedAt.slice(0, 16).replace("T", " ")} UTC`;
  entry.append(identity, kind, modified);
  return entry;
}

function initializeExplorer(root) {
  const config = JSON.parse(root.dataset.config ?? "{}");
  const list = root.querySelector("[data-entry-list]");
  const localEntries = [...root.querySelectorAll("[data-entry]")];
  const parentEntry = root.querySelector("[data-parent]");
  const input = root.querySelector("[data-search-input]");
  const scope = root.querySelector("[data-search-scope]");
  const filter = root.querySelector("[data-search-filter]");
  const includeLinks = root.querySelector("[data-include-links]");
  const includeLinksControl = root.querySelector("[data-include-links-control]");
  const count = root.querySelector("[data-visible-count]");
  const countLabel = root.querySelector("[data-count-label]");
  const empty = root.querySelector("[data-empty]");
  const status = root.querySelector("[data-live-status]");
  const sortField = root.querySelector("[data-sort-field]");
  const nameMode = root.querySelector("[data-name-mode]");
  const sortDirection = root.querySelector("[data-sort-direction]");
  const directoriesFirst = root.querySelector("[data-directories-first]");
  const nameModeControl = root.querySelector("[data-name-mode-control]");
  let activeEntries = localEntries;
  let globalEntries = null;
  let globalIndexPromise = null;
  let composing = false;
  let searchGeneration = 0;

  const storage = {
    get(area, key) {
      try {
        return area.getItem(key);
      } catch {
        return null;
      }
    },
    set(area, key, value) {
      try {
        area.setItem(key, value);
      } catch {
        // Storage is optional in private or sandboxed browsing contexts.
      }
    },
  };
  const searchStorageKey = `dirwell-search:${location.pathname}`;
  const sortStorageKey = "dirwell-sort";
  const storedSort = storage.get(localStorage, sortStorageKey);
  let sort = { ...config.sort };
  if (storedSort !== null) {
    try {
      const parsed = JSON.parse(storedSort);
      if (["name", "modified", "size"].includes(parsed.field)) sort.field = parsed.field;
      if (["unicode", "locale", "natural"].includes(parsed.nameMode)) {
        sort.nameMode = parsed.nameMode;
      }
      if (["asc", "desc"].includes(parsed.direction)) sort.direction = parsed.direction;
      if (typeof parsed.directoriesFirst === "boolean") {
        sort.directoriesFirst = parsed.directoriesFirst;
      }
    } catch {
      // Ignore stale or invalid preferences.
    }
  }

  const entryValue = (entry) => ({
    directory: entry.dataset.directory === "true",
    modified: Number(entry.dataset.modified),
    name: entry.dataset.name ?? "",
    size: Number(entry.dataset.size),
  });

  const matchesFilter = (entry) => {
    const value = filter?.value ?? "all";
    if (value === "link") return entry.dataset.link === "true";
    if (value === "directory" || value === "file") {
      return (
        entry.dataset.kind === value &&
        (includeLinks?.checked !== false || entry.dataset.link !== "true")
      );
    }
    return true;
  };

  const visibleLinks = () =>
    activeEntries
      .filter((entry) => !entry.hidden)
      .map((entry) => entry.querySelector("a"))
      .filter(Boolean);

  const updateSortControls = () => {
    if (sortField) sortField.value = sort.field;
    if (nameMode) nameMode.value = sort.nameMode;
    if (sortDirection) sortDirection.value = sort.direction;
    if (directoriesFirst) directoriesFirst.checked = sort.directoriesFirst;
    if (nameModeControl) nameModeControl.hidden = sort.field !== "name";
    for (const heading of root.querySelectorAll("[data-sort-heading]")) {
      heading.setAttribute("aria-pressed", String(heading.dataset.sortHeading === sort.field));
    }
  };

  const updateResults = () => {
    if ((!config.fuzzySearch && !config.sorting) || composing) return;
    const query = input?.value ?? "";
    const matches = activeEntries
      .map((entry) => ({
        entry,
        order: Number(entry.dataset.order),
        score: fuzzyScore(query, entry.dataset.search ?? ""),
      }))
      .filter(({ entry, score }) => matchesFilter(entry) && (query.trim() === "" || score !== null))
      .sort((left, right) => {
        if (query.trim() !== "" && left.score !== right.score) {
          return (right.score ?? 0) - (left.score ?? 0);
        }
        return (
          compareEntryValues(entryValue(left.entry), entryValue(right.entry), sort) ||
          left.order - right.order
        );
      });
    const matched = new Set(matches.map(({ entry }) => entry));
    for (const entry of activeEntries) entry.hidden = !matched.has(entry);
    for (const { entry } of matches) list?.append(entry);
    const visible = matches.length;
    if (count) count.textContent = String(visible);
    if (countLabel) countLabel.textContent = visible === 1 ? "entry" : "entries";
    if (empty) empty.hidden = visible !== 0;
    if (status) status.textContent = `${visible} ${visible === 1 ? "entry" : "entries"} shown`;
  };

  const loadGlobalEntries = async () => {
    if (globalEntries !== null) return globalEntries;
    if (globalIndexPromise === null) {
      root.setAttribute("aria-busy", "true");
      if (status) status.textContent = "Loading search index";
      const indexUrl = new URL(config.searchIndexHref, document.baseURI);
      globalIndexPromise = fetch(indexUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`Search index returned ${response.status}`);
          return response.json();
        })
        .then((document) => {
          if (document?.version !== 1 || !Array.isArray(document.entries)) {
            throw new Error("Search index has an unsupported format");
          }
          globalEntries = document.entries
            .filter(isSearchRecord)
            .map((record, index) => createGlobalEntry(record, indexUrl, index));
          return globalEntries;
        })
        .catch((error) => {
          globalIndexPromise = null;
          throw error;
        })
        .finally(() => root.removeAttribute("aria-busy"));
    }
    return globalIndexPromise;
  };

  const updateScope = async () => {
    const generation = ++searchGeneration;
    if (scope?.value !== "global") {
      activeEntries = localEntries;
      list?.replaceChildren(...(parentEntry === null ? [] : [parentEntry]), ...localEntries);
      updateResults();
      return;
    }
    try {
      const loadedEntries = await loadGlobalEntries();
      if (generation !== searchGeneration) return;
      activeEntries = loadedEntries;
      list?.replaceChildren(...activeEntries);
      if (empty) empty.textContent = "No matching entries.";
      updateResults();
    } catch (error) {
      if (generation !== searchGeneration) return;
      if (status)
        status.textContent = error instanceof Error ? error.message : "Search index failed";
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Global search is unavailable. Try this folder instead.";
      }
    }
  };

  const updateFilter = () => {
    if (includeLinksControl) {
      includeLinksControl.hidden = filter?.value !== "directory" && filter?.value !== "file";
    }
    updateResults();
  };

  if (config.fuzzySearch && input) {
    input.value = storage.get(sessionStorage, searchStorageKey) ?? "";
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      storage.set(sessionStorage, searchStorageKey, input.value);
      updateResults();
    });
    input.addEventListener("input", () => {
      if (!composing) storage.set(sessionStorage, searchStorageKey, input.value);
      updateResults();
    });
    scope?.addEventListener("change", updateScope);
    filter?.addEventListener("change", updateFilter);
    includeLinks?.addEventListener("change", updateResults);
  }

  if (config.sorting) {
    const setSort = (patch) => {
      sort = { ...sort, ...patch };
      storage.set(localStorage, sortStorageKey, JSON.stringify(sort));
      updateSortControls();
      updateResults();
    };
    sortField?.addEventListener("change", () => setSort({ field: sortField.value }));
    nameMode?.addEventListener("change", () => setSort({ nameMode: nameMode.value }));
    sortDirection?.addEventListener("change", () => setSort({ direction: sortDirection.value }));
    directoriesFirst?.addEventListener("change", () =>
      setSort({ directoriesFirst: directoriesFirst.checked }),
    );
    for (const heading of root.querySelectorAll("[data-sort-heading]")) {
      heading.addEventListener("click", () => {
        const field = heading.dataset.sortHeading;
        setSort({
          direction: sort.field === field && sort.direction === "asc" ? "desc" : "asc",
          field,
        });
      });
    }
    updateSortControls();
  }

  updateResults();

  if (config.colorScheme) {
    const saved = storage.get(localStorage, "dirwell-theme");
    const initial = ["system", "light", "dark"].includes(saved) ? saved : "system";
    const setTheme = (theme) => {
      document.documentElement.dataset.theme = theme;
      storage.set(localStorage, "dirwell-theme", theme);
      for (const button of root.querySelectorAll("[data-theme-value]")) {
        button.setAttribute("aria-pressed", String(button.dataset.themeValue === theme));
      }
    };
    setTheme(initial);
    root.querySelector("[data-scheme-control]")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-theme-value]");
      if (button) setTheme(button.dataset.themeValue);
    });
  }

  if (config.keyboardNavigation) {
    document.addEventListener("keydown", (event) => {
      if (
        event.isComposing ||
        event.keyCode === 229 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const editable = event.target.matches("input,textarea,select,[contenteditable='true']");
      if (event.key === "/" && !editable && input) {
        event.preventDefault();
        input.focus();
        return;
      }
      if (
        event.key === "Escape" &&
        input &&
        (event.target === input || (!editable && input.value !== ""))
      ) {
        event.preventDefault();
        input.value = "";
        storage.set(sessionStorage, searchStorageKey, "");
        updateResults();
        input.blur();
        return;
      }
      if (editable) return;
      if (event.key === "Backspace") {
        event.preventDefault();
        if (root.dataset.parentHref) location.assign(root.dataset.parentHref);
        return;
      }
      const links = visibleLinks();
      if (links.length === 0) return;
      const current = links.indexOf(document.activeElement);
      let next = null;
      if (event.key === "ArrowDown" || event.key === "j") {
        next = links[Math.min(current + 1, links.length - 1)];
      }
      if (event.key === "ArrowUp" || event.key === "k") {
        next = links[Math.max(current - 1, 0)];
      }
      if (event.key === "Home") next = links[0];
      if (event.key === "End") next = links.at(-1);
      if (next) {
        event.preventDefault();
        next.focus();
        next.closest("[data-entry]")?.setAttribute("data-active", "true");
        for (const entry of activeEntries) {
          if (!entry.contains(next)) entry.removeAttribute("data-active");
        }
      }
    });
  }
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-explorer]")) initializeExplorer(root);
}
