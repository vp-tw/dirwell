<script setup>
import {
  ref,
  shallowRef,
  computed,
  onMounted,
  onBeforeUnmount,
  watchEffect,
  watch,
  nextTick,
} from "vue";
import { queryLiveArchive } from "../../shared-theme/src/live-search.ts";
import { useGamepad } from "@vueuse/core";
import { loadListing } from "@dirwell/core/client";
import {
  fetchThemePage,
  applyThemeMetadata,
  restoreThemePage,
} from "../../shared-theme/src/navigation.ts";
import { readView, createViewHistory } from "../../shared-theme/src/view-state.ts";
import { entryIcon } from "../../shared-theme/src/icons.ts";
import { directoryLike, size } from "../../shared-theme/src/records.ts";
import {
  resolveCustomization,
  label,
  formattedDate,
  copyEntryAction,
  publicDataValue,
} from "../../shared-theme/src/customization.ts";
import { createWave } from "./wave.mjs";
const props = defineProps({ model: { type: Object, required: true } }),
  model = shallowRef(restoreThemePage(props.model, Boolean(import.meta.hot))),
  entries = shallowRef(model.value.entries),
  ui = computed(() => resolveCustomization(model.value.ui));
const query = ref(""),
  category = ref(model.value.categories[0]?.id ?? null),
  selected = ref(null),
  ready = ref(false),
  busy = ref(false),
  error = ref(""),
  failure = ref(null),
  color = ref(props.model.color),
  paused = ref(!props.model.backgroundMotion),
  clock = ref(""),
  pad = ref(false),
  waveReady = ref(false),
  pendingUpdates = ref(null),
  canvas = ref(),
  search = ref(),
  listScroll = ref(),
  footerElement = ref(),
  scrollTop = ref(0),
  viewportHeight = ref(400),
  retryRequest = shallowRef(null),
  heights = shallowRef(new Map());
const archiveOpen = ref(false),
  archiveQuery = ref(""),
  archiveRows = shallowRef([]),
  archiveStatus = ref(""),
  archiveFailed = ref(false),
  archiveTrigger = ref(),
  archiveDialog = ref(),
  archiveInput = ref();
let archiveAbort,
  archiveRequest = 0,
  archivePending = false;
async function searchArchive() {
  const token = ++archiveRequest;
  archiveAbort?.abort();
  const local = (archiveAbort = new AbortController());
  archiveFailed.value = false;
  if (!archiveQuery.value.trim()) {
    archiveRows.value = [];
    archiveStatus.value = ui.value.labels.beginArchive;
    return;
  }
  archiveStatus.value = ui.value.labels.searchingArchive;
  archivePending = true;
  try {
    const result = await queryLiveArchive(
      model.value.searchQueryHref,
      archiveQuery.value.trim(),
      local.signal,
    );
    if (local.signal.aborted || token !== archiveRequest) return;
    archiveRows.value = result.records;
    archiveStatus.value = result.truncated
      ? label(ui.value, "truncatedResults", {
          shown: result.records.length,
          count: result.records.length + "+",
        })
      : label(ui.value, "archiveResults", { count: result.records.length });
  } catch {
    if (local.signal.aborted || token !== archiveRequest) return;
    archiveRows.value = [];
    archiveStatus.value = ui.value.labels.archiveError;
    archiveFailed.value = true;
  } finally {
    if (token === archiveRequest) archivePending = false;
  }
}
watch([archiveOpen, archiveQuery], (_, __, cleanup) => {
  archiveAbort?.abort();
  archiveRequest++;
  archivePending = false;
  if (!archiveOpen.value) return;
  const debounce = setTimeout(searchArchive, 300);
  cleanup(() => clearTimeout(debounce));
});
watch(archiveOpen, async (open, _, cleanup) => {
  if (!open) {
    await nextTick();
    archiveTrigger.value?.focus();
    return;
  }
  await nextTick();
  if (!archiveOpen.value) return;
  archiveDialog.value?.showModal();
  archiveInput.value?.focus();
  const timer = setInterval(() => {
    if (document.visibilityState === "visible" && archiveQuery.value.trim() && !archivePending)
      searchArchive();
  }, model.value.searchRefreshIntervalMs ?? 2000);
  cleanup(() => {
    clearInterval(timer);
    archiveAbort?.abort();
    archiveRequest++;
  });
});
const complete = computed(() => entries.value.length === model.value.total),
  membership = (entry) =>
    Array.isArray(entry.presentation?.categories) ? entry.presentation.categories : [];
