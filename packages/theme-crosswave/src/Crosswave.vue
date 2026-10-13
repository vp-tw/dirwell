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
import { useGamepad } from "@vueuse/core";
import { loadListing } from "@dirwell/core/client";
import {
  fetchThemePage,
  applyThemeMetadata,
  restoreThemePage,
} from "../../shared-theme/src/navigation.ts";
import { entryIcon } from "../../shared-theme/src/icons.ts";
import { directoryLike, size, modified } from "../../shared-theme/src/records.ts";
import { createWave } from "./wave.mjs";
const props = defineProps({ model: { type: Object, required: true } }),
  model = shallowRef(restoreThemePage(props.model, Boolean(import.meta.hot))),
  entries = shallowRef(model.value.entries);
const query = ref(""),
  category = ref("all"),
  selected = ref(null),
  ready = ref(false),
  busy = ref(false),
  error = ref(""),
  color = ref(props.model.color),
  paused = ref(!props.model.backgroundMotion),
  clock = ref(""),
  pad = ref(false),
  waveReady = ref(false),
  pendingUpdates = ref(null),
  canvas = ref(),
  search = ref();
const complete = computed(() => entries.value.length === model.value.total),
  membership = (entry) =>
    Array.isArray(entry.presentation?.categories) ? entry.presentation.categories : [];
const rows = computed(() =>
    entries.value.filter(
      (entry) =>
        (category.value === "all" || membership(entry).includes(category.value)) &&
        `${entry.name} ${entry.link?.target ?? ""}`
          .toLocaleLowerCase()
          .includes(query.value.trim().toLocaleLowerCase()),
    ),
  ),
  active = computed(() => rows.value.find((entry) => entry.id === selected.value) ?? rows.value[0]),
  heading = computed(
    () => model.value.categories.find((item) => item.id === category.value)?.label ?? "All files",
  );
