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

export function entryType(entry) {
  const link = entry.dataset?.link === "true" || entry.link === true || entry.isLink === true;
  const kind = entry.dataset?.kind ?? entry.kind;
  return link ? "link" : kind === "directory" ? "directory" : "file";
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

function createGlobalEntry(record, indexUrl, order, icons, local = false) {
  const directory = record.kind === "directory" || record.targetKind === "directory";
  const isLink = record.isLink ?? record.kind === "symlink";
  const label = local ? record.name : record.path;
  const entry = document.createElement("li");
  entry.className = "entry";
  entry.dataset.entry = "";
  entry.dataset.order = String(order);
  entry.dataset.search =
    `${record.name} ${local ? "" : record.path} ${record.target ?? ""}`.toLocaleLowerCase();
  entry.dataset.name = record.name;
  entry.dataset.size = String(directory ? 0 : record.size);
  entry.dataset.modified = String(Date.parse(record.modifiedAt));
  entry.dataset.directory = String(directory);
  entry.dataset.link = String(isLink);
  entry.dataset.kind = directory
    ? "directory"
    : isLink && record.targetKind === null
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
  const entryName = document.createElement("span");
  entryName.className = "entry-name";
  const extension = record.name.slice(record.name.lastIndexOf(".") + 1).toLowerCase();
  const iconName = directory ? "default_folder" : (icons.byExtension[extension] ?? "default_file");
  const icon = document.createElement("img");
  icon.className = "icon file-icon";
  icon.width = 20;
  icon.height = 20;
  icon.alt = "";
  icon.loading = "lazy";
  icon.src = new URL(icons.hrefs[iconName], document.baseURI).href;
  const labelNode = document.createElement("span");
  labelNode.textContent = `${label}${directory ? "/" : ""}`;
  entryName.append(icon, labelNode);
  name.append(entryName);
  identity.append(name);
  if (record.target !== null) {
    const target = document.createElement("span");
    target.className = "target";
    target.textContent = `Target: ${record.target}`;
    identity.append(target);
  }
  const kind = document.createElement("span");
  kind.className = "kind";
  if (isLink) {
    const badge = document.createElement("span");
    badge.className = `badge${record.isCycle || record.isBroken ? " warning" : ""}`;
    badge.textContent = record.isCycle
      ? "cycle"
      : record.isBroken
        ? "broken link"
        : record.isOutsideRoot
          ? "external link"
          : "link";
    kind.append(badge);
  }
  kind.append(formatSize(record.size, directory));
  const modified = document.createElement("time");
  modified.dateTime = record.modifiedAt;
  modified.textContent = `${record.modifiedAt.slice(0, 16).replace("T", " ")} UTC`;
  entry.append(identity, kind, modified);
  return entry;
}

export class HeightTree {
  constructor(length, estimate = 64) {
    this.length = length;
    this.estimate = estimate;
    this.values = new Float64Array(length);
    this.tree = new Float64Array(length + 1);
  }

  update(index, height) {
    const previous = this.values[index] || this.estimate;
    const delta = height - previous;
    if (Math.abs(delta) < 0.5) return 0;
    this.values[index] = height;
    for (let cursor = index + 1; cursor <= this.length; cursor += cursor & -cursor) {
      this.tree[cursor] += delta;
    }
    return delta;
  }

  prefix(count) {
    let delta = 0;
    for (let cursor = count; cursor > 0; cursor -= cursor & -cursor) delta += this.tree[cursor];
    return count * this.estimate + delta;
  }

  indexAt(offset) {
    let low = 0;
    let high = this.length;
    while (low < high) {
      const middle = Math.floor((low + high + 1) / 2);
      if (this.prefix(middle) <= offset) low = middle;
      else high = middle - 1;
    }
    return Math.min(low, Math.max(0, this.length - 1));
  }
}

function createVirtualList(list, icons) {
  let parent = list.querySelector("[data-parent]");
  let records = [];
  let heights = new HeightTree(0);
  let range = [-1, -1];
  let frame = 0;
  let activeIndex = -1;
  let top = null;
  let bottom = null;
  const spacer = (height) => {
    const node = document.createElement("li");
    node.className = "virtual-spacer";
    node.setAttribute("aria-hidden", "true");
    node.style.height = `${height}px`;
    return node;
  };
  const observer = new ResizeObserver((entries) => {
    const listTop = list.getBoundingClientRect().top + scrollY + (parent?.offsetHeight ?? 0);
    const anchor = heights.indexAt(Math.max(0, scrollY - listTop));
    let shift = 0;
    for (const entry of entries) {
      const index = Number(entry.target.dataset.virtualIndex);
      const delta = heights.update(
        index,
        entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height,
      );
      if (index < anchor) shift += delta;
    }
    if (shift !== 0) window.scrollBy(0, shift);
    schedule();
  });

  function render() {
    frame = 0;
    if (records.length === 0) {
      parent = parent?.cloneNode(true) ?? null;
      list.replaceChildren(...(parent ? [parent] : []));
      range = [-1, -1];
      return;
    }
    const listTop = list.getBoundingClientRect().top + scrollY + (parent?.offsetHeight ?? 0);
    const start = Math.max(0, heights.indexAt(Math.max(0, scrollY - listTop)) - 8);
    const end = Math.min(
      records.length,
      heights.indexAt(Math.max(0, scrollY + innerHeight - listTop)) + 9,
    );
    if (range[0] !== start || range[1] !== end) {
      const focusedIndex = Number(
        document.activeElement?.closest("[data-virtual-index]")?.dataset.virtualIndex,
      );
      observer.disconnect();
      const fragment = document.createDocumentFragment();
      const nextParent = parent?.cloneNode(true) ?? null;
      const nextTop = spacer(heights.prefix(start));
      const nextBottom = spacer(heights.prefix(records.length) - heights.prefix(end));
      if (nextParent) fragment.append(nextParent);
      fragment.append(nextTop);
      for (let index = start; index < end; index += 1) {
        const row = createGlobalEntry(records[index], document.baseURI, index, icons, true);
        row.dataset.virtualIndex = String(index);
        row.setAttribute("aria-posinset", String(index + 1));
        row.setAttribute("aria-setsize", String(records.length));
        if (index === activeIndex) row.dataset.active = "true";
        fragment.append(row);
      }
      fragment.append(nextBottom);
      list.replaceChildren(fragment);
      parent = nextParent;
      top = nextTop;
      bottom = nextBottom;
      if (Number.isInteger(focusedIndex) && focusedIndex >= start && focusedIndex < end) {
        list
          .querySelector(`[data-virtual-index="${focusedIndex}"] a`)
          ?.focus({ preventScroll: true });
      }
      for (const row of list.querySelectorAll("[data-virtual-index]")) observer.observe(row);
      range = [start, end];
    }
    top.style.height = `${heights.prefix(start)}px`;
    bottom.style.height = `${heights.prefix(records.length) - heights.prefix(end)}px`;
  }

  function schedule() {
    if (frame === 0) frame = requestAnimationFrame(render);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", () => {
    const listTop = list.getBoundingClientRect().top + scrollY + (parent?.offsetHeight ?? 0);
    const anchor = heights.indexAt(Math.max(0, scrollY - listTop));
    const offset = scrollY - listTop - heights.prefix(anchor);
    heights = new HeightTree(records.length);
    range = [-1, -1];
    render();
    window.scrollTo(0, listTop + heights.prefix(anchor) + offset);
    schedule();
  });

  return {
    setRecords(next) {
      const focusedIndex = Number(
        document.activeElement?.closest("[data-virtual-index]")?.dataset.virtualIndex,
      );
      const focusedRecord = Number.isInteger(focusedIndex) ? records[focusedIndex] : undefined;
      if (focusedRecord) document.activeElement.blur();
      records = next;
      heights = new HeightTree(next.length);
      range = [-1, -1];
      activeIndex = focusedRecord ? next.indexOf(focusedRecord) : -1;
      render();
      if (activeIndex >= 0) this.focus(activeIndex);
    },
    focus(index, direction = 1) {
      if (records.length === 0) return;
      let next = Math.max(0, Math.min(index, records.length - 1));
      while (next >= 0 && next < records.length && records[next].href === null) {
        next += direction;
      }
      if (next < 0 || next >= records.length) return;
      activeIndex = next;
      const listTop = list.getBoundingClientRect().top + scrollY + (parent?.offsetHeight ?? 0);
      const stickyInset =
        Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      window.scrollTo(0, listTop + heights.prefix(activeIndex) - stickyInset);
      render();
      const link = list.querySelector(`[data-virtual-index="${activeIndex}"] a`);
      for (const row of list.querySelectorAll("[data-virtual-index]")) {
        if (Number(row.dataset.virtualIndex) === activeIndex) row.dataset.active = "true";
        else delete row.dataset.active;
      }
      link?.focus({ preventScroll: true });
    },
    get activeIndex() {
      return activeIndex;
    },
    get length() {
      return records.length;
    },
  };
}