const rows = computed(() =>
    entries.value.filter(
      (entry) =>
        membership(entry).includes(category.value) &&
        `${entry.name} ${entry.link?.target ?? ""}`
          .toLocaleLowerCase()
          .includes(query.value.trim().toLocaleLowerCase()),
    ),
  ),
  active = computed(() => rows.value.find((entry) => entry.id === selected.value) ?? rows.value[0]),
  heading = computed(
    () =>
      model.value.categories.find((item) => item.id === category.value)?.label ??
      ui.value.labels.allFiles,
  );
const nodes = new Map();
const virtual = computed(() => ready.value && rows.value.length > 500);
const offsets = computed(() => {
  const result = [0];
  for (const entry of rows.value) result.push(result.at(-1) + (heights.value.get(entry.id) ?? 76));
  return result;
});
const start = computed(() => {
  if (!virtual.value) return 0;
  const position = Math.max(0, scrollTop.value - (model.value.parentHref ? 76 : 0));
  let low = 0,
    high = rows.value.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (offsets.value[middle + 1] <= position) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 5);
});
const end = computed(() => {
  if (!virtual.value) return rows.value.length;
  let low = 0,
    high = rows.value.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (offsets.value[middle + 1] <= scrollTop.value + viewportHeight.value) low = middle + 1;
    else high = middle;
  }
  return Math.min(rows.value.length, Math.max(start.value + 35, low + 5));
});
const visibleRows = computed(() => rows.value.slice(start.value, end.value));
const heightCache = new Map();
let rowObserver, layoutObserver, viewHistory, measuredWidth;
function measureLayout() {
  if (!listScroll.value) return;
  const width = listScroll.value.clientWidth;
  if (measuredWidth !== undefined && width !== measuredWidth) {
    heightCache.clear();
    heights.value = new Map(
      [...nodes].map(([id, node]) => [id, node.getBoundingClientRect().height]),
    );
  }
  measuredWidth = width;
  const footerHeight = footerElement.value?.getBoundingClientRect().height ?? 82;
  document.documentElement.style.setProperty("--cw-footer-height", footerHeight + "px");
  const available = Math.max(
    160,
    innerHeight - listScroll.value.getBoundingClientRect().top - footerHeight - 24,
  );
  viewportHeight.value = available;
  listScroll.value.style.setProperty("--cw-list-height", available + "px");
}
watch([virtual, () => model.value.path], () => nextTick(measureLayout));
const viewDefaults = (page) => ({ query: "", category: page.categories[0]?.id ?? null });
function saveView() {
  if (!viewHistory) return;
  viewHistory.save(
    new URL(model.value.dataHref, document.baseURI).href,
    model.value.path,
    {
      query: query.value,
      category: category.value,
      selected: selected.value,
      windowY: window.scrollY,
      listTop: listScroll.value?.scrollTop ?? 0,
    },
    viewDefaults(model.value),
  );
}
function retry() {
  if (failure.value === "folder" && retryRequest.value) openFolder(...retryRequest.value, true);
  else openFolder(model.value.dataHref, location.href, false, true);
}
watchEffect((onCleanup) => {
  if (!ready.value || busy.value) return;
  const view = {
    query: query.value,
    category: category.value,
    selected: selected.value,
    listTop: scrollTop.value,
  };
  const dataHref = model.value.dataHref,
    path = model.value.path,
    defaults = viewDefaults(model.value);
  const frame = requestAnimationFrame(() =>
    viewHistory?.save(
      new URL(dataHref, document.baseURI).href,
      path,
      { ...view, windowY: window.scrollY },
      defaults,
    ),
  );
  onCleanup(() => cancelAnimationFrame(frame));
});
function setNode(id, node) {
  const old = nodes.get(id);
  if (old && old !== node) rowObserver?.unobserve(old);
  if (node) {
    nodes.set(id, node);
    rowObserver?.observe(node);
  } else nodes.delete(id);
}
watch([query, category], () => {
  scrollTop.value = 0;
  if (listScroll.value) listScroll.value.scrollTop = 0;
});
let wave,
  gamepad,
  abort,
  navigation = 0,
  timer,
  lastPad = 0,
  pressed = new Set(),
  disposed = false,
  padIdentity = null,
  motionQuery;
