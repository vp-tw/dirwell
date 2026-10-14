<script>
  import { onMount, tick, untrack } from "svelte";
  import { queryLiveArchive } from "../../shared-theme/src/live-search.ts";
  import {
    readView,
    createViewHistory,
  } from "../../shared-theme/src/view-state.ts";
  import { entryIcon } from "../../shared-theme/src/icons.ts";
  import { loadListing } from "@dirwell/core/client";
  import {
    fetchThemePage,
    applyThemeMetadata,
    restoreThemePage,
  } from "../../shared-theme/src/navigation.ts";
  import {
    visibleRecords,
    directoryLike,
    entryType,
    size,
    fuzzy,
  } from "../../shared-theme/src/records.ts";
  import {
    resolveCustomization,
    label,
    formattedDate,
    copyEntryAction,
    columnLabel,
    publicDataValue,
  } from "../../shared-theme/src/customization.ts";
  let { model: initialModel, header, row, actions, footer } = $props();
  const snapshot = untrack(() =>
    restoreThemePage(initialModel, Boolean(import.meta.hot)),
  );
  let model = $state.raw(snapshot),
    entries = $state.raw(snapshot.entries),
    query = $state(""),
    types = $state(["directory", "file", "link"]),
    sort = $state.raw(snapshot.sort),
    scheme = $state("system"),
    selected = $state(null),
    ready = $state(false),
    busy = $state(false),
    error = $state(""),
    failure = $state(null),
    timestamp = $state(null),
    composing = $state(false),
    scrollTop = $state(0),
    viewportHeight = $state(800),
    globalOpen = $state(false),
    globalQuery = $state(""),
    globalRows = $state.raw([]),
    globalStatus = $state(
      resolveCustomization(snapshot.ui).labels.beginArchive,
    ),
    pendingUpdates = $state(null);
  let ui = $derived(resolveCustomization(model.ui));
  let archiveFailed = $state(false);
  let countParts = $derived(
    label(ui, complete ? "entries" : "pageEntries", {
      count: "__COUNT__",
      total: model.total,
    }).split("__COUNT__"),
  );
  let heights = $state.raw(new Map());
  let updatesHref = $derived(
    ready && model.updatesHref
      ? new URL(model.updatesHref, document.baseURI).href
      : null,
  );
  let complete = $derived(entries.length === model.total),
    rows = $derived(
      visibleRecords(entries, composing ? "" : query, types, sort),
    ),
    virtual = $derived(ready && rows.length > 500);
  let offsets = $derived.by(() => {
    const values = [0];
    for (const entry of rows)
      values.push(values.at(-1) + (heights.get(entry.id) ?? 76));
    return values;
  });
  let start = $derived.by(() => {
      if (!virtual) return 0;
      let low = 0,
        high = rows.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (offsets[mid + 1] <= scrollTop) low = mid + 1;
        else high = mid;
      }
      return Math.max(0, low - 5);
    }),
    end = $derived.by(() => {
      if (!virtual) return rows.length;
      let low = 0,
        high = rows.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (offsets[middle + 1] <= scrollTop + viewportHeight) low = middle + 1;
        else high = middle;
      }
      return Math.min(rows.length, Math.max(start + 35, low + 5));
    });
  function measure(node, id) {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const value = node.getBoundingClientRect().height;
      if (value > 0 && heights.get(id) !== value) {
        const next = new Map(heights);
        next.set(id, value);
        heights = next;
      }
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }
  let list = $state(),
    searchInput = $state(),
    globalInput = $state(),
    timeDialog = $state(),
    globalDialog = $state();
  let navigation = 0,
    abort,
    archiveAbort,
    archiveRequest = 0,
    archiveCache = null,
    archiveCacheHref = "",
    archiveCacheAt = 0,
    viewHistory,
    retryRequest = null;
  const viewDefaults = (page) => ({
    query: "",
    sort: page.sort,
    types: ["directory", "file", "link"],
  });
  function saveView() {
    if (!viewHistory) return;
    viewHistory.save(
      new URL(model.dataHref, document.baseURI).href,
      model.path,
      {
        query,
        types,
        sort,
        selected,
        windowY: window.scrollY,
        listTop: scrollTop,
      },
      viewDefaults(model),
    );
  }
  function retry() {
    if (failure === "folder" && retryRequest) openFolder(...retryRequest, true);
    else openFolder(model.dataHref, location.href, false, true);
  }
  $effect(() => {
    if (!ready || busy) return;
    const view = { query, types, sort, selected, listTop: scrollTop };
    const dataHref = model.dataHref,
      path = model.path,
      defaults = viewDefaults(model);
    const frame = requestAnimationFrame(() =>
      viewHistory?.save(
        new URL(dataHref, document.baseURI).href,
        path,
        { ...view, windowY: window.scrollY },
        defaults,
      ),
    );
    return () => cancelAnimationFrame(frame);
  });
  const isDirectory = directoryLike;
  function safeHref(record) {
    if (
      typeof location !== "undefined" &&
      location.protocol === "file:" &&
      isDirectory(record) &&
      !record.exitsExplorer &&
      record.href?.endsWith("/")
    )
      return record.href + "index.html";
    return record.href;
  }
  async function hydrateData() {
    if (complete || !model.manifestHref || location.protocol === "file:")
      return;
    const local = abort,
      token = navigation;
    busy = true;
    try {
      const loaded = await loadListing(
        new URL(model.manifestHref, document.baseURI).href,
        {
          signal: local.signal,
          cache: model.updatesHref ? "no-store" : "default",
        },
      );
      if (token === navigation && !local.signal.aborted)
        entries = loaded.entries;
    } catch (cause) {
      if (token === navigation && !local.signal.aborted) {
        error = ui.labels.listingError;
        failure = "listing";
      }
    } finally {
      if (token === navigation) busy = false;
    }
  }
  async function navigate(event, record) {
    saveView();
    const dataHref = record.presentation?.folderDataHref;
    if (
      record.exitsExplorer ||
      event?.altKey ||
      event?.ctrlKey ||
      event?.metaKey ||
      event?.shiftKey ||
      event?.button > 0 ||
      typeof dataHref !== "string" ||
      location.protocol === "file:"
    )
      return;
    event?.preventDefault();
    await openFolder(
      dataHref,
      new URL(record.href, document.baseURI).href,
      true,
    );
  }
  async function openFolder(
    dataHref,
    url,
    push,
    refresh = false,
    restoreState = null,
    fresh = false,
  ) {
    if (push) saveView();
    const token = ++navigation;
    abort?.abort();
    const local = (abort = new AbortController());
    busy = true;
    error = "";
    failure = null;
    try {
      const next = await fetchThemePage(
        dataHref,
        url,
        "ledger",
        local.signal,
        refresh || fresh,
      );
      let nextEntries = next.entries;
      if (refresh && next.manifestHref && nextEntries.length !== next.total) {
        nextEntries = (
          await loadListing(next.manifestHref, {
            signal: local.signal,
            cache: "no-store",
          })
        ).entries;
      }
      if (token !== navigation || local.signal.aborted) return;
      if (!refresh) viewHistory.commit(next.dataHref, next.path, url, push);
      model = next;
      entries = nextEntries;
      retryRequest = null;
      if (!refresh) {
        const view = readView(
          url,
          "ledger",
          next.path,
          viewDefaults(next),
          [],
          restoreState,
        );
        query = view.query;
        types = view.types;
        sort = view.sort;
        selected = view.selected;
        scrollTop = view.listTop;
      }
      applyThemeMetadata(next, url);
      await hydrateData();
      if (!refresh) {
        const view = readView(
          url,
          "ledger",
          next.path,
          viewDefaults(next),
          [],
          restoreState,
        );
        await tick();
        if (selected && !rows.some((entry) => entry.id === selected))
          selected = null;
        window.scrollTo({ top: view.windowY });
        if (restoreState && selected)
          list
            ?.querySelector(`[data-id="${CSS.escape(selected)}"] a`)
            ?.focus({ preventScroll: true });
      }
    } catch (cause) {
      if (token === navigation && !local.signal.aborted) {
        error = ui.labels.folderError;
        failure = "folder";
        retryRequest = [dataHref, url, push, refresh, restoreState];
        viewHistory?.rollback();
      }
    } finally {
      if (token === navigation) busy = false;
    }
  }
  function navigateLink(event, href, dataHref) {
    if (
      typeof href !== "string" ||
      typeof dataHref !== "string" ||
      event?.altKey ||
      event?.ctrlKey ||
      event?.metaKey ||
      event?.shiftKey ||
      event?.button > 0 ||
      location.protocol === "file:"
    )
      return;
    event?.preventDefault();
    openFolder(dataHref, new URL(href, document.baseURI).href, true);
  }
  async function move(index) {
    const target = Math.max(0, Math.min(rows.length - 1, index));
    const row = rows[target];
    if (!row) return;
    selected = row.id;
    if (virtual) {
      scrollTop = Math.max(0, offsets[target] - 100);
      if (list)
        window.scrollTo({
          top: list.getBoundingClientRect().top + window.scrollY + scrollTop,
        });
    }
    await tick();
    list
      ?.querySelector(`[data-order="${index}"] a`)
      ?.focus({ preventScroll: true });
  }
  function keyboard(event) {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey)
      return;
    if (globalOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeArchive();
      }
      return;
    }
    if (timestamp) {
      if (event.key === "Escape") timestamp = null;
      return;
    }
    if (event.target?.closest?.("[data-dirwell-actions]")) return;
    const editable = /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName ?? "");
    if (event.key === "/" && !editable) {
      event.preventDefault();
      searchInput?.focus();
      return;
    }
    if (editable) {
      if (event.key === "Escape") {
        query = "";
        searchInput?.blur();
      }
      return;
    }
    if (event.key === "Backspace" && model.parentHref) {
      event.preventDefault();
      if (
        location.protocol === "file:" ||
        typeof model.parentDataHref !== "string"
      )
        location.href = model.parentHref;
      else
        openFolder(
          model.parentDataHref,
          new URL(model.parentHref, document.baseURI).href,
          true,
        );
      return;
    }
    const index = rows.findIndex((row) => row.id === selected);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      move(
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? rows.length - 1
            : index + (event.key === "ArrowDown" ? 1 : -1),
      );
    }
  }
  function updateScheme(value) {
    scheme = value;
    try {
      localStorage.setItem("dirwell-color-scheme", value);
    } catch {}
  }
  let archiveDebounce,
    archiveTrigger,
    archivePending = false;
  async function closeArchive() {
    globalOpen = false;
    await tick();
    archiveTrigger?.focus();
  }
  function scheduleArchiveSearch() {
    archiveAbort?.abort();
    archiveRequest++;
    archivePending = false;
    clearTimeout(archiveDebounce);
    archiveDebounce = setTimeout(() => {
      archiveDebounce = undefined;
      searchArchive();
    }, 300);
  }
  $effect(() => {
    if (!globalOpen || !model.searchQueryHref) return;
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        globalQuery.trim() &&
        !archivePending &&
        archiveDebounce === undefined
      )
        searchArchive();
    }, model.searchRefreshIntervalMs ?? 2000);
    return () => {
      clearInterval(timer);
      clearTimeout(archiveDebounce);
      archiveDebounce = undefined;
      archivePending = false;
      archiveAbort?.abort();
      archiveRequest++;
    };
  });
  async function searchArchive() {
    const token = ++archiveRequest;
    archiveAbort?.abort();
    const local = (archiveAbort = new AbortController());
    globalRows = [];
    archiveFailed = false;
    const query = globalQuery.trim();
    if (!query) {
      globalStatus = ui.labels.beginArchive;
      return;
    }
    globalStatus = ui.labels.searchingArchive;
    archivePending = true;
    try {
      if (model.searchQueryHref) {
        const result = await queryLiveArchive(
          model.searchQueryHref,
          query,
          local.signal,
        );
        if (token !== archiveRequest || local.signal.aborted) return;
        globalRows = result.records;
        globalStatus = result.truncated
          ? label(ui, "truncatedResults", {
              shown: result.records.length,
              count: result.records.length + "+",
            })
          : label(ui, "archiveResults", { count: result.records.length });
        return;
      }
      const url = new URL(model.searchIndexHref, document.baseURI);
      let all =
        archiveCacheHref === url.href && Date.now() - archiveCacheAt < 60000
          ? archiveCache
          : null;
      if (all === null) {
        const response = await fetch(url, { signal: local.signal });
        if (!response.ok) throw new Error("Unavailable archive");
        const index = await response.json();
        if (
          index.version !== 3 ||
          !Array.isArray(index.shards) ||
          !Number.isSafeInteger(index.count) ||
          index.count > 100000
        )
          throw new Error("Unsupported archive");
        all = [];
        for (const shard of index.shards) {
          if (typeof shard !== "string") throw new Error("Invalid shard");
          const shardUrl = new URL(shard, url);
          if (shardUrl.origin !== url.origin) throw new Error("Unsafe shard");
          const chunk = await fetch(shardUrl, { signal: local.signal });
          if (!chunk.ok) throw new Error("Unavailable shard");
          const data = await chunk.json();
          if (
            !Array.isArray(data.entries) ||
            all.length + data.entries.length > 100000
          )
            throw new Error("Invalid archive");
          for (const record of data.entries) {
            if (
              typeof record.name !== "string" ||
              typeof record.path !== "string" ||
              typeof record.exitsExplorer !== "boolean"
            )
              throw new Error("Invalid archive record");
            const href =
              record.href === null ? null : new URL(record.href, url);
            if (href && !["http:", "https:"].includes(href.protocol))
              throw new Error("Unsupported archive link");
            all.push({
              name: record.name,
              path: record.path,
              href: href?.href ?? null,
              exitsExplorer: record.exitsExplorer,
            });
          }
        }
        if (token !== archiveRequest || local.signal.aborted) return;
        archiveCache = all;
        archiveCacheHref = url.href;
        archiveCacheAt = Date.now();
      }
      const matches = all
        .map((record) => ({
          record,
          score: fuzzy(query, record.name + " " + record.path),
        }))
        .filter((item) => item.score !== null)
        .sort(
          (a, b) =>
            b.score - a.score || a.record.path.localeCompare(b.record.path),
        );
      if (token !== archiveRequest || local.signal.aborted) return;
      globalRows = matches.slice(0, 100).map((item) => item.record);
      globalStatus =
        matches.length > 100
          ? label(ui, "truncatedResults", { shown: 100, count: matches.length })
          : label(ui, "archiveResults", { count: matches.length });
    } catch {
      if (token === archiveRequest && !local.signal.aborted) {
        globalStatus = ui.labels.archiveError;
        archiveFailed = true;
      }
    } finally {
      if (token === archiveRequest) archivePending = false;
    }
  }
  onMount(() => {
    viewportHeight = innerHeight;
    ready = true;
    abort = new AbortController();
    try {
      const stored = localStorage.getItem("dirwell-color-scheme");
      if (["system", "light", "dark"].includes(stored)) scheme = stored;
    } catch {}
    viewHistory = createViewHistory("ledger");
    const view = readView(
      location.href,
      "ledger",
      model.path,
      viewDefaults(model),
      [],
      history.state,
    );
    query = view.query;
    types = view.types;
    sort = view.sort;
    selected = view.selected;
    scrollTop = view.listTop;
    saveView();
    const onPop = (event) => {
      if (event.state?.dataHref)
        openFolder(
          event.state.dataHref,
          location.href,
          false,
          false,
          event.state,
        );
      else location.reload();
    };
    window.addEventListener("popstate", onPop);
    hydrateData();
    return () => {
      abort?.abort();
      archiveAbort?.abort();
      window.removeEventListener("popstate", onPop);
    };
  });
  $effect(() => {
    const href = updatesHref;
    if (!href || typeof EventSource === "undefined") return;
    const updates = new EventSource(href);
    updates.onmessage = () => (pendingUpdates = href);
    updates.onerror = () => {
      error = ui.labels.updatesError;
      failure = "updates";
    };
    updates.onopen = () => {
      if (failure === "updates") {
        error = "";
        failure = null;
      }
    };
    return () => updates.close();
  });
  $effect(() => {
    if (ready && !busy && pendingUpdates) {
      const href = pendingUpdates;
      pendingUpdates = null;
      if (href === updatesHref)
        openFolder(model.dataHref, location.href, false, true);
    }
  });
  $effect(() => {
    if (ready) document.documentElement.dataset.theme = scheme;
  });
  $effect(() => {
    if (timeDialog && timestamp && !timeDialog.open) timeDialog.showModal();
  });
  $effect(() => {
    if (globalDialog && globalOpen && !globalDialog.open) {
      globalDialog.showModal();
      tick().then(() => globalInput?.focus());
    }
  });