const nodes = new Map();
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
    if (token === navigation && !local.signal.aborted)
      error.value = "Could not load complete directory data. Native page links remain available.";
  } finally {
    if (token === navigation) busy.value = false;
  }
}
async function openFolder(dataHref, url, push, refresh = false) {
  const token = ++navigation;
  abort?.abort();
  const local = (abort = new AbortController());
  busy.value = true;
  error.value = "";
  try {
    const next = await fetchThemePage(dataHref, url, "crosswave", local.signal, refresh);
    let nextEntries = next.entries;
    if (refresh && next.manifestHref && nextEntries.length !== next.total)
      nextEntries = (
        await loadListing(next.manifestHref, { signal: local.signal, cache: "no-store" })
      ).entries;
    if (token !== navigation || local.signal.aborted || disposed) return;
    model.value = next;
    entries.value = nextEntries;
    if (!refresh) {
      query.value = "";
      selected.value = null;
      category.value = "all";
    }
    if (push) history.pushState({ dataHref: next.dataHref }, "", url);
    applyThemeMetadata(next, url);
    await loadComplete();
  } catch (cause) {
    if (token === navigation && !local.signal.aborted)
      error.value = "Could not open the folder. Its native link remains available.";
  } finally {
    if (token === navigation) busy.value = false;
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
async function openEntry(event, entry) {
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
  const entry = rows.value[Math.max(0, Math.min(rows.value.length - 1, index))];
  if (!entry) return;
  selected.value = entry.id;
  await nextTick();
  const node = nodes.get(entry.id);
  node?.querySelector("a")?.focus({ preventScroll: true });
  node?.scrollIntoView({ block: "nearest" });
}
function stepCategory(delta) {
  const items = model.value.categories,
    index = items.findIndex((item) => item.id === category.value);
  category.value = items[(index + delta + items.length) % items.length].id;
  selected.value = null;
}
function confirm() {
  if (!active.value || busy.value) return;
  const anchor = nodes.get(active.value.id)?.querySelector("a");
  anchor?.click();
}
function parent() {
  if (model.value.parentHref) {
    if (location.protocol === "file:") location.href = model.value.parentHref;
    else
      openFolder(
        model.value.parentDataHref,
        new URL(model.value.parentHref, document.baseURI).href,
        true,
      );
  }
}
function keyboard(event) {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
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
    ? openFolder(event.state.dataHref, location.href, false)
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
  history.replaceState({ dataHref: new URL(model.value.dataHref, document.baseURI).href }, "");
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
    (clock.value = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
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
    updates.onerror = () => (error.value = "Live updates disconnected. Refresh to retry.");
    updates.onopen = () => {
      if (error.value.startsWith("Live updates")) error.value = "";
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
  disposed = true;
  document.body.removeAttribute("data-cw-enhanced");
  abort?.abort();
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
        <a
          :href="model.rootHref"
          @click="navigateLink($event, model.rootHref, model.rootDataHref)"
          >{{ model.title }}</a
        ></slot
      >
    </div>
    <nav class="cw-location" aria-label="Breadcrumb">
      <a :href="model.rootHref" @click="navigateLink($event, model.rootHref, model.rootDataHref)"
        >Home</a
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
    <h1 class="cw-sr">Files in {{ model.path || "/" }}</h1>
    <nav class="cw-rail" aria-label="File categories" :hidden="!ready">
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
          <span data-cw-count>{{ complete ? rows.length : entries.length }} items</span>
        </div>
        <label class="cw-search"
          >Search<input ref="search" type="search" v-model="query" :disabled="!ready || !complete"
        /></label>
      </div>
      <div class="cw-list-scroll">
        <ul class="cw-files">
          <li v-if="model.parentHref" class="cw-row">
            <a
              :href="model.parentHref"
              @click="navigateLink($event, model.parentHref, model.parentDataHref)"
              class="cw-entry"
              >../</a
            >
          </li>
          <li
            v-for="entry in rows"
            :key="entry.id"
            :ref="(node) => (node ? nodes.set(entry.id, node) : nodes.delete(entry.id))"
            :class="['cw-row', { 'cw-selected': active?.id === entry.id }]"
            data-cw-entry
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
                  <span class="cw-name">{{ entry.name }}{{ directoryLike(entry) ? "/" : "" }}</span>
                  <span v-if="entry.link" class="cw-target">{{ entry.link.target }}</span>
                  <span class="cw-row-meta"
                    >{{ entry.link?.unavailable ? "Target unavailable" : entry.kind }} ·
                    {{ directoryLike(entry) ? "Folder" : size(entry.size) }}</span
                  >
                  <span class="cw-row-date">Modified {{ modified(entry.modifiedAt) }}</span>
                </span></slot
              ></a
            ><span v-else class="cw-entry cw-unavailable"
              ><slot name="row" :model="model" :entry="entry" :selected="selected === entry.id">{{
                entry.name
              }}</slot></span
            >
          </li>
        </ul>
        <p class="cw-empty" v-if="!rows.length">No matching files.</p>
      </div>
    </section>
    <aside class="cw-detail" v-if="ready && active">
      <h2>{{ active.name }}</h2>
      <p>{{ active.kind }} · {{ directoryLike(active) ? "Folder" : size(active.size) }}</p>
      <p>{{ modified(active.modifiedAt) }}</p>
      <p v-if="active.link">{{ active.link.target }}</p>
    </aside>
    <p role="status" aria-live="polite">{{ busy ? "Loading…" : error }}</p>
    <nav v-if="model.page?.count > 1 && !complete" aria-label="Pagination">
      <a v-if="model.page.previousHref" :href="model.page.previousHref" rel="prev">Previous</a> Page
      {{ model.page.number }} of {{ model.page.count }}
      <a v-if="model.page.nextHref" :href="model.page.nextHref" rel="next">Next</a>
    </nav>
  </main>
  <footer class="cw-bottom">
    <div class="cw-key-help">
      <slot name="footer" :model="model"
        >Arrow keys navigate · Enter confirms · Backspace returns</slot
      >
    </div>
    <div class="cw-controller" v-if="pad">Controller · Confirm / Back</div>
    <label class="cw-appearance"
      >Color<select v-model="color" :disabled="!ready">
        <option v-for="name in Object.keys(colors)" :key="name">{{ name }}</option>
      </select></label
    ><button class="cw-motion" :disabled="!ready" @click="paused = !paused">
      {{ paused ? "Resume motion" : "Pause motion" }}
    </button>
  </footer>
</template>