function safeHref(entry) {
  return typeof location !== "undefined" &&
    location.protocol === "file:" &&
    directoryLike(entry) &&
    !entry.exitsExplorer &&
    entry.href?.endsWith("/")
    ? entry.href + "index.html"
    : entry.href;
}
async function loadComplete() {
  if (complete.value || !model.value.manifestHref || location.protocol === "file:") return;
  const local = abort,
    token = navigation;
  busy.value = true;
  try {
    const data = await loadListing(new URL(model.value.manifestHref, document.baseURI).href, {
      signal: local.signal,
      cache: model.value.updatesHref ? "no-store" : "default",
    });
    if (token === navigation && !local.signal.aborted && !disposed) entries.value = data.entries;
  } catch (cause) {
    if (token === navigation && !local.signal.aborted) {
      error.value = ui.value.labels.listingError;
      failure.value = "listing";
    }
  } finally {
    if (token === navigation) busy.value = false;
  }
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
  busy.value = true;
  error.value = "";
  failure.value = null;
  try {
    const next = await fetchThemePage(dataHref, url, "crosswave", local.signal, refresh || fresh);
    let nextEntries = next.entries;
    if (refresh && next.manifestHref && nextEntries.length !== next.total)
      nextEntries = (
        await loadListing(next.manifestHref, { signal: local.signal, cache: "no-store" })
      ).entries;
    if (token !== navigation || local.signal.aborted || disposed) return;
    if (!refresh) viewHistory.commit(next.dataHref, next.path, url, push);
    if (next.path !== model.value.path) {
      heightCache.set(model.value.path, heights.value);
      if (heightCache.size > 8) heightCache.delete(heightCache.keys().next().value);
      heights.value = heightCache.get(next.path) ?? new Map();
    }
    model.value = next;
    retryRequest.value = null;
    entries.value = nextEntries;
    if (!refresh) {
      const view = readView(
        url,
        "crosswave",
        next.path,
        viewDefaults(next),
        next.categories.map((item) => item.id),
        restoreState,
      );
      query.value = view.query;
      selected.value = view.selected;
      category.value = view.category;
    }
    applyThemeMetadata(next, url);
    await loadComplete();
    if (!refresh) {
      const view = readView(
        url,
        "crosswave",
        next.path,
        viewDefaults(next),
        next.categories.map((item) => item.id),
        restoreState,
      );
      await nextTick();
      if (selected.value && !rows.value.some((entry) => entry.id === selected.value))
        selected.value = null;
      scrollTop.value = view.listTop;
      if (listScroll.value) listScroll.value.scrollTop = view.listTop;
      await nextTick();
      window.scrollTo({ top: view.windowY });
      if (restoreState && selected.value)
        nodes.get(selected.value)?.querySelector("a")?.focus({ preventScroll: true });
    }
  } catch (cause) {
    if (token === navigation && !local.signal.aborted) {
      error.value = ui.value.labels.folderError;
      failure.value = "folder";
      retryRequest.value = [dataHref, url, push, refresh, restoreState];
      viewHistory?.rollback();
    }
  } finally {
    if (token === navigation) busy.value = false;
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
async function openEntry(event, entry) {
  saveView();
  const href = entry.presentation?.folderDataHref;
  if (
    entry.exitsExplorer ||
    event?.altKey ||
    event?.ctrlKey ||
    event?.metaKey ||
    event?.shiftKey ||
    event?.button > 0 ||
    typeof href !== "string" ||
    location.protocol === "file:"
  )
    return;
  event?.preventDefault();
  await openFolder(href, new URL(entry.href, document.baseURI).href, true);
}
async function move(index) {
  const target = Math.max(0, Math.min(rows.value.length - 1, index));
  const entry = rows.value[target];
  if (!entry) return;
  selected.value = entry.id;
  if (virtual.value) {
    scrollTop.value = Math.max(0, offsets.value[target] - 100 + (model.value.parentHref ? 76 : 0));
    if (listScroll.value) listScroll.value.scrollTop = scrollTop.value;
  }
  await nextTick();
  const node = nodes.get(entry.id);
  node?.querySelector("a")?.focus({ preventScroll: true });
  node?.scrollIntoView({ block: "nearest" });
}
async function stepCategory(delta) {
  if (ui.value.direction === "rtl") delta = -delta;
  const moveFocus = document.activeElement?.getAttribute("role") === "tab";
  const items = model.value.categories,
    index = items.findIndex((item) => item.id === category.value);
  category.value = items[(index + delta + items.length) % items.length].id;
  selected.value = null;
  if (moveFocus) {
    await nextTick();
    document.getElementById("cw-tab-" + category.value)?.focus({ preventScroll: true });
  }
}
async function confirm() {
  if (!active.value || busy.value) return;
  await move(rows.value.findIndex((entry) => entry.id === active.value.id));
  const anchor = nodes.get(active.value.id)?.querySelector("a");
  anchor?.click();
}
function parent() {
  if (model.value.parentHref) {
    if (location.protocol === "file:" || typeof model.value.parentDataHref !== "string")
      location.href = model.value.parentHref;
    else
      openFolder(
        model.value.parentDataHref,
        new URL(model.value.parentHref, document.baseURI).href,
        true,
      );
  }
}
function keyboard(event) {
  if (archiveOpen.value) return;
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target?.closest?.("[data-dirwell-actions]")) return;
  const editing = /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName ?? "");
  if (editing) {
    if (event.key === "Escape") query.value = "";
    return;
  }
  const index = rows.value.findIndex((entry) => entry.id === (selected.value ?? active.value?.id));
  if (event.key === "/") {
    event.preventDefault();
    search.value?.focus();
  } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    move(
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? rows.value.length - 1
          : index + (event.key === "ArrowDown" ? 1 : -1),
    );
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    stepCategory(event.key === "ArrowRight" ? 1 : -1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    confirm();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    parent();
  }
}
function controller(value) {
  if (archiveOpen.value) return;
  pad.value = !!value;
  if (!value) {
    pressed.clear();
    padIdentity = null;
    return;
  }
  const buttons = value.buttons ?? [],
    next = new Set(
      buttons
        .map((button, index) => (button.pressed || button.value > 0.5 ? index : -1))
        .filter((index) => index >= 0),
    ),
    time = performance.now(),
    axis = value.axes ?? [];
  const identity = `${value.index}:${value.id}`;
  if (padIdentity !== identity) {
    padIdentity = identity;
    pressed = next;
    lastPad = time;
    return;
  }
  if (
    document.hidden ||
    disposed ||
    busy.value ||
    !complete.value ||
    /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? "")
  ) {
    pressed = next;
    return;
  }
  if (time - lastPad > 180) {
    const index = rows.value.findIndex(
      (entry) => entry.id === (selected.value ?? active.value?.id),
    );
    if (next.has(13) || (axis[1] ?? 0) > 0.35) {
      move(index + 1);
      lastPad = time;
    } else if (next.has(12) || (axis[1] ?? 0) < -0.35) {
      move(index - 1);
      lastPad = time;
    } else if (next.has(15) || (axis[0] ?? 0) > 0.35) {
      stepCategory(1);
      lastPad = time;
    } else if (next.has(14) || (axis[0] ?? 0) < -0.35) {
      stepCategory(-1);
      lastPad = time;
    }
  }
  if (next.has(0) && !pressed.has(0)) confirm();
  if (next.has(1) && !pressed.has(1)) parent();
  pressed = next;
}
const colors = {
  azure: [0.17, 0.31, 0.52],
  violet: [0.36, 0.25, 0.49],
  amber: [0.44, 0.3, 0.1],
  rose: [0.44, 0.25, 0.33],
  jade: [0.13, 0.37, 0.32],
  graphite: [0.26, 0.3, 0.38],
};
const onPop = (event) =>
  event.state?.dataHref
    ? openFolder(event.state.dataHref, location.href, false, false, event.state)
    : location.reload();