function initializeExplorer(root) {
  const config = JSON.parse(root.dataset.config ?? "{}");
  const stickyHeader = root.querySelector("header");
  const stickyColumns = root.querySelector(".entry-head");
  if (stickyHeader) {
    const updateStickyHeights = () => {
      const headerHeight = stickyHeader.getBoundingClientRect().height;
      const headerTooTall = headerHeight > Math.min(innerHeight * 0.25, 192);
      root.toggleAttribute("data-sticky-header-disabled", headerTooTall);
      document.documentElement.style.setProperty(
        "--dw-sticky-header-height",
        `${headerTooTall ? 0 : headerHeight}px`,
      );
      if (stickyColumns) {
        document.documentElement.style.setProperty(
          "--dw-sticky-columns-height",
          `${stickyColumns.getBoundingClientRect().height}px`,
        );
      }
    };
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateStickyHeights);
      observer.observe(stickyHeader);
      if (stickyColumns) observer.observe(stickyColumns);
    }
    window.addEventListener("resize", updateStickyHeights, { passive: true });
    updateStickyHeights();
  }
  const list = root.querySelector("[data-entry-list]");
  const localEntries = [...root.querySelectorAll("[data-entry]")];
  const input = root.querySelector("[data-search-input]");
  const globalDialog = document.querySelector("[data-global-dialog]");
  const globalInput = globalDialog?.querySelector("[data-global-input]");
  const globalTypeFilters = globalDialog?.querySelector("[data-type-filters]");
  const globalResults = globalDialog?.querySelector("[data-global-results]");
  const globalStatus = globalDialog?.querySelector("[data-global-status]");
  const typeFilters = root.querySelector("[data-type-filters]");
  const count = root.querySelector("[data-visible-count]");
  const countLabel = root.querySelector("[data-count-label]");
  const empty = root.querySelector("[data-empty]");
  const status = root.querySelector("[data-live-status]");
  const folderLoading = root.querySelector("[data-folder-loading]");
  const sortField = root.querySelector("[data-sort-field]");
  const nameMode = root.querySelector("[data-name-mode]");
  const sortDirection = root.querySelector("[data-sort-direction]");
  const directoriesFirst = root.querySelector("[data-directories-first]");
  const nameModeControl = root.querySelector("[data-name-mode-control]");
  let virtualRows = null;
  let virtualList = null;
  let virtualWorker = null;
  let virtualGeneration = 0;
  let virtualTimer = 0;
  let visibleVirtualRows = [];
  let manifestPromise = null;
  const shardCache = new Map();
  let globalGeneration = 0;
  let composing = false;
  const selectedTypes = (control) =>
    new Set(
      [...control.querySelectorAll("[data-type-filter]:checked")].map((input) => input.value),
    );
  let localTypes = typeFilters
    ? selectedTypes(typeFilters)
    : new Set(["directory", "file", "link"]);
  let globalTypes = globalTypeFilters
    ? selectedTypes(globalTypeFilters)
    : new Set(["directory", "file", "link"]);

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

  const matchesFilter = (entry) => localTypes.has(entryType(entry));

  const updateEmpty = (visible) => {
    if (empty) {
      empty.hidden = visible !== 0;
      empty.textContent =
        localTypes.size === 0 ? "Select a file type to show entries." : "No matching entries.";
    }
  };

  const visibleLinks = () =>
    localEntries
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
    if ((!config.fuzzySearch && !config.sorting && !config.entriesHref) || composing) return;
    if (config.entriesHref && virtualRows === null) return;
    const query = input?.value ?? "";
    if (virtualRows !== null) {
      if (virtualWorker) {
        const generation = ++virtualGeneration;
        clearTimeout(virtualTimer);
        root.setAttribute("aria-busy", "true");
        virtualTimer = setTimeout(
          () =>
            virtualWorker?.postMessage({
              type: "query",
              generation,
              query: query.trim(),
              types: [...localTypes],
              sort,
            }),
          70,
        );
        return;
      }
      const matches = [];
      for (let order = 0; order < virtualRows.length; order += 1) {
        const row = virtualRows[order];
        if (!matchesFilter(row)) continue;
        const score = fuzzyScore(query, row.search);
        if (query.trim() !== "" && score === null) continue;
        matches.push({ row, order, score });
      }
      visibleVirtualRows = matches
        .sort((left, right) => {
          if (query.trim() !== "" && left.score !== right.score)
            return (right.score ?? 0) - (left.score ?? 0);
          return compareEntryValues(left.row, right.row, sort) || left.order - right.order;
        })
        .map(({ row }) => row);
      virtualList.setRecords(visibleVirtualRows);
      const visible = visibleVirtualRows.length;
      if (count) count.textContent = String(visible);
      if (countLabel) countLabel.textContent = visible === 1 ? "entry" : "entries";
      updateEmpty(visible);
      if (status) status.textContent = `${visible} ${visible === 1 ? "entry" : "entries"} shown`;
      folderLoading?.remove();
      root.removeAttribute("aria-busy");
      return;
    }
    const matches = localEntries
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
    for (const entry of localEntries) entry.hidden = !matched.has(entry);
    for (const { entry } of matches) list?.append(entry);
    const visible = matches.length;
    if (count) count.textContent = String(visible);
    if (countLabel) countLabel.textContent = visible === 1 ? "entry" : "entries";
    updateEmpty(visible);
    if (status) status.textContent = `${visible} ${visible === 1 ? "entry" : "entries"} shown`;
  };

  const readJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Search index returned ${response.status}`);
    return response.json();
  };
  const indexUrl = new URL(config.searchIndexHref, document.baseURI);
  const loadManifest = async () => {
    if (manifestPromise === null) {
      manifestPromise = readJson(indexUrl)
        .then((manifest) => {
          if (
            manifest?.version !== 2 ||
            !Array.isArray(manifest.shards) ||
            !manifest.shards.every((name) => /^search-\d{5}\.json$/.test(name))
          ) {
            throw new Error("Search index has an unsupported format");
          }
          return manifest;
        })
        .catch((error) => {
          manifestPromise = null;
          throw error;
        });
    }
    return manifestPromise;
  };
  const loadShard = async (name) => {
    if (!shardCache.has(name)) {
      const url = new URL(name, indexUrl);
      shardCache.set(
        name,
        readJson(url)
          .then((data) => {
            if (!Array.isArray(data?.entries))
              throw new Error("Search shard has an unsupported format");
            return data.entries.filter(isSearchRecord);
          })
          .catch((error) => {
            shardCache.delete(name);
            throw error;
          }),
      );
    }
    return shardCache.get(name);
  };
  const matchesGlobalFilter = (record) => globalTypes.has(entryType(record));
  let globalTimer = 0;
  const searchGlobal = async () => {
    const generation = ++globalGeneration;
    const query = globalInput?.value.trim() ?? "";
    if (query === "") {
      globalResults?.replaceChildren();
      if (globalStatus) globalStatus.textContent = "Enter a search to begin.";
      return;
    }
    if (globalTypes.size === 0) {
      globalResults?.replaceChildren();
      if (globalStatus) globalStatus.textContent = "Select a file type to search.";
      return;
    }
    if (globalStatus) globalStatus.textContent = "Searching published files…";
    const best = [];
    let found = 0;
    try {
      const manifest = await loadManifest();
      for (let offset = 0; offset < manifest.shards.length; offset += 4) {
        const batch = await Promise.all(manifest.shards.slice(offset, offset + 4).map(loadShard));
        if (generation !== globalGeneration || !globalDialog?.open) return;
        for (const entries of batch) {
          for (const record of entries) {
            if (!matchesGlobalFilter(record)) continue;
            const score = fuzzyScore(query, `${record.name} ${record.path} ${record.target ?? ""}`);
            if (score === null) continue;
            found += 1;
            best.push({ record, score });
          }
        }
        best.sort(
          (left, right) =>
            right.score - left.score || left.record.path.localeCompare(right.record.path),
        );
        best.length = Math.min(best.length, 100);
        globalResults?.replaceChildren(
          ...best.map(({ record }, index) =>
            createGlobalEntry(record, indexUrl, index, config.icons),
          ),
        );
        if (globalStatus)
          globalStatus.textContent = `${found} matches · ${Math.min(offset + 4, manifest.shards.length)} of ${manifest.shards.length} index parts searched${found > 100 ? " · showing best 100" : ""}`;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (found === 0 && globalStatus)
        globalStatus.textContent = "No matches. Try a shorter name or path.";
    } catch (error) {
      if (generation !== globalGeneration) return;
      if (globalStatus)
        globalStatus.textContent = `${error instanceof Error ? error.message : "Search failed"}. Try again.`;
    }
  };
  root.querySelector("[data-global-open]")?.addEventListener("click", () => {
    globalDialog?.showModal();
    globalInput?.focus();
  });
  globalDialog
    ?.querySelector("[data-global-close]")
    ?.addEventListener("click", () => globalDialog.close());
  globalDialog?.addEventListener("close", () => {
    globalGeneration += 1;
  });
  globalInput?.addEventListener("compositionstart", () => {
    globalInput.dataset.composing = "true";
  });
  globalInput?.addEventListener("compositionend", () => {
    delete globalInput.dataset.composing;
    searchGlobal();
  });
  globalInput?.addEventListener("input", () => {
    if (globalInput.dataset.composing) return;
    clearTimeout(globalTimer);
    globalTimer = setTimeout(searchGlobal, 120);
  });
  globalTypeFilters?.addEventListener("change", () => {
    globalTypes = selectedTypes(globalTypeFilters);
    searchGlobal();
  });

  const updateFilter = () => {
    localTypes = selectedTypes(typeFilters);
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
    typeFilters?.addEventListener("change", updateFilter);
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

  if (config.entriesHref && list) {
    root.setAttribute("aria-busy", "true");
    if (status) status.textContent = "Loading this folder";
    readJson(new URL(config.entriesHref, document.baseURI))
      .then((data) => {
        if (data?.version !== 1 || !Array.isArray(data.rows))
          throw new Error("Folder data has an unsupported format");
        virtualRows = data.rows.map((row) => ({
          ...row,
          directory: row.kind === "directory" || row.targetKind === "directory",
          link: row.kind === "symlink",
          isLink: row.kind === "symlink",
          size: row.kind === "directory" || row.targetKind === "directory" ? 0 : row.size,
          kind:
            row.kind === "directory" || row.targetKind === "directory"
              ? "directory"
              : row.kind === "symlink" && row.targetKind === null
                ? "link"
                : "file",
          search: `${row.name} ${row.target ?? ""}`.toLocaleLowerCase(),
          modified: Date.parse(row.modifiedAt),
        }));
        virtualList = createVirtualList(list, config.icons);
        if (config.workerHref && typeof Worker !== "undefined") {
          try {
            virtualWorker = new Worker(new URL(config.workerHref, document.baseURI), {
              type: "module",
            });
            virtualWorker.addEventListener("message", ({ data: result }) => {
              if (result.generation !== virtualGeneration) return;
              visibleVirtualRows = Array.from(result.indices, (index) => virtualRows[index]);
              virtualList.setRecords(visibleVirtualRows);
              const visible = visibleVirtualRows.length;
              if (count) count.textContent = String(visible);
              if (countLabel) countLabel.textContent = visible === 1 ? "entry" : "entries";
              updateEmpty(visible);
              if (status)
                status.textContent = `${visible} ${visible === 1 ? "entry" : "entries"} shown`;
              folderLoading?.remove();
              root.removeAttribute("aria-busy");
            });
            virtualWorker.addEventListener("error", () => {
              virtualWorker?.terminate();
              virtualWorker = null;
              updateResults();
            });
            virtualWorker.postMessage({
              type: "init",
              rows: virtualRows.map(({ name, search, size, modified, directory, link, kind }) => ({
                name,
                search,
                size,
                modified,
                directory,
                link,
                kind,
              })),
            });
          } catch {
            virtualWorker = null;
          }
        }
        updateResults();
      })
      .catch((error) => {
        folderLoading?.remove();
        if (empty) {
          empty.hidden = false;
          empty.textContent = `${error instanceof Error ? error.message : "Folder data failed"}. Reload to try again.`;
        }
      })
      .finally(() => {
        if (!virtualWorker) root.removeAttribute("aria-busy");
      });
  }

  if (config.colorScheme) {
    const schemeSelect = root.querySelector("[data-color-scheme]");
    const saved = storage.get(localStorage, "dirwell-theme");
    const initial = ["system", "light", "dark"].includes(saved) ? saved : "system";
    const setTheme = (theme) => {
      document.documentElement.dataset.theme = theme;
      storage.set(localStorage, "dirwell-theme", theme);
      if (schemeSelect) schemeSelect.value = theme;
    };
    setTheme(initial);
    schemeSelect?.addEventListener("change", () => setTheme(schemeSelect.value));
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
      if (globalDialog?.open) return;
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
      if (virtualList) {
        let index = null;
        let direction = 1;
        if (event.key === "ArrowDown" || event.key === "j") index = virtualList.activeIndex + 1;
        if (event.key === "ArrowUp" || event.key === "k") {
          index = Math.max(virtualList.activeIndex - 1, 0);
          direction = virtualList.activeIndex === -1 ? 1 : -1;
        }
        if (event.key === "Home") index = 0;
        if (event.key === "End") {
          index = virtualList.length - 1;
          direction = -1;
        }
        if (index !== null) {
          event.preventDefault();
          virtualList.focus(index, direction);
        }
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
        for (const entry of localEntries) {
          if (!entry.contains(next)) entry.removeAttribute("data-active");
        }
      }
    });
  }
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-explorer]")) initializeExplorer(root);
}
