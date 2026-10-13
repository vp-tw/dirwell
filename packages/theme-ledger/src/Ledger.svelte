<script>
  import { onMount, tick, untrack } from "svelte";
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
    modified,
    fuzzy,
  } from "../../shared-theme/src/records.ts";
  let { model: initialModel, header, row, footer } = $props();
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
    timestamp = $state(null),
    composing = $state(false),
    scrollTop = $state(0),
    globalOpen = $state(false),
    globalQuery = $state(""),
    globalRows = $state.raw([]),
    globalStatus = $state("Enter a search to begin."),
    pendingUpdates = $state(null);
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
    end = $derived(virtual ? Math.min(rows.length, start + 35) : rows.length);
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
    archiveRequest = 0;
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
      if (token === navigation && !local.signal.aborted)
        error =
          "Could not load complete directory data. Native page links remain available.";
    } finally {
      if (token === navigation) busy = false;
    }
  }
  async function navigate(event, record) {
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
  async function openFolder(dataHref, url, push, refresh = false) {
    const token = ++navigation;
    abort?.abort();
    const local = (abort = new AbortController());
    busy = true;
    error = "";
    try {
      const next = await fetchThemePage(
        dataHref,
        url,
        "ledger",
        local.signal,
        refresh,
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
      model = next;
      entries = nextEntries;
      if (!refresh) {
        query = "";
        selected = null;
        scrollTop = 0;
      }
      if (push) history.pushState({ dataHref: next.dataHref }, "", url);
      applyThemeMetadata(next, url);
      await hydrateData();
      if (!refresh) window.scrollTo({ top: 0 });
    } catch (cause) {
      if (token === navigation && !local.signal.aborted)
        error =
          "Could not open this folder. Open its native link or try again.";
    } finally {
      if (token === navigation) busy = false;
    }
  }
  function navigateLink(event, href, dataHref) {
    if (
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
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    selected = row.id;
    if (virtual) {
      scrollTop = Math.max(0, offsets[index] - 100);
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
        globalOpen = false;
      }
      return;
    }
    if (timestamp) {
      if (event.key === "Escape") timestamp = null;
      return;
    }
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
      if (location.protocol === "file:") location.href = model.parentHref;
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
  async function searchArchive() {
    const token = ++archiveRequest;
    archiveAbort?.abort();
    const local = (archiveAbort = new AbortController());
    globalRows = [];
    const query = globalQuery.trim();
    if (!query) {
      globalStatus = "Enter a search to begin.";
      return;
    }
    globalStatus = "Searching archive…";
    try {
      const url = new URL(model.searchIndexHref, document.baseURI);
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
      const all = [];
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
          const href = record.href === null ? null : new URL(record.href, url);
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
          ? "Showing 100 of " + matches.length + " results"
          : matches.length + " results";
    } catch {
      if (token === archiveRequest && !local.signal.aborted)
        globalStatus = "Could not load archive search. Try again.";
    }
  }
  onMount(() => {
    ready = true;
    abort = new AbortController();
    try {
      const stored = localStorage.getItem("dirwell-color-scheme");
      if (["system", "light", "dark"].includes(stored)) scheme = stored;
    } catch {}
    history.replaceState(
      { dataHref: new URL(model.dataHref, document.baseURI).href },
      "",
    );
    const onPop = (event) => {
      if (event.state?.dataHref)
        openFolder(event.state.dataHref, location.href, false);
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
    updates.onerror = () =>
      (error = "Live updates disconnected. Refresh to retry.");
    updates.onopen = () => {
      if (error.startsWith("Live updates")) error = "";
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
  onkeydown={keyboard}
  onscroll={() => {
    if (list) scrollTop = Math.max(0, window.scrollY - list.offsetTop);
  }}
/>
<header class="page-header">
  <div class="wordmark">
    {#if header}{@render header({ model })}{:else}<h1>{model.title}</h1>
      <span>File archive</span>{/if}
  </div>
  <nav aria-label="Breadcrumb">
    <a
      href={model.rootHref}
      onclick={(event) =>
        navigateLink(event, model.rootHref, model.rootDataHref)}>Home</a
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
      >Search this directory<input
        bind:this={searchInput}
        type="search"
        placeholder="Search files"
        bind:value={query}
        disabled={!ready || !complete}
        oncompositionstart={() => (composing = true)}
        oncompositionend={() => (composing = false)}
      /></label
    >
    <fieldset disabled={!ready || !complete}>
      <legend>Types</legend>{#each ["directory", "file", "link"] as type}<label
          ><input
            type="checkbox"
            checked={types.includes(type)}
            onchange={(event) =>
              (types = event.currentTarget.checked
                ? [...types, type]
                : types.filter((value) => value !== type))}
          />{type}</label
        >{/each}
    </fieldset>
    <label
      >Sort<select
        value={sort.field}
        disabled={!ready || !complete}
        onchange={(event) =>
          (sort = { ...sort, field: event.currentTarget.value })}
        ><option value="name">Name</option><option value="size">Size</option
        ><option value="modified">Modified</option></select
      ></label
    >
    <label
      >Names<select
        value={sort.nameMode}
        disabled={!ready || !complete}
        onchange={(event) =>
          (sort = { ...sort, nameMode: event.currentTarget.value })}
        ><option value="natural">Natural</option><option value="locale"
          >Locale</option
        ><option value="unicode">Unicode</option></select
      ></label
    >
    <label
      >Order<select
        value={sort.direction}
        disabled={!ready || !complete}
        onchange={(event) =>
          (sort = { ...sort, direction: event.currentTarget.value })}
        ><option value="asc">Ascending</option><option value="desc"
          >Descending</option
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
      />Folders first</label
    >
    <label
      >Appearance<select
        value={scheme}
        disabled={!ready}
        onchange={(event) => updateScheme(event.currentTarget.value)}
        ><option value="system">System</option><option value="light"
          >Light</option
        ><option value="dark">Dark</option></select
      ></label
    >
    <button
      disabled={!ready || !model.searchIndexHref}
      onclick={() => (globalOpen = true)}>Search archive</button
    >
  </div>
  <section class="listing-card">
    <div class="listing-summary">
      <span data-visible-count>{complete ? rows.length : entries.length}</span>
      entries{#if !complete}
        on this page · {model.total} in directory{/if}<span
        role="status"
        aria-live="polite">{busy ? "Loading…" : error}</span
      >
    </div>
    <div class="entry-head">
      <span>Name</span><span>Size</span><span>Modified</span>
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
          data-id={entry.id}
          data-order={start + index}
          data-active={selected === entry.id}
        >
          <span class="identity"
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
                >{entry.link.unavailable ? "Target unavailable · " : "→ "}{entry
                  .link.target}</small
              >{/if}</span
          >
          <span class="kind"
            >{isDirectory(entry) ? "Folder" : size(entry.size)}</span
          >
          <button
            class="timestamp-button"
            disabled={!ready}
            onclick={() => (timestamp = entry.modifiedAt)}
            ><time datetime={entry.modifiedAt}
              >{modified(entry.modifiedAt, ready)}</time
            ></button
          >
        </li>
      {/each}
      {#if end < rows.length}<li
          aria-hidden="true"
          style:height={offsets[rows.length] - offsets[end] + "px"}
        ></li>{/if}
    </ul>
    {#if rows.length === 0}<p>No matching entries.</p>{/if}
  </section>
  {#if model.page?.count > 1 && !complete}<nav aria-label="Pagination">
      {#if model.page.previousHref}<a rel="prev" href={model.page.previousHref}
          >Previous</a
        >{/if} Page {model.page.number} of {model.page.count}
      {#if model.page.nextHref}<a rel="next" href={model.page.nextHref}>Next</a
        >{/if}
    </nav>{/if}
  {#if footer}{@render footer({ model })}{:else}<p class="keyboard-help">
      Arrow keys select files · Home / End jump · / searches · Backspace opens
      parent
    </p>{/if}
</main>
{#if timestamp}<dialog
    bind:this={timeDialog}
    onclose={() => (timestamp = null)}
  >
    <h2>Modified time</h2>
    <p>{timestamp}</p>
    <p>{new Date(timestamp).toLocaleString()}</p>
    <button onclick={() => (timestamp = null)}>Close</button>
  </dialog>{/if}
{#if globalOpen}<dialog
    bind:this={globalDialog}
    onclose={() => (globalOpen = false)}
  >
    <h2>Search archive</h2>
    <input
      aria-label="Search archive files"
      bind:this={globalInput}
      type="search"
      bind:value={globalQuery}
      oninput={searchArchive}
    />
    <p role="status">{globalStatus}</p>
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
    <button onclick={() => (globalOpen = false)}>Close</button>
  </dialog>{/if}
