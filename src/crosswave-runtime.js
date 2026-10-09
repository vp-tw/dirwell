(() => {
  "use strict";
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  // Registered before first paint for cross-document navigation and BFCache restores.
  for (const name of ["pageswap", "pagereveal"]) {
    addEventListener(name, (event) => {
      if ((reduced.matches || root.dataset.cwTransitions === "false") && event.viewTransition)
        event.viewTransition.skipTransition();
    });
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
    const rows = [...document.querySelectorAll("[data-cw-entry]")];
    const tabs = [...document.querySelectorAll("[data-cw-category]")];
    const search = document.querySelector("#cw-search");
    const clear = document.querySelector("[data-cw-clear]");
    const empty = document.querySelector("[data-cw-empty]");
    const status = document.querySelector("[data-cw-status]");
    const detail = document.querySelector(".cw-detail");
    const icons = new Map(tabs.map((tab) => [tab.dataset.cwCategory, tab.querySelector("svg")]));
    const linkIcon = rows.find((row) => row.dataset.icon === "link")?.querySelector("svg");
    if (linkIcon) icons.set("link", linkIcon);
    let category = "all",
      selected = null,
      composing = false,
      searchTimer;
    const visible = () => rows.filter((row) => !row.hidden);
    const select = (row, focus = false) => {
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
      const icon = icons.get(row.dataset.icon);
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
        } else {
          open.removeAttribute("target");
          open.removeAttribute("rel");
          open.setAttribute("data-cw-navigation", "");
        }
      }
      detail.hidden = false;
      if (focus) {
        link?.focus({ preventScroll: true });
        row.scrollIntoView({ block: "nearest", behavior: reduced.matches ? "instant" : "smooth" });
      }
    };
    const applyFilter = () => {
      const query = search.value.trim().toLocaleLowerCase();
      let count = 0;
      for (const row of rows) {
        row.hidden =
          (category !== "all" && row.dataset.category !== category) ||
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
    const setCategory = (next, focus = false) => {
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
      main.classList.remove("cw-category-changing");
      void main.offsetWidth;
      main.classList.add("cw-category-changing");
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
      const count =
        tab.dataset.cwCategory === "all"
          ? rows.length
          : rows.filter((row) => row.dataset.category === tab.dataset.cwCategory).length;
      tab.querySelector("small").textContent = String(count);
    }
    for (const row of rows) {
      row.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "touch") select(row);
      });
      row.addEventListener("focusin", () => select(row));
    }
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
    const back = () => document.querySelector("[data-cw-parent]")?.click();
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
    setCategory("all");
    const scroll = document.querySelector(".cw-list-scroll");
    const fitList = () => {
      const footer = document.querySelector(".cw-bottom");
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
