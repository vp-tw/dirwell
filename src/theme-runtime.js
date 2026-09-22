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

function initializeExplorer(root) {
  const config = JSON.parse(root.dataset.config ?? "{}");
  const list = root.querySelector("[data-entry-list]");
  const entries = [...root.querySelectorAll("[data-entry]")];
  const input = root.querySelector("[data-search-input]");
  const count = root.querySelector("[data-visible-count]");
  const countLabel = root.querySelector("[data-count-label]");
  const empty = root.querySelector("[data-empty]");
  const status = root.querySelector("[data-live-status]");
  let composing = false;

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

  const visibleLinks = () =>
    entries
      .filter((entry) => !entry.hidden)
      .map((entry) => entry.querySelector("a"))
      .filter(Boolean);

  const updateSearch = () => {
    if (!config.fuzzySearch || !input || composing) return;
    const query = input.value;
    const matches = entries
      .map((entry) => ({
        entry,
        order: Number(entry.dataset.order),
        score: fuzzyScore(query, entry.dataset.search ?? ""),
      }))
      .filter((match) => query.trim() === "" || match.score !== null)
      .sort((left, right) =>
        query.trim() === ""
          ? left.order - right.order
          : (right.score ?? 0) - (left.score ?? 0) || left.order - right.order,
      );
    const matched = new Set(matches.map(({ entry }) => entry));
    for (const entry of entries) entry.hidden = !matched.has(entry);
    for (const { entry } of matches) list?.append(entry);
    const visible = matches.length;
    if (count) count.textContent = String(visible);
    if (countLabel) countLabel.textContent = visible === 1 ? "entry" : "entries";
    if (empty) empty.hidden = visible !== 0;
    if (status) status.textContent = `${visible} ${visible === 1 ? "entry" : "entries"} shown`;
  };

  if (config.fuzzySearch && input) {
    input.value = storage.get(sessionStorage, searchStorageKey) ?? "";
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      storage.set(sessionStorage, searchStorageKey, input.value);
      updateSearch();
    });
    input.addEventListener("input", () => {
      if (!composing) storage.set(sessionStorage, searchStorageKey, input.value);
      updateSearch();
    });
    updateSearch();
  }

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
      if (event.key === "Escape" && input && (editable || input.value !== "")) {
        event.preventDefault();
        input.value = "";
        storage.set(sessionStorage, searchStorageKey, "");
        updateSearch();
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
        for (const entry of entries) {
          if (!entry.contains(next)) entry.removeAttribute("data-active");
        }
      }
    });
  }
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-explorer]")) initializeExplorer(root);
}