const suspend = () => {
  gamepad?.pause();
  controller(null);
  wave?.stop();
};
const syncMotion = () => wave?.sync();
const visibility = () => {
  if (document.hidden) {
    gamepad?.pause();
    controller(null);
    wave?.stop();
  } else {
    gamepad?.resume();
    wave?.sync();
  }
};
onMounted(() => {
  ready.value = true;
  document.body.setAttribute("data-cw-enhanced", "");
  abort = new AbortController();
  if (typeof ResizeObserver !== "undefined") {
    rowObserver = new ResizeObserver((observations) => {
      const next = new Map(heights.value);
      let changed = false;
      for (const observation of observations) {
        const id = observation.target.dataset.id;
        const height = observation.target.getBoundingClientRect().height;
        if (height > 0 && next.get(id) !== height) {
          next.set(id, height);
          changed = true;
        }
      }
      if (changed) heights.value = next;
    });
    for (const node of nodes.values()) rowObserver.observe(node);
    layoutObserver = new ResizeObserver(measureLayout);
    if (footerElement.value) layoutObserver.observe(footerElement.value);
    const header = document.querySelector("[data-dirwell-theme='crosswave'] .cw-top");
    if (header) layoutObserver.observe(header);
  }
  measureLayout();
  window.addEventListener("resize", measureLayout);
  viewHistory = createViewHistory("crosswave");
  const view = readView(
    location.href,
    "crosswave",
    model.value.path,
    viewDefaults(model.value),
    model.value.categories.map((item) => item.id),
    history.state,
  );
  query.value = view.query;
  category.value = view.category;
  selected.value = view.selected;
  scrollTop.value = view.listTop;
  if (listScroll.value) listScroll.value.scrollTop = view.listTop;
  saveView();
  try {
    const stored = localStorage.getItem("dirwell-crosswave-color");
    if (Object.hasOwn(colors, stored)) color.value = stored;
  } catch {}
  wave = createWave(
    canvas.value,
    colors,
    document.documentElement,
    () =>
      !paused.value && !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches,
    (value) => (waveReady.value = value),
  );
  wave?.sync();
  if (model.value.gamepad && typeof navigator.getGamepads === "function") {
    const safeNavigator = {
      getGamepads() {
        try {
          const pads = navigator.getGamepads();
          if (gamepad) {
            const connected = Array.from(pads).filter((value) => value?.connected);
            gamepad.gamepads.value = gamepad.gamepads.value.filter((value) =>
              connected.some((current) => current.index === value.index),
            );
            for (const value of connected)
              if (!gamepad.gamepads.value.some((current) => current.index === value.index))
                gamepad.gamepads.value.push(value);
          }
          return pads;
        } catch {
          if (gamepad) gamepad.gamepads.value = [];
          controller(null);
          return [];
        }
      },
    };
    gamepad = useGamepad({ navigator: safeNavigator });
    safeNavigator.getGamepads();
    gamepad.resume();
    watchEffect(
      () =>
        controller(
          gamepad.gamepads.value.find((value) => value.connected && value.mapping === "standard") ??
            null,
        ),
      { flush: "sync" },
    );
  }
  const updateClock = () =>
    (clock.value = new Date().toLocaleTimeString(ui.value.dateOptions.locale, {
      timeZone: ui.value.dateOptions.timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }));
  updateClock();
  timer = setInterval(updateClock, 1000);
  window.addEventListener("keydown", keyboard);
  window.addEventListener("popstate", onPop);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", visibility);
  motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener("change", syncMotion);
  loadComplete();
});
watch(
  () =>
    ready.value && model.value.updatesHref
      ? new URL(model.value.updatesHref, document.baseURI).href
      : null,
  (href, _old, onCleanup) => {
    if (!href || typeof EventSource === "undefined") return;
    const updates = new EventSource(href);
    updates.onmessage = () => (pendingUpdates.value = href);
    updates.onerror = () => {
      error.value = ui.value.labels.updatesError;
      failure.value = "updates";
    };
    updates.onopen = () => {
      if (failure.value === "updates") {
        error.value = "";
        failure.value = null;
      }
    };
    onCleanup(() => updates.close());
  },
);
watchEffect(() => {
  if (ready.value && !busy.value && pendingUpdates.value) {
    const href = pendingUpdates.value;
    pendingUpdates.value = null;
    if (href === new URL(model.value.updatesHref, document.baseURI).href && !disposed)
      openFolder(model.value.dataHref, location.href, false, true);
  }
});
watchEffect(() => {
  if (ready.value) {
    document.documentElement.dataset.cwColor = color.value;
    document.documentElement.dataset.cwMotion = String(!paused.value);
    try {
      localStorage.setItem("dirwell-crosswave-color", color.value);
    } catch {}
    wave?.sync();
  }
});
onBeforeUnmount(() => {
  archiveAbort?.abort();
  disposed = true;
  document.body.removeAttribute("data-cw-enhanced");
  abort?.abort();
  rowObserver?.disconnect();
  layoutObserver?.disconnect();
  window.removeEventListener("resize", measureLayout);
  gamepad?.pause();
  wave?.dispose();
  clearInterval(timer);
  window.removeEventListener("keydown", keyboard);
  window.removeEventListener("popstate", onPop);
  document.removeEventListener("visibilitychange", visibility);
  window.removeEventListener("pagehide", suspend);
  window.removeEventListener("pageshow", visibility);
  motionQuery?.removeEventListener("change", syncMotion);
});
</script>
<template>
  <div class="cw-background" :data-ready="waveReady ? true : undefined">
    <canvas ref="canvas" aria-hidden="true"></canvas
    ><svg class="cw-fallback-wave" aria-hidden="true" viewBox="0 0 1200 600">
      <path d="M-100 400 Q400 150 1300 340" />
    </svg>
  </div>
  <header class="cw-top">
    <div class="cw-brand">
      <slot name="header" :model="model">
        <img
          v-if="ui.brand.logoUrl"
          :src="ui.brand.logoUrl"
          :alt="ui.brand.logoAlt ?? ''"
          width="40"
          height="40"
        />
        <a
          :href="model.rootHref"
          @click="navigateLink($event, model.rootHref, model.rootDataHref)"
          >{{ ui.brand.name ?? model.title }}</a
        ></slot
      >
    </div>
    <nav class="cw-location" :aria-label="ui.labels.breadcrumb">
      <a :href="model.rootHref" @click="navigateLink($event, model.rootHref, model.rootDataHref)">{{
        ui.labels.home
      }}</a
      ><template v-for="crumb in model.breadcrumbs" :key="crumb.href">
        /
        <a :href="crumb.href" @click="navigateLink($event, crumb.href, crumb.dataHref)">{{
          crumb.name
        }}</a></template
      >
    </nav>
    <div class="cw-clock" v-if="ready">{{ clock }}</div>
  </header>
  <main class="cw-stage" data-framework="vue" :aria-busy="busy">
    <h1 class="cw-sr">{{ label(ui, "filesIn", { path: model.path || "/" }) }}</h1>
    <nav class="cw-rail" :aria-label="ui.labels.categories" :hidden="!ready">
      <div class="cw-categories" role="tablist">
        <button
          v-for="item in model.categories"
          :key="item.id"
          role="tab"
          :id="'cw-tab-' + item.id"
          aria-controls="cw-panel"
          :aria-selected="category === item.id"
          :tabindex="category === item.id ? 0 : -1"
          :class="['cw-category', { 'cw-active': category === item.id }]"
          @click="
            category = item.id;
            selected = null;
          "
          :disabled="!complete"
        >
          <span v-html="item.svg"></span><span>{{ item.label }}</span
          ><small>{{
            entries.filter((entry) => membership(entry).includes(item.id)).length
          }}</small>
        </button>
      </div>
    </nav>
    <section
      class="cw-browser"
      id="cw-panel"
      role="tabpanel"
      :aria-labelledby="'cw-tab-' + category"
    >
      <div class="cw-list-head">
        <div class="cw-directory">
          <h2>{{ heading }}</h2>
          <span data-cw-count>{{
            label(ui, "items", { count: complete ? rows.length : entries.length })
          }}</span>
        </div>
        <label class="cw-search"
          ><span>{{ ui.labels.search }}</span
          ><input ref="search" type="search" v-model="query" :disabled="!ready || !complete"
        /></label>
        <button
          ref="archiveTrigger"
          v-if="model.searchQueryHref"
          :disabled="!ready"
          @click="archiveOpen = true"
        >
          {{ ui.labels.searchArchive }}
        </button>
      </div>
      <div
        class="cw-list-scroll"
        :data-virtual="virtual"
        ref="listScroll"
        @scroll="scrollTop = $event.currentTarget.scrollTop"
      >
        <ul class="cw-files">
          <li v-if="model.parentHref" class="cw-row">
            <a
              :href="model.parentHref"
              @click="navigateLink($event, model.parentHref, model.parentDataHref)"
              class="cw-entry"
              >../</a
            >
          </li>
          <li v-if="start" aria-hidden="true" :style="{ height: offsets[start] + 'px' }"></li>
          <li
            v-for="(entry, visibleIndex) in visibleRows"
            :key="entry.id"
            :ref="(node) => setNode(entry.id, node)"
            :aria-posinset="start + visibleIndex + 1"
            :aria-setsize="rows.length"
            :class="['cw-row', { 'cw-selected': active?.id === entry.id }]"
            data-cw-entry
            :data-custom-columns="Boolean(model.ui?.columns)"
            :data-id="entry.id"
          >
            <a
              v-if="entry.href"
              class="cw-entry"
              :href="safeHref(entry)"
              :target="entry.exitsExplorer ? '_blank' : undefined"
              :rel="entry.exitsExplorer ? 'noopener' : undefined"
              @click="openEntry($event, entry)"
              @focus="selected = entry.id"
              ><slot name="row" :model="model" :entry="entry" :selected="selected === entry.id"
                ><span
                  class="cw-entry-icon"
                  aria-hidden="true"
                  v-html="
                    entryIcon(
                      entry.kind === 'symlink'
                        ? 'link'
                        : directoryLike(entry)
                          ? 'directory'
                          : 'file',
                    )
                  "
                ></span>
                <span class="cw-entry-label">
                  <template
                    v-for="column in ui.columns"
                    :key="typeof column === 'string' ? column : column.dataKey"
                    ><span v-if="column === 'name'" class="cw-name"
                      >{{ entry.name }}{{ directoryLike(entry) ? "/" : "" }}</span
                    >
                    <span v-if="entry.link && column === 'name'" class="cw-target">{{
                      entry.link.target
                    }}</span>
                    <span v-if="column === 'size'" class="cw-row-meta"
                      >{{
                        entry.link?.unavailable
                          ? ui.labels.unavailable
                          : ui.labels[entry.kind === "symlink" ? "link" : entry.kind]
                      }}
                      · {{ directoryLike(entry) ? ui.labels.folder : size(entry.size) }}</span
                    >
                    <span v-if="column === 'modified'" class="cw-row-date"
                      >{{ ui.labels.modified }}
                      {{ formattedDate(entry.modifiedAt, ui, ready) }}</span
                    ><span v-if="typeof column === 'object'" class="cw-data-value"
                      >{{ column.label }}: {{ publicDataValue(entry.data?.[column.dataKey]) }}</span
                    ></template
                  >
                </span></slot
              ></a
            ><span v-else class="cw-entry cw-unavailable"
              ><slot name="row" :model="model" :entry="entry" :selected="selected === entry.id">{{
                entry.name
              }}</slot></span
            >
            <span
              v-if="ui.actions.length || $slots.actions"
              data-dirwell-actions
              class="cw-row-actions"
            >
              <slot
                name="actions"
                :model="model"
                :entry="entry"
                :selected="selected === entry.id"
              />
              <template v-for="action in ui.actions" :key="action">
                <a
                  v-if="
                    action === 'download' &&
                    entry.href &&
                    !directoryLike(entry) &&
                    !entry.link?.unavailable
                  "
                  :href="safeHref(entry)"
                  download
                  >{{ ui.labels.download }}</a
                >
                <button
                  v-else-if="action !== 'download'"
                  :disabled="!ready || (action === 'copy-link' && !entry.href)"
                  :aria-label="
                    (action === 'copy-link' ? ui.labels.copyLink : ui.labels.copyPath) +
                    ': ' +
                    entry.name
                  "
                  @click="
                    async () => {
                      try {
                        await copyEntryAction(action, entry);
                        error = ui.labels.copied;
                        failure = null;
                      } catch {
                        error = ui.labels.copyError;
                        failure = 'copy';
                      }
                    }
                  "
                >
                  {{ action === "copy-link" ? ui.labels.copyLink : ui.labels.copyPath }}
                </button>
              </template>
            </span>
          </li>
          <li
            v-if="end < rows.length"
            aria-hidden="true"
            :style="{ height: offsets[rows.length] - offsets[end] + 'px' }"
          ></li>
        </ul>
        <p class="cw-empty" v-if="!rows.length && !busy">
          {{ model.total === 0 ? ui.labels.empty : ui.labels.noMatches }}
        </p>
      </div>
    </section>
    <aside class="cw-detail" v-if="ready && active">
      <h2>{{ active.name }}</h2>
      <p v-if="ui.columns.includes('size')">
        {{ ui.labels[active.kind === "symlink" ? "link" : active.kind] }} ·
        {{ directoryLike(active) ? ui.labels.folder : size(active.size) }}
      </p>
      <p v-if="ui.columns.includes('modified')">
        {{ formattedDate(active.modifiedAt, ui, ready) }}
      </p>
      <p v-if="active.link">{{ active.link.target }}</p>
    </aside>
    <p role="status" aria-live="polite">{{ busy ? ui.labels.loading : error }}</p>
    <button v-if="failure && failure !== 'copy'" :disabled="busy" @click="retry">
      {{ ui.labels.retry }}
    </button>
    <a v-if="failure === 'folder' && retryRequest" :href="retryRequest[1]">{{
      ui.labels.openNative
    }}</a>
    <nav v-if="model.page?.count > 1 && !complete" :aria-label="ui.labels.pagination">
      <a v-if="model.page.previousHref" :href="model.page.previousHref" rel="prev">{{
        ui.labels.previous
      }}</a>
      {{ label(ui, "page", { page: model.page.number, pages: model.page.count }) }}
      <a v-if="model.page.nextHref" :href="model.page.nextHref" rel="next">{{ ui.labels.next }}</a>
    </nav>
  </main>
  <footer class="cw-bottom" ref="footerElement">
    <div :class="ui.brand.footerText || $slots.footer ? 'cw-custom-footer' : 'cw-key-help'">
      <slot name="footer" :model="model"
        ><template v-if="ui.brand.footerText"
          ><a v-if="ui.brand.footerUrl" :href="ui.brand.footerUrl">{{ ui.brand.footerText }}</a
          ><span v-else>{{ ui.brand.footerText }}</span></template
        ><template v-else>{{ ui.labels.crosswaveKeyboardHelp }}</template></slot
      >
    </div>
    <div class="cw-controller" v-if="pad">{{ ui.labels.controller }}</div>
    <label class="cw-appearance"
      >{{ ui.labels.color
      }}<select v-model="color" :disabled="!ready">
        <option v-for="name in Object.keys(colors)" :key="name" :value="name">
          {{ ui.labels[name] }}
        </option>
      </select></label
    ><button class="cw-motion" :disabled="!ready" @click="paused = !paused">
      {{ paused ? ui.labels.resumeMotion : ui.labels.pauseMotion }}
    </button>
  </footer>
  <dialog
    v-if="archiveOpen"
    ref="archiveDialog"
    class="cw-archive"
    @close="archiveOpen = false"
    @keydown.esc.prevent.stop="archiveOpen = false"
  >
    <h2>{{ ui.labels.searchArchive }}</h2>
    <input
      ref="archiveInput"
      type="search"
      v-model="archiveQuery"
      :aria-label="ui.labels.archiveSearchInput"
    />
    <p role="status">{{ archiveStatus }}</p>
    <button v-if="archiveFailed" @click="searchArchive">{{ ui.labels.retry }}</button>
    <ul>
      <li v-for="record in archiveRows" :key="record.path">
        <a
          v-if="record.href"
          :href="record.href"
          :target="record.exitsExplorer ? '_blank' : undefined"
          :rel="record.exitsExplorer ? 'noopener' : undefined"
          >{{ record.path }}</a
        >
        <span v-else>{{ record.path }}</span>
      </li>
    </ul>
    <button @click="archiveOpen = false">{{ ui.labels.close }}</button>
  </dialog>
</template>
