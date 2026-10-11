(() => {
  "use strict";
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  // Registered before first paint for cross-document navigation and BFCache restores.
  for (const name of ["pageswap", "pagereveal"]) {
    addEventListener(name, (event) => {
      const transition = event.viewTransition;
      if (!transition) return;
      // A skipped or interrupted animation must not reject normal file navigation.
      transition.ready.catch(() => {});
      if (reduced.matches || root.dataset.cwTransitions === "false") transition.skipTransition();
    });
  }
  // Included in the theme's private runtime closure, never installed as a global API.
  function createCrosswaveNavigator({ main, reduced, getState, commit }) {
    const rootUrl = new URL(main.dataset.cwRoot, document.baseURI);
    const initialUrl = new URL(location.href);
    initialUrl.hash = "";
    const local = initialUrl.protocol === "file:";
    const owner = rootUrl.href;
    const scopePath = rootUrl.pathname.endsWith("/")
      ? rootUrl.pathname
      : new URL(".", rootUrl).pathname;
    let current = {
      url: initialUrl.href,
      asset: new URL(main.dataset.cwPage, document.baseURI).href,
      path: main.dataset.cwPath,
    };
    const recent = new Map();
    const historyViews = new Map();
    const savedEntry = history.state?.dirwellCrosswave;
    let index =
        savedEntry?.owner === owner && Number.isInteger(savedEntry.index) ? savedEntry.index : 0,
      request = 0,
      pending,
      animations = [];
    const notice = document.createElement("div");
    notice.className = "cw-navigation-notice";
    notice.setAttribute("role", "status");
    notice.hidden = true;
    document.body.append(notice);
    const allowed = (url) =>
      url.protocol === rootUrl.protocol &&
      url.host === rootUrl.host &&
      url.pathname.startsWith(scopePath);
    const absoluteLinks = (scope, base) => {
      for (const link of scope.querySelectorAll("a[href]")) {
        const url = new URL(link.getAttribute("href"), base);
        if (local && url.pathname.endsWith("/")) url.pathname += "index.html";
        link.href = url.href;
      }
      for (const link of scope.querySelectorAll("[data-cw-page]"))
        link.dataset.cwPage = new URL(link.dataset.cwPage, base).href;
    };
    absoluteLinks(document, document.baseURI);
    const ownsCurrentEntry = () => {
      const entry = history.state?.dirwellCrosswave;
      return entry?.owner === owner && entry.index === index && entry.route.path === current.path;
    };
    const state = (route = current, position = index, view = getState()) => ({
      ...history.state,
      dirwellCrosswave: { owner, route, index: position, view },
    });
    try {
      history.replaceState(state(), "");
    } catch {
      return;
    } // Restricted hosts retain ordinary links and native transitions.

    const stopAnimations = () => {
      for (const { animation, layer } of animations) {
        animation.cancel();
        layer?.remove();
      }
      animations = [];
    };
    const show = (text, actions = []) => {
      notice.replaceChildren(document.createTextNode(text));
      for (const { label, run, href } of actions) {
        const action = document.createElement(href ? "a" : "button");
        action.textContent = label;
        if (href) action.href = href;
        else {
          action.type = "button";
          action.addEventListener("click", run);
        }
        notice.append(action);
      }
      notice.hidden = false;
    };
    const load = (route, signal) =>
      new Promise((resolve, reject) => {
        const asset = new URL(route.asset);
        if (
          !allowed(asset) ||
          !/^crosswave-page-[a-f0-9]{24}\.js$/.test(asset.pathname.split("/").at(-1))
        ) {
          reject(new Error("Unsupported folder data"));
          return;
        }
        const script = document.createElement("script");
        script.async = true;
        // Revalidate on every visit: a watcher may have rebuilt this directory.
        asset.searchParams.set("cw-visit", String(Date.now()));
        script.src = asset.href;
        let payload;
        const received = (event) => {
          if (document.currentScript !== script) return;
          const data = event.detail;
          if (
            data?.version === 1 &&
            data.id === asset.pathname.split("/").at(-1) &&
            data.path === route.path &&
            typeof data.html === "string" &&
            typeof data.outputName === "string" &&
            (data.baseHref === null || typeof data.baseHref === "string")
          )
            payload = data;
        };
        const cleanup = () => {
          clearTimeout(timer);
          removeEventListener("dirwell:crosswave-page", received);
          signal.removeEventListener("abort", aborted);
          script.remove();
          script.onload = script.onerror = null;
        };
        const fail = (error) => {
          cleanup();
          reject(error);
        };
        const aborted = () => fail(new DOMException("Navigation superseded", "AbortError"));
        const timer = setTimeout(() => fail(new Error("Folder loading timed out")), 8000);
        script.onerror = () => fail(new Error("Folder data is unavailable"));
        script.onload = () => {
          cleanup();
          try {
            if (!payload) {
              reject(new Error("Folder data is incompatible"));
              return;
            }
            const doc = new DOMParser().parseFromString(payload.html, "text/html");
            const required = [
              "[data-cw-root]",
              ".cw-files",
              ".cw-directory",
              ".cw-location",
              ".cw-stage > h1",
              ".cw-directory > :first-child",
              ".cw-empty",
            ];
            if (required.some((selector) => !doc.querySelector(selector))) {
              reject(new Error("Folder data is incomplete"));
              return;
            }
            if (
              doc.querySelector("[data-cw-root]").dataset.cwCategoryConfig !==
              main.dataset.cwCategoryConfig
            )
              throw new Error("Folder category configuration changed; open normally to reload");
            const url = new URL(route.url);
            if (local && url.pathname.endsWith("/")) url.pathname += payload.outputName;
            const base = new URL(payload.baseHref ?? ".", url);
            absoluteLinks(doc, base);
            for (const node of doc.head.querySelectorAll(
              '[data-dirwell-metadata][property="og:image"], [data-dirwell-metadata][name="twitter:image"], link[data-dirwell-metadata]',
            )) {
              const attribute = node.tagName === "LINK" ? "href" : "content";
              const value = node.getAttribute(attribute);
              if (value) node.setAttribute(attribute, new URL(value, base).href);
            }
            resolve({ doc, route: { ...route, url: url.href } });
          } catch (error) {
            reject(error);
          }
        };
        addEventListener("dirwell:crosswave-page", received);
        signal.addEventListener("abort", aborted, { once: true });
        try {
          document.head.append(script);
        } catch (error) {
          fail(error);
        }
      });
    const address = (route) => {
      if (!local) return route.url;
      const url = new URL(initialUrl);
      const relative = (value) => new URL(value).pathname.slice(scopePath.length);
      url.hash = `cw=${encodeURIComponent(relative(route.url))}&cw-data=${encodeURIComponent(relative(route.asset))}&cw-path=${encodeURIComponent(route.path)}`;
      return url.href;
    };
    const snapshot = (element) => {
      const rect = element.getBoundingClientRect();
      const viewportBottom = Math.min(
        innerHeight,
        document.querySelector(".cw-bottom").getBoundingClientRect().top,
      );
      const clone = element.cloneNode(false);
      if (element.matches(".cw-browser")) {
        clone.append(element.querySelector(".cw-list-head").cloneNode(true));
        const source = element.querySelector(".cw-list-scroll");
        const scroll = source.cloneNode(false),
          list = element.querySelector(".cw-files").cloneNode(false);
        const filesRect = element.querySelector(".cw-files").getBoundingClientRect();
        const sourceRect = source.getBoundingClientRect();
        const visibleTop = Math.max(0, sourceRect.top);
        const visibleBottom = Math.min(viewportBottom, sourceRect.bottom);
        list.style.cssText = `position:relative;height:${source.scrollHeight}px`;
        // Clone visible rows only; large directories must not duplicate their entire DOM for motion.
        for (const row of element.querySelectorAll(".cw-row:not([hidden])")) {
          const rowRect = row.getBoundingClientRect();
          if (rowRect.bottom < visibleTop) continue;
          if (rowRect.top > visibleBottom) break;
          const copy = row.cloneNode(true);
          copy.style.cssText = `position:absolute;left:0;right:0;top:${rowRect.top - filesRect.top}px;width:100%`;
          list.append(copy);
        }
        scroll.append(list, element.querySelector(".cw-empty").cloneNode(true));
        clone.append(scroll);
        clone._scroll = { element: scroll, top: source.scrollTop };
      } else clone.replaceChildren(...[...element.childNodes].map((node) => node.cloneNode(true)));
      for (const node of [clone, ...clone.querySelectorAll("*")]) {
        for (const name of node.getAttributeNames())
          if (name.startsWith("data-cw-")) node.removeAttribute(name);
      }
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      clone.setAttribute("aria-hidden", "true");
      clone.inert = true;
      clone.classList.add("cw-transition-layer");
      clone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;z-index:3;pointer-events:none;view-transition-name:none`;
      clone.style.overflow = "hidden";
      clone.style.clipPath = `inset(${Math.max(0, -rect.top)}px 0 ${Math.max(0, rect.bottom - viewportBottom)}px 0)`;
      document.body.append(clone);
      if (clone._scroll) clone._scroll.element.scrollTop = clone._scroll.top;
      return clone;
    };
    const exchange = (loaded, view, direction, writeHistory, position) => {
      const moving =
        !reduced.matches &&
        document.documentElement.dataset.cwTransitions !== "false" &&
        typeof main.animate === "function";
      stopAnimations();
      const elements = [
        document.querySelector(".cw-browser"),
        document.querySelector(".cw-detail"),
      ];
      const layers = moving
        ? elements.map((element) =>
            element.hidden || !element.getBoundingClientRect().height ? null : snapshot(element),
          )
        : [];
      try {
        if (writeHistory) {
          // Save the view at departure, including edits made while a request was pending.
          if (ownsCurrentEntry()) history.replaceState(state(), "");
          history.pushState(state(loaded.route, position, view ?? {}), "", address(loaded.route));
          for (const key of historyViews.keys())
            if (key > position || key < position - history.length + 1) historyViews.delete(key);
        }
        commit(loaded.doc, view);
        current = loaded.route;
        index = position;
        historyViews.set(index, { path: current.path, view: getState() });
        try {
          history.replaceState(state(), "");
        } catch {}
      } catch (error) {
        layers.forEach((layer) => layer?.remove());
        throw error;
      }
      if (!moving) return;
      try {
        elements.forEach((element, i) => {
          const layer = layers[i];
          if (layer) {
            const animation = layer.animate(
              [
                { opacity: 1, transform: "translateX(0)" },
                { opacity: 0, transform: `translateX(${-direction * 24}px)` },
              ],
              { duration: 140, easing: "ease-out" },
            );
            animations.push({ animation, layer });
            animation.finished.then(
              () => layer.remove(),
              () => layer.remove(),
            );
          }
          if (!element.hidden) {
            const animation = element.animate(
              [
                { opacity: 0.25, transform: `translateX(${direction * 28}px)` },
                { opacity: 1, transform: "translateX(0)" },
              ],
              { duration: 240, easing: "cubic-bezier(.16,1,.3,1)" },
            );
            animations.push({ animation });
            animation.finished.catch(() => {});
          }
        });
      } catch {
        stopAnimations();
        layers.forEach((layer) => layer?.remove());
      }
    };
    const navigate = async (route, { view, pop = false, position = index + 1 } = {}) => {
      historyViews.set(index, { path: current.path, view: getState() });
      if (pop && historyViews.get(position)?.path === route.path)
        view = historyViews.get(position).view;
      const ticket = ++request;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      if (!pop) {
        const entry = history.state?.dirwellCrosswave;
        position =
          (entry?.owner === owner && Number.isInteger(entry.index) ? entry.index : index) + 1;
        recent.delete(current.path);
        recent.set(current.path, getState());
        if (recent.size > 32) recent.delete(recent.keys().next().value);
        if (view === undefined) view = recent.get(route.path);
        try {
          if (ownsCurrentEntry()) history.replaceState(state(), "");
        } catch {
          location.assign(route.url);
          return;
        }
      }
      const direction = pop
        ? Math.sign(position - index) || 1
        : current.path && (current.path.startsWith(`${route.path}/`) || route.path === "")
          ? -1
          : 1;
      main.setAttribute("aria-busy", "true");
      const delay = setTimeout(() => {
        if (ticket === request)
          show("Loading folder…", [{ label: "Cancel", run: () => controller.abort() }]);
      }, 120);
      try {
        const loaded = await load(route, controller.signal);
        if (ticket !== request || controller.signal.aborted) return;
        exchange(loaded, view, direction, !pop, position);
        notice.hidden = true;
      } catch (error) {
        if (ticket !== request) return;
        if (pop || !ownsCurrentEntry()) {
          // The browser has already changed its address: reload that exact destination on failure.
          if (local) location.replace(route.url);
          else location.reload();
          return;
        }
        if (error.name === "AbortError") {
          notice.hidden = true;
          return;
        }
        show("Could not open this folder. Your current files are still available.", [
          { label: "Retry", run: () => navigate(route, { view }) },
          { label: "Open normally", href: route.url },
        ]);
      } finally {
        clearTimeout(delay);
        if (ticket === request) {
          main.removeAttribute("aria-busy");
          pending = null;
        }
      }
    };
    document.addEventListener("click", (event) => {
      if (event.target.closest?.(".cw-skip")) {
        event.preventDefault();
        const panel = document.querySelector("#cw-panel");
        panel.tabIndex = -1;
        panel.focus({ preventScroll: true });
        return;
      }
      const link = event.target.closest?.("a[data-cw-navigation][data-cw-page]");
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target ||
        link.hasAttribute("download")
      )
        return;
      const url = new URL(link.href),
        asset = new URL(link.dataset.cwPage);
      if (!allowed(url) || !allowed(asset) || url.hash) return;
      event.preventDefault();
      if (link.dataset.cwPath === current.path) {
        pending?.abort();
        notice.hidden = true;
        return;
      }
      navigate({ url: url.href, asset: asset.href, path: link.dataset.cwPath });
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        !event.isComposing &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.target.matches?.("input,textarea,select,[contenteditable]")
      ) {
        pending?.abort();
        notice.hidden = true;
      }
    });
    addEventListener("popstate", (event) => {
      const entry = event.state?.dirwellCrosswave;
      if (entry?.owner !== owner || !allowed(new URL(entry.route.url))) {
        location.reload();
        return;
      }
      navigate(entry.route, { view: entry.view, pop: true, position: entry.index });
    });
    addEventListener("pagehide", () => {
      ++request;
      pending?.abort();
      main.removeAttribute("aria-busy");
      notice.hidden = true;
      stopAnimations();
    });
    reduced.addEventListener("change", () => {
      if (reduced.matches) stopAnimations();
    });
    if (local && initialUrl.href !== location.href) {
      const hash = new URLSearchParams(location.hash.slice(1));
      if (hash.has("cw") && hash.has("cw-data") && hash.has("cw-path")) {
        const url = new URL(hash.get("cw"), rootUrl),
          asset = new URL(hash.get("cw-data"), rootUrl);
        if (allowed(url) && allowed(asset))
          navigate(
            { url: url.href, asset: asset.href, path: hash.get("cw-path") },
            {
              pop: true,
              position: index,
              view: savedEntry?.owner === owner ? savedEntry.view : undefined,
            },
          );
      }
    }
    return {
      cancel() {
        if (!pending) return false;
        pending.abort();
        notice.hidden = true;
        return true;
      },
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const main = document.querySelector("[data-cw-root]");
    if (!main) return;
    document.body.dataset.cwEnhanced = "true";
    const key = `dirwell:crosswave:${new URL(main.dataset.cwRoot, document.baseURI).pathname}`;
    const read = (name) => {
      try {
        return localStorage.getItem(`${key}:${name}`);
      } catch {
        return null;
      }
    };
    const write = (name, value) => {
      try {
        localStorage.setItem(`${key}:${name}`, value);
      } catch {}
    };
    const colors = {
      azure: [0.17, 0.31, 0.52],
      violet: [0.36, 0.25, 0.49],
      amber: [0.44, 0.3, 0.1],
      rose: [0.44, 0.25, 0.33],
      jade: [0.13, 0.37, 0.32],
      graphite: [0.26, 0.3, 0.38],
    };
    const savedColor = read("color");
    if (Object.hasOwn(colors, savedColor)) root.dataset.cwColor = savedColor;
    let paused = root.dataset.cwMotion === "false" || read("paused") === "true";
    let rows = [...document.querySelectorAll("[data-cw-entry]")];
    const tabs = [...document.querySelectorAll("[data-cw-category]")];
    const search = document.querySelector("#cw-search");
    const clear = document.querySelector("[data-cw-clear]");
    const empty = document.querySelector("[data-cw-empty]");
    const status = document.querySelector("[data-cw-status]");
    const detail = document.querySelector(".cw-detail");
    const belongs = (row, id) => row.dataset.cwCategories.split(" ").includes(id);
    let category = tabs[0].dataset.cwCategory,
      selected = null,
      composing = false,
      searchTimer;
    const visible = () => rows.filter((row) => !row.hidden);
    const select = (row, focus = false, reveal = true) => {
      if (selected) selected.classList.remove("cw-selected");
      selected = row;
      if (!row) {
        detail.hidden = true;
        return;
      }
      row.classList.add("cw-selected");
      const values = {
        name: "name",
        path: "path",
        size: "size",
        modified: "modified",
        status: "status",
      };
      for (const [field, data] of Object.entries(values))
        document.querySelector(`[data-cw-detail-${field}]`).textContent = row.dataset[data];
      const host = document.querySelector("[data-cw-detail-icon]");
      host.replaceChildren();
      const icon = row.querySelector(".cw-entry-icon svg");
      if (icon) host.append(icon.cloneNode(true));
      const link = row.querySelector("a");
      const open = document.querySelector("[data-cw-open]");
      open.hidden = !link;
      if (link) {
        open.href = link.href;
        open.textContent = row.dataset.status.includes("declared target")
          ? "Show declared target"
          : row.dataset.category === "folder"
            ? "Open folder"
            : "Open file";
        if (row.dataset.exits === "true") {
          open.target = "_blank";
          open.rel = "noopener";
          open.removeAttribute("data-cw-navigation");
          delete open.dataset.cwPage;
          delete open.dataset.cwPath;
        } else {
          open.removeAttribute("target");
          open.removeAttribute("rel");
          open.setAttribute("data-cw-navigation", "");
          open.dataset.cwPage = link.dataset.cwPage;
          open.dataset.cwPath = link.dataset.cwPath;
        }
      }
      detail.hidden = false;
      if (focus) {
        link?.focus({ preventScroll: true });
        if (reveal)
          row.scrollIntoView({
            block: "nearest",
            behavior: reduced.matches ? "instant" : "smooth",
          });
      }
    };
    const applyFilter = () => {
      const query = search.value.trim().toLocaleLowerCase();
      let count = 0;
      for (const row of rows) {
        row.hidden =
          !belongs(row, category) ||
          !`${row.dataset.name} ${row.dataset.path}`.toLocaleLowerCase().includes(query);
        if (!row.hidden) count++;
      }
      empty.hidden = count !== 0;
      empty.textContent = !rows.length
        ? "This folder is empty."
        : query
          ? `No files match “${search.value.trim()}”.`
          : "No files in this category.";
      document.querySelector("[data-cw-count]").textContent =
        `${count} ${count === 1 ? "item" : "items"}`;
      status.textContent = `${count} ${count === 1 ? "item" : "items"} shown`;
      clear.hidden = !search.value;
      if (!selected || selected.hidden) select(visible()[0] ?? null);
    };
    const setCategory = (next, focus = false, animate = true) => {
      category = next;
      for (const tab of tabs) {
        const active = tab.dataset.cwCategory === next;
        tab.classList.toggle("cw-active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active) {
          document.querySelector("[data-cw-heading]").textContent =
            tab.querySelector("span").textContent;
          document.querySelector("#cw-panel").setAttribute("role", "tabpanel");
          document.querySelector("#cw-panel").setAttribute("aria-labelledby", tab.id);
          if (focus) tab.focus({ preventScroll: true });
          const rail = document.querySelector(".cw-rail");
          rail.scrollTo({
            left: Math.max(0, tab.offsetLeft - tabs[0].offsetLeft),
            behavior: reduced.matches ? "instant" : "smooth",
          });
        }
      }
      selected = null;
      rows.forEach((row) => row.classList.remove("cw-selected"));
      applyFilter();
      if (animate) {
        main.classList.remove("cw-category-changing");
        void main.offsetWidth;
        main.classList.add("cw-category-changing");
      }
    };
    const moveCategory = (direction) => {
      const index = tabs.findIndex((tab) => tab.dataset.cwCategory === category);
      setCategory(tabs[(index + direction + tabs.length) % tabs.length].dataset.cwCategory, true);
    };
    const moveRow = (direction) => {
      const list = visible().filter((row) => row.querySelector("a"));
      if (!list.length) return;
      let index = list.indexOf(selected);
      index = index < 0 ? 0 : Math.max(0, Math.min(list.length - 1, index + direction));
      select(list[index], true);
    };
    for (const tab of tabs) {
      tab.addEventListener("click", () => setCategory(tab.dataset.cwCategory));
      const count = rows.filter((row) => belongs(row, tab.dataset.cwCategory)).length;
      tab.querySelector("small").textContent = String(count);
    }
    main.addEventListener("pointerover", (event) => {
      const row = event.target.closest?.("[data-cw-entry]");
      if (row && event.pointerType !== "touch") select(row);
    });
    main.addEventListener("focusin", (event) => {
      const row = event.target.closest?.("[data-cw-entry]");
      if (row) select(row);
    });
    search.addEventListener("compositionstart", () => {
      composing = true;
      clearTimeout(searchTimer);
    });
    search.addEventListener("compositionend", () => {
      composing = false;
      applyFilter();
    });
    search.addEventListener("input", () => {
      if (!composing) {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilter, 80);
      }
    });
    clear.addEventListener("click", () => {
      search.value = "";
      applyFilter();
      search.focus();
    });
    const activate = () => {
      const link = selected?.querySelector("a");
      if (!link) return;
      if (link.target !== "_blank") {
        link.click();
        return;
      }
      // Controller polling does not necessarily grant a browser user gesture.
      // Detach the blank tab before loading source content, preserving opener isolation.
      const tab = window.open("about:blank", "_blank");
      if (tab) {
        tab.opener = null;
        tab.location.replace(link.href);
      } else {
        link.focus({ preventScroll: true });
        status.classList.remove("cw-sr");
        status.classList.add("cw-notice");
        status.textContent =
          "Your browser blocked the new tab. Press Enter or click the file to open it.";
      }
    };
    let navigation;
    const back = () => {
      if (!navigation?.cancel()) document.querySelector("[data-cw-parent]")?.click();
    };
    const editing = () =>
      document.activeElement?.matches("input,textarea,select,[contenteditable=true]");
    document.addEventListener("keydown", (event) => {
      if (
        event.isComposing ||
        event.keyCode === 229 ||
        composing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (editing()) {
        if (event.key === "Escape" && document.activeElement === search) {
          search.value = "";
          applyFilter();
          search.blur();
          selected?.querySelector("a")?.focus();
        }
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        moveCategory(event.key === "ArrowLeft" ? -1 : 1);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        moveRow(event.key === "ArrowUp" ? -1 : 1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        if (document.activeElement?.matches("[role=tab]")) {
          setCategory((event.key === "Home" ? tabs[0] : tabs.at(-1)).dataset.cwCategory, true);
        } else {
          const list = visible().filter((row) => row.querySelector("a"));
          select(event.key === "Home" ? list[0] : list.at(-1), true);
        }
      } else if (event.key === "Backspace") {
        event.preventDefault();
        back();
      } else if (event.key === "/") {
        event.preventDefault();
        search.focus();
      } else if (event.key === "Enter" && document.activeElement?.matches("[role=tab]")) {
        event.preventDefault();
        selected?.querySelector("a")?.focus();
      }
    });
    for (const selector of [
      ".cw-rail",
      ".cw-search",
      ".cw-clock",
      ".cw-key-help",
      ".cw-appearance",
    ])
      document.querySelector(selector).hidden = false;
    const clock = document.querySelector(".cw-clock");
    const updateClock = () => {
      const now = new Date();
      clock.dateTime = now.toISOString();
      clock.textContent = new Intl.DateTimeFormat(undefined, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(now);
    };
    updateClock();
    let clockTimer = setInterval(updateClock, 30000);
    const colorSelect = document.querySelector("#cw-color");
    colorSelect.value = root.dataset.cwColor;
    colorSelect.addEventListener("change", () => {
      root.dataset.cwColor = colorSelect.value;
      write("color", colorSelect.value);
      wave?.draw(0);
    });
    const motionButton = document.querySelector("button[data-cw-motion]");
    const updateMotion = () => {
      motionButton.setAttribute("aria-pressed", String(paused));
      motionButton.querySelector("span").textContent = reduced.matches
        ? "Reduced motion"
        : paused
          ? "Resume waves"
          : "Pause waves";
      motionButton.disabled =
        reduced.matches || root.dataset.cwMotion === "false" || !wave?.available;
      if (!wave?.available) motionButton.querySelector("span").textContent = "Static background";
      wave?.sync();
    };
    motionButton.addEventListener("click", () => {
      paused = !paused;
      write("paused", String(paused));
      updateMotion();
    });
    let wave = createWave(
      document.querySelector("#cw-wave"),
      colors,
      root,
      () => !paused && !reduced.matches && !document.hidden,
    );
    document.querySelector("#cw-wave").addEventListener("cw-wave-fallback", updateMotion);
    reduced.addEventListener("change", updateMotion);
    updateMotion();
    setCategory(tabs[0].dataset.cwCategory);
    const scroll = document.querySelector(".cw-list-scroll");
    const fitList = () => {
      const footer = document.querySelector(".cw-bottom");
      root.style.setProperty("--cw-footer-height", `${footer.getBoundingClientRect().height}px`);
      const available = Math.max(
        80,
        innerHeight -
          scroll.getBoundingClientRect().top -
          footer.getBoundingClientRect().height -
          18,
      );
      scroll.style.maxHeight = `${Math.floor(available)}px`;
      scroll.style.minHeight = `${Math.min(160, Math.floor(available))}px`;
    };
    const layoutObserver = new ResizeObserver(fitList);
    for (const element of [
      document.querySelector(".cw-top"),
      document.querySelector(".cw-list-head"),
      document.querySelector(".cw-rail"),
      document.querySelector(".cw-bottom"),
    ])
      layoutObserver.observe(element);
    addEventListener("resize", fitList);
    fitList();

    navigation = createCrosswaveNavigator({
      main,
      reduced,
      getState: () => ({
        category,
        query: search.value,
        selected: selected?.dataset.path,
        scroll: scroll.scrollTop,
      }),
      commit: (doc, view) => {
        clearTimeout(searchTimer);
        composing = false;
        document.title = doc.title;
        for (const node of document.head.querySelectorAll("[data-dirwell-metadata]")) node.remove();
        for (const node of doc.head.querySelectorAll("[data-dirwell-metadata]"))
          document.head.append(node.cloneNode(true));
        document
          .querySelector(".cw-location")
          .replaceChildren(...doc.querySelector(".cw-location").childNodes);
        document.querySelector(".cw-stage > h1").textContent =
          doc.querySelector(".cw-stage > h1").textContent;
        document
          .querySelector(".cw-directory")
          .firstElementChild.replaceWith(doc.querySelector(".cw-directory").firstElementChild);
        document
          .querySelector(".cw-files")
          .replaceChildren(...doc.querySelector(".cw-files").childNodes);
        main.dataset.cwPath = doc.querySelector("[data-cw-root]").dataset.cwPath;
        rows = [...main.querySelectorAll("[data-cw-entry]")];
        for (const tab of tabs)
          tab.querySelector("small").textContent = String(
            rows.filter((row) => belongs(row, tab.dataset.cwCategory)).length,
          );
        search.value = view?.query ?? "";
        setCategory(
          tabs.some((tab) => tab.dataset.cwCategory === view?.category)
            ? view.category
            : tabs[0].dataset.cwCategory,
          false,
          false,
        );
        main.classList.remove("cw-category-changing");
        const row = rows.find((row) => !row.hidden && row.dataset.path === view?.selected);
        select(row ?? visible()[0] ?? null, true, false);
        if (!selected?.querySelector("a")) {
          document.querySelector("#cw-panel").tabIndex = -1;
          document.querySelector("#cw-panel").focus({ preventScroll: true });
        }
        scroll.scrollTop = view?.scroll ?? 0;
        status.className = "cw-sr";
        document.querySelector(".cw-skip").href = `${location.href.split("#")[0]}#cw-panel`;
        // Persistent ResizeObservers update geometry after the browser lays out the new content.
      },
    });

    // VueUse's useGamepad demonstrates event-driven connection and rAF polling.
    // Read fresh standard-mapping snapshots; controls here are original and framework-free.
    let padFrame = 0,
      padHeld = new Map(),
      stopped = false,
      padIdentity = null;
    const indicator = document.querySelector(".cw-controller");
    const pollPad = (time) => {
      if (stopped || document.hidden) return;
      let pad;
      try {
        pad = Array.from(navigator.getGamepads?.() ?? []).find(
          (p) => p?.connected && p.mapping === "standard",
        );
      } catch {
        pad = null;
      }
      indicator.hidden = !pad;
      if (!pad) {
        padHeld.clear();
        padIdentity = null;
        padFrame = 0;
        return;
      }
      const controllerLabel = document.querySelector("[data-cw-controller-label]");
      if (controllerLabel.textContent !== "Controller · Confirm / Back")
        controllerLabel.textContent = "Controller · Confirm / Back";
      const pressed = (i) => Boolean(pad.buttons[i]?.pressed || pad.buttons[i]?.value > 0.5);
      const active = {
        left: pressed(14) || (pad.axes[0] ?? 0) < -0.4,
        right: pressed(15) || (pad.axes[0] ?? 0) > 0.4,
        up: pressed(12) || (pad.axes[1] ?? 0) < -0.4,
        down: pressed(13) || (pad.axes[1] ?? 0) > 0.4,
        confirm: pressed(0),
        back: pressed(1),
        search: pressed(9),
      };
      const identity = `${pad.index}:${pad.id}`;
      if (padIdentity !== identity) {
        padIdentity = identity;
        padHeld.clear();
        // A held confirm must not open another item after document navigation.
        for (const [action, on] of Object.entries(active))
          if (on) padHeld.set(action, { next: Infinity });
      }
      for (const [action, on] of Object.entries(active)) {
        if (!on) {
          padHeld.delete(action);
          continue;
        }
        const hold = padHeld.get(action);
        const repeat = ["left", "right", "up", "down"].includes(action);
        if (hold && (!repeat || time < hold.next)) continue;
        padHeld.set(action, { next: time + (hold ? 140 : 420) });
        if (!document.hasFocus() || composing) continue;
        if (editing()) {
          if (action === "back") {
            if (document.activeElement === search) {
              search.value = "";
              applyFilter();
            }
            document.activeElement?.blur();
            selected?.querySelector("a")?.focus();
          }
          continue;
        }
        if (action === "left" || action === "right") moveCategory(action === "left" ? -1 : 1);
        else if (action === "up" || action === "down") moveRow(action === "up" ? -1 : 1);
        else if (action === "confirm") activate();
        else if (action === "back") back();
        else if (action === "search") search.focus();
      }
      padFrame = requestAnimationFrame(pollPad);
    };
    const startPad = () => {
      if (root.dataset.cwGamepad !== "false" && !document.hidden && !padFrame) {
        stopped = false;
        padFrame = requestAnimationFrame(pollPad);
      }
    };
    addEventListener("gamepadconnected", startPad);
    addEventListener("gamepaddisconnected", () => {
      padHeld.clear();
      indicator.hidden = true;
      startPad();
    });
    startPad();
    document.addEventListener("visibilitychange", () => {
      wave?.sync();
      if (document.hidden) {
        cancelAnimationFrame(padFrame);
        padFrame = 0;
        padHeld.clear();
        padIdentity = null;
        clearInterval(clockTimer);
      } else {
        clearInterval(clockTimer);
        updateClock();
        clockTimer = setInterval(updateClock, 30000);
        startPad();
      }
    });
    addEventListener("pagehide", () => {
      stopped = true;
      cancelAnimationFrame(padFrame);
      padFrame = 0;
      padHeld.clear();
      padIdentity = null;
      clearInterval(clockTimer);
      wave?.stop();
    });
    addEventListener("pageshow", (event) => {
      if (event.persisted) {
        stopped = false;
        clearInterval(clockTimer);
        updateClock();
        clockTimer = setInterval(updateClock, 30000);
        wave?.sync();
        startPad();
      }
    });
  });

  function createWave(canvas, colors, root, moving) {
    let gl;
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        powerPreference: "low-power",
      });
    } catch {
      return null;
    }
    if (!gl) return null;
    const vertex = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const fragment = `precision highp float;uniform vec2 resolution;uniform float time;uniform vec3 tint;
    void main(){vec2 uv=gl_FragCoord.xy/resolution;float x=uv.x;float y=uv.y;float t=time;
    vec3 ground=mix(tint*.22,tint,clamp(y*.85+x*.1,0.,1.));ground+=vec3(.035)*pow(max(0.,1.-distance(uv,vec2(.2,.9))),3.);
    float light=0.;for(int i=0;i<3;i++){float k=float(i);float center=.40+.07*sin(x*4.2+t*.17+k*.8)+.035*cos(x*7.1-t*.11+k*1.4)+k*.024;
    float breadth=.012+.037*(.5+.5*sin(x*2.7+t*.09+k));float d=y-center;float sheet=exp(-pow(d/breadth,2.));float edge=exp(-abs(d-breadth*.65)*430.);
    float fold=exp(-abs(d+breadth*.35)*170.);float taper=pow(sin(clamp(x,0.,1.)*3.14159),.6);light+=(sheet*.07+edge*.23+fold*.09)*taper;}
    ground+=mix(vec3(.6,.8,1.),vec3(1.),.75)*min(light,.12);gl_FragColor=vec4(ground,1.);}`;
    const shader = (type, source) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    };
    const vs = shader(gl.VERTEX_SHADER, vertex),
      fs = shader(gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return null;
    }
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      return null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const p = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const r = gl.getUniformLocation(program, "resolution"),
      t = gl.getUniformLocation(program, "time"),
      c = gl.getUniformLocation(program, "tint");
    let frame = 0,
      last = 0,
      lost = false,
      frozenTime = 17;
    const draw = (now) => {
      if (lost) return;
      const ratio = Math.min(devicePixelRatio || 1, 1.5, 1600 / innerWidth, 1000 / innerHeight),
        width = Math.round(innerWidth * ratio),
        height = Math.round(innerHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      if (moving()) frozenTime = (Date.now() % 86400000) / 1000;
      gl.uniform2f(r, width, height);
      gl.uniform1f(t, frozenTime);
      gl.uniform3fv(c, colors[root.dataset.cwColor] ?? colors.azure);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      canvas.parentElement.dataset.ready = "true";
      last = now;
    };
    const tick = (now) => {
      frame = 0;
      if (!moving() || lost) return;
      if (now - last >= 33) draw(now);
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const sync = () => {
      stop();
      if (lost) return;
      draw(0);
      if (moving()) frame = requestAnimationFrame(tick);
    };
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      lost = true;
      stop();
      delete canvas.parentElement.dataset.ready;
      canvas.dispatchEvent(new Event("cw-wave-fallback"));
    });
    canvas.addEventListener("webglcontextrestored", () => {
      delete canvas.parentElement.dataset.ready;
      lost = true;
    });
    addEventListener("resize", () => draw(0));
    return {
      draw,
      sync,
      stop,
      get available() {
        return !lost;
      },
    };
  }
})();