</script>

<svelte:window
  onresize={() => (viewportHeight = innerHeight)}
  onkeydown={keyboard}
  onscroll={() => {
    if (list) scrollTop = Math.max(0, window.scrollY - list.offsetTop);
  }}
/>
<header class="page-header">
  <div class="wordmark">
    {#if header}{@render header({ model })}{:else}{#if ui.brand.logoUrl}<img
          src={ui.brand.logoUrl}
          alt={ui.brand.logoAlt ?? ""}
          width="40"
          height="40"
        />{/if}
      <h1>{ui.brand.name ?? model.title}</h1>
      <span>{ui.labels.archive}</span>{/if}
  </div>
  <nav aria-label={ui.labels.breadcrumb}>
    <a
      href={model.rootHref}
      onclick={(event) =>
        navigateLink(event, model.rootHref, model.rootDataHref)}
      >{ui.labels.home}</a
    >{#each model.breadcrumbs as crumb}
      / <a
        href={crumb.href}
        onclick={(event) => navigateLink(event, crumb.href, crumb.dataHref)}
        >{crumb.name}</a
      >{/each}
  </nav>
</header>
<main data-explorer data-framework="svelte" aria-busy={busy}>
  <div class="toolbar">
    <label class="search-field"
      >{ui.labels.searchDirectory}<input
        bind:this={searchInput}
        type="search"
        placeholder={ui.labels.searchFiles}
        bind:value={query}
        disabled={!ready || !complete}
        oncompositionstart={() => (composing = true)}
        oncompositionend={() => (composing = false)}
      /></label
    >
    <fieldset disabled={!ready || !complete}>
      <legend>{ui.labels.types}</legend
      >{#each ["directory", "file", "link"] as type}<label
          ><input
            type="checkbox"
            checked={types.includes(type)}
            onchange={(event) =>
              (types = event.currentTarget.checked
                ? [...types, type]
                : types.filter((value) => value !== type))}
          />{ui.labels[type]}</label
        >{/each}
    </fieldset>
    <label
      >{ui.labels.sort}<select
        value={sort.field}
        disabled={!ready || !complete}
        onchange={(event) =>
          (sort = { ...sort, field: event.currentTarget.value })}
        ><option value="name">{ui.labels.name}</option><option value="size"
          >{ui.labels.size}</option
        ><option value="modified">{ui.labels.modified}</option></select
      ></label
    >
    <label
      >{ui.labels.names}<select
        value={sort.nameMode}
        disabled={!ready || !complete}
        onchange={(event) =>
          (sort = { ...sort, nameMode: event.currentTarget.value })}
        ><option value="natural">{ui.labels.natural}</option><option
          value="locale">{ui.labels.locale}</option
        ><option value="unicode">{ui.labels.unicode}</option></select
      ></label
    >
    <label
      >{ui.labels.order}<select
        value={sort.direction}
        disabled={!ready || !complete}
        onchange={(event) =>
          (sort = { ...sort, direction: event.currentTarget.value })}
        ><option value="asc">{ui.labels.ascending}</option><option value="desc"
          >{ui.labels.descending}</option
        ></select
      ></label
    >
    <label
      ><input
        type="checkbox"
        checked={sort.directoriesFirst}
        disabled={!ready || !complete}
        onchange={(event) =>
          (sort = { ...sort, directoriesFirst: event.currentTarget.checked })}
      />{ui.labels.directoriesFirst}</label
    >
    <label
      >{ui.labels.appearance}<select
        value={scheme}
        disabled={!ready}
        onchange={(event) => updateScheme(event.currentTarget.value)}
        ><option value="system">{ui.labels.system}</option><option value="light"
          >{ui.labels.light}</option
        ><option value="dark">{ui.labels.dark}</option></select
      ></label
    >
    {#if model.searchIndexHref || model.searchQueryHref}
      <button
        bind:this={archiveTrigger}
        disabled={!ready}
        onclick={() => (globalOpen = true)}>{ui.labels.searchArchive}</button
      >
    {/if}
  </div>
  <section class="listing-card">
    <div class="listing-summary">
      {countParts[0]}<span data-visible-count
        >{complete ? rows.length : entries.length}</span
      >{countParts.slice(1).join("__COUNT__")}<span
        role="status"
        aria-live="polite">{busy ? ui.labels.loading : error}</span
      >
    </div>
    {#if failure && failure !== "copy"}<button disabled={busy} onclick={retry}
        >{ui.labels.retry}</button
      >{/if}
    {#if failure === "folder" && retryRequest}<a href={retryRequest[1]}
        >{ui.labels.openNative}</a
      >{/if}
    <div
      class="entry-head"
      data-custom-columns={Boolean(model.ui?.columns)}
      style:grid-template-columns={model.ui?.columns
        ? ui.columns
            .map((column) =>
              column === "name"
                ? "minmax(0,1fr)"
                : typeof column === "object"
                  ? "minmax(0,12rem)"
                  : "minmax(6rem,max-content)",
            )
            .join(" ")
        : undefined}
    >
      {#each ui.columns as column}<span>{columnLabel(column, ui)}</span>{/each}
    </div>
    <ul class="entry-list" bind:this={list}>
      {#if model.parentHref}<li class="entry">
          <a
            href={model.parentHref}
            onclick={(event) =>
              navigateLink(event, model.parentHref, model.parentDataHref)}
            >../</a
          >
        </li>{/if}
      {#if start}<li
          aria-hidden="true"
          style:height={offsets[start] + "px"}
        ></li>{/if}
      {#each rows.slice(start, end) as entry, index (entry.id)}
        <li
          class="entry"
          use:measure={entry.id}
          data-entry
          data-custom-columns={Boolean(model.ui?.columns)}
          data-id={entry.id}
          data-order={start + index}
          data-active={selected === entry.id}
          style:grid-template-columns={model.ui?.columns
            ? ui.columns
                .map((column) =>
                  column === "name"
                    ? "minmax(0,1fr)"
                    : "minmax(6rem,max-content)",
                )
                .join(" ")
            : undefined}
        >
          {#each ui.columns as column}
            {#if column === "name"}<span class="identity"
                >{#if entry.href}<a
                    class="name"
                    href={safeHref(entry)}
                    target={entry.exitsExplorer ? "_blank" : undefined}
                    rel={entry.exitsExplorer ? "noopener" : undefined}
                    onclick={(event) => navigate(event, entry)}
                    onfocus={() => (selected = entry.id)}
                    >{#if row}{@render row({
                        model,
                        entry,
                        selected: selected === entry.id,
                      })}{:else}<span class="file-icon" aria-hidden="true"
                        >{@html entryIcon(entryType(entry))}</span
                      >
                      {entry.name}{isDirectory(entry) ? "/" : ""}{/if}</a
                  >{:else}<span
                    >{#if row}{@render row({
                        model,
                        entry,
                        selected: selected === entry.id,
                      })}{:else}{entry.name}{/if}</span
                  >{/if}{#if entry.link}<small class="target"
                    >{entry.link.unavailable
                      ? ui.labels.unavailable + " · "
                      : "→ "}{entry.link.target}</small
                  >{/if}</span
              >
            {:else if column === "size"}<span class="kind"
                >{isDirectory(entry)
                  ? ui.labels.folder
                  : size(entry.size)}</span
              >
            {:else if column === "modified"}<button
                class="timestamp-button"
                disabled={!ready}
                onclick={() => (timestamp = entry.modifiedAt)}
                ><time datetime={entry.modifiedAt}
                  >{formattedDate(entry.modifiedAt, ui, ready)}</time
                ></button
              >
            {:else}<span class="entry-data"
                >{publicDataValue(entry.data?.[column.dataKey])}</span
              >{/if}{/each}
          {#if actions || ui.actions.length}<span
              data-dirwell-actions
              style="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:.5rem"
            >
              {#if actions}{@render actions({
                  model,
                  entry,
                  selected: selected === entry.id,
                })}{/if}
              {#each ui.actions as action}
                {#if action === "download" && entry.href && !isDirectory(entry) && !entry.link?.unavailable}<a
                    href={safeHref(entry)}
                    download>{ui.labels.download}</a
                  >
                {:else if action !== "download"}<button
                    disabled={!ready || (action === "copy-link" && !entry.href)}
                    aria-label={(action === "copy-link"
                      ? ui.labels.copyLink
                      : ui.labels.copyPath) +
                      ": " +
                      entry.name}
                    onclick={async () => {
                      try {
                        await copyEntryAction(action, entry);
                        error = ui.labels.copied;
                        failure = null;
                      } catch {
                        error = ui.labels.copyError;
                        failure = "copy";
                      }
                    }}
                    >{action === "copy-link"
                      ? ui.labels.copyLink
                      : ui.labels.copyPath}</button
                  >{/if}
              {/each}
            </span>{/if}
        </li>
      {/each}
      {#if end < rows.length}<li
          aria-hidden="true"
          style:height={offsets[rows.length] - offsets[end] + "px"}
        ></li>{/if}
    </ul>
    {#if rows.length === 0 && !busy}<p>
        {model.total === 0 ? ui.labels.empty : ui.labels.noMatches}
      </p>{/if}
  </section>
  {#if model.page?.count > 1 && !complete}<nav
      aria-label={ui.labels.pagination}
    >
      {#if model.page.previousHref}<a rel="prev" href={model.page.previousHref}
          >{ui.labels.previous}</a
        >{/if}
      {label(ui, "page", { page: model.page.number, pages: model.page.count })}
      {#if model.page.nextHref}<a rel="next" href={model.page.nextHref}
          >{ui.labels.next}</a
        >{/if}
    </nav>{/if}
  {#if footer}{@render footer({ model })}{:else if ui.brand.footerText}<p
      class="brand-footer"
    >
      {#if ui.brand.footerUrl}<a href={ui.brand.footerUrl}
          >{ui.brand.footerText}</a
        >{:else}{ui.brand.footerText}{/if}
    </p>{:else}<p class="keyboard-help">
      {ui.labels.keyboardHelp}
    </p>{/if}
</main>
{#if timestamp}<dialog
    bind:this={timeDialog}
    onclose={() => (timestamp = null)}
  >
    <h2>{ui.labels.modifiedTime}</h2>
    <p>{timestamp}</p>
    <p>
      {ui.dateOptions.locale !== undefined ||
      ui.dateOptions.timeZone !== undefined
        ? formattedDate(timestamp, ui, true)
        : new Date(timestamp).toLocaleString()}
    </p>
    <button onclick={() => (timestamp = null)}>{ui.labels.close}</button>
  </dialog>{/if}
{#if globalOpen}<dialog
    bind:this={globalDialog}
    aria-label={ui.labels.searchArchive}
    onclose={closeArchive}
    onkeydown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeArchive();
      }
    }}
  >
    <h2>{ui.labels.searchArchive}</h2>
    <input
      aria-label={ui.labels.archiveSearchInput}
      bind:this={globalInput}
      type="search"
      bind:value={globalQuery}
      oninput={scheduleArchiveSearch}
    />
    <p role="status">{globalStatus}</p>
    {#if archiveFailed}<button onclick={searchArchive}>{ui.labels.retry}</button
      >{/if}
    <ul>
      {#each globalRows as record}<li>
          {#if record.href}<a
              href={record.href}
              target={record.exitsExplorer ? "_blank" : undefined}
              rel={record.exitsExplorer ? "noopener" : undefined}
              >{record.path}</a
            >{:else}{record.path}{/if}
        </li>{/each}
    </ul>
    <button onclick={closeArchive}>{ui.labels.close}</button>
  </dialog>{/if}
